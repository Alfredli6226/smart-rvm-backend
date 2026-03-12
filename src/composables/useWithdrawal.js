import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { supabase, getOrCreateUser } from '../services/supabase'; 

export function useWithdrawal(phone) {
  const loading = ref(false);
  const route = useRoute();

  // 1. Detect Nine App Logic
  const isNineApp = computed(() => {
    if (route.query.source === 'nineapp') {
      localStorage.setItem('rvm_source', 'nineapp');
      return true;
    }
    return localStorage.getItem('rvm_source') === 'nineapp';
  });
  
  // Load Cache
  const localUser = JSON.parse(localStorage.getItem("autogcmUser") || "{}");
  const maxWithdrawal = ref(localUser.cachedBalance || 0);
  const lifetimeEarnings = ref("0.00");
  
  const withdrawalHistory = ref([]);
  const userUuid = ref(null);
  const merchantBalances = ref({}); 

  const fetchBalance = async () => {
    loading.value = true;
    try {
      const currentName = localUser.nickname || localUser.name || localUser.nikeName || "User";
      const currentAvatar = localUser.avatarUrl || localUser.avatar || "";

      const dbUser = await getOrCreateUser(phone, currentName, currentAvatar);
      
      if (!dbUser) throw new Error("User not found");
      userUuid.value = dbUser.id;

      // 2. Fetch Financial Data via RPC (Bypasses RLS)
      const { data, error } = await supabase.rpc('get_user_financial_data', {
        p_user_id: userUuid.value
      });

      if (error) throw error;

      const earnings = data.submissions || [];
      const withdrawals = data.withdrawals || [];

      // 3. Calculate Balances (Updated to Global Logic)
      const balances = {};
      
      // A. Sum up ALL Earnings
      let totalLifetimeCalc = 0;
      earnings.forEach(item => {
        const mId = item.merchant_id;
        const pts = Number(item.calculated_value || 0);
        
        if (!balances[mId]) balances[mId] = 0;
        balances[mId] += pts;
        totalLifetimeCalc += pts; 
      });

      // B. Sum up ALL Withdrawals (Global Spent)
      // We sum all approved/pending withdrawals regardless of which merchant they are tagged to.
      let totalSpent = 0;
      withdrawals.forEach(item => {
        if (item.status === 'REJECTED' || item.status === 'EXTERNAL_SYNC') return; // Ignore rejected
        
        // We still track per-merchant for the specific "Standard Withdrawal" logic
        const mId = item.merchant_id;
        const amt = Number(item.amount || 0);
        if (balances[mId] !== undefined) {
             balances[mId] -= amt;
        }
        
        totalSpent += amt;
      });

      // C. Finalize Available Balance (Global Math)
      // This ensures 10.31 (Earned) - 5.00 (Withdrawn) = 5.31 (Available), no matter what.
      const finalBalance = totalLifetimeCalc - totalSpent;

      // Update State
      merchantBalances.value = balances; // Keep this for backend logic
      maxWithdrawal.value = finalBalance > 0 ? finalBalance.toFixed(2) : "0.00"; // ✅ Correct Global Balance
      withdrawalHistory.value = withdrawals;
      lifetimeEarnings.value = totalLifetimeCalc.toFixed(2);

      // Update Cache
      const cache = JSON.parse(localStorage.getItem("autogcmUser") || "{}");
      cache.cachedBalance = maxWithdrawal.value;
      localStorage.setItem("autogcmUser", JSON.stringify(cache));

    } catch (err) {
      console.error("Balance Check Failed", err);
    } finally {
      loading.value = false;
    }
  };

  const submitWithdrawal = async (amount, bankDetails) => {
    const reqAmount = Number(amount);
    
    // --- 1. Basic Validations ---
    if (reqAmount <= 0) return { success: false, message: "Invalid amount entered." };
    if (reqAmount > Number(maxWithdrawal.value)) return { success: false, message: "Insufficient balance." };

    // --- 2. New Limit Rules ---
    
    // Rule A: Minimum Withdrawal 5 pts
    if (reqAmount < 5) {
        return { success: false, message: "Minimum withdrawal amount is 5 pts." };
    }

    // Rule B: Max Single Withdrawal 200 pts
    if (reqAmount > 200) {
        return { success: false, message: "Maximum single withdrawal is 200 pts." };
    }

    // Rule C: Daily Max 300 pts
    // Calculate what user has already withdrawn TODAY (excluding Rejected)
    const todayStr = new Date().toDateString(); // e.g. "Tue Jan 13 2026"
    
    const withdrawnToday = withdrawalHistory.value
        .filter(w => {
            const wDate = new Date(w.created_at).toDateString();
            return wDate === todayStr && w.status !== 'REJECTED'; 
        })
        .reduce((sum, w) => sum + Number(w.amount), 0);

    if ((withdrawnToday + reqAmount) > 300) {
        const remainingDaily = (300 - withdrawnToday).toFixed(2);
        // Handle negative remaining (rare edge case)
        const safeRemaining = remainingDaily > 0 ? remainingDaily : "0.00";
        return { 
            success: false, 
            message: `Daily limit reached. You can only withdraw ${safeRemaining} pts more today.` 
        };
    }

    // --- 3. Proceed with Submission ---
    loading.value = true;
    try {
      let remainingToWithdraw = reqAmount;
      const transactions = [];

      for (const [mId, balance] of Object.entries(merchantBalances.value)) {
        if (remainingToWithdraw <= 0) break;
        if (balance <= 0) continue;

        // 1. Calculate amount
        let takeAmount = Math.min(balance, remainingToWithdraw);
        
        // 2. Clean the number (Fix the 0.310000005 bug)
        takeAmount = Number(takeAmount.toFixed(2));

        // 3. Add to list
        transactions.push({
          merchant_id: mId,
          amount: takeAmount,
          bank_name: bankDetails.bankName,
          account_number: bankDetails.accountNumber,
          account_holder_name: bankDetails.holderName
        });

        // 4. Update remainder (and clean that too, just in case)
        remainingToWithdraw -= takeAmount;
        remainingToWithdraw = Number(remainingToWithdraw.toFixed(2));
      }

      if (transactions.length > 0) {
        const { error } = await supabase.rpc('create_withdrawal_request', {
            p_user_id: userUuid.value,
            p_items: transactions
        });
        if (error) throw error;
      }
      
      await fetchBalance();
      return { success: true, message: "Withdrawal request submitted successfully!" };

    } catch (err) {
      console.error(err);
      return { success: false, message: "Submission failed: " + err.message };
    } finally {
      loading.value = false;
    }
  };

  // 2. Mock Wavpay Logic (Now with Limits Enforced)
  const submitWavpayMock = async (amount, identityNumber) => {
    loading.value = true;
    const reqAmount = Number(amount); // Ensure it's a number

    try {
        // --- A. VALIDATIONS (Copied from Standard Flow) ---
        
        // 1. Balance Check
        if (reqAmount > Number(maxWithdrawal.value)) {
            return { success: false, message: "Insufficient balance." };
        }
        
        // 2. Min/Max Limits
        if (reqAmount < 5) return { success: false, message: "Minimum withdrawal amount is 5 pts." };
        if (reqAmount > 200) return { success: false, message: "Maximum single withdrawal is 200 pts." };

        // 3. Daily Limit Check (300 pts)
        const todayStr = new Date().toDateString();
        const withdrawnToday = withdrawalHistory.value
            .filter(w => {
                const wDate = new Date(w.created_at).toDateString();
                return wDate === todayStr && w.status !== 'REJECTED'; 
            })
            .reduce((sum, w) => sum + Number(w.amount), 0);

        if ((withdrawnToday + reqAmount) > 300) {
            const remaining = (300 - withdrawnToday).toFixed(2);
            return { 
                success: false, 
                message: `Daily limit reached. You can only withdraw ${remaining > 0 ? remaining : 0} pts more.` 
            };
        }

        // --- B. EXECUTION ---

        // Call the Mock API
        const response = await fetch('/api/test-disburse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userUuid.value,
                amount: reqAmount,
                ic_number: identityNumber,
                items: merchantBalances.value 
            })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        await fetchBalance();
        return { success: true, message: "Instant Auto-Credit Successful!" };

    } catch (err) {
        return { success: false, message: err.message || "Transfer failed" };
    } finally {
        loading.value = false;
    }
  };
  
  return { 
    loading, maxWithdrawal, withdrawalHistory, lifetimeEarnings, fetchBalance, submitWithdrawal, isNineApp, submitWavpayMock 
  };
}