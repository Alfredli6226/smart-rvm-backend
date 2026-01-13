import { ref } from 'vue';
import { supabase, getOrCreateUser } from '../services/supabase'; 

export function useWithdrawal(phone) {
  const loading = ref(false);
  
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
      // 1. Get User ID (uses RPC internally now)
      const dbUser = await getOrCreateUser(phone);
      if (!dbUser) throw new Error("User not found");
      userUuid.value = dbUser.id;

      // 2. Fetch Financial Data via RPC (Bypasses RLS)
      const { data, error } = await supabase.rpc('get_user_financial_data', {
        p_user_id: userUuid.value
      });

      if (error) throw error;

      const earnings = data.submissions || [];
      const withdrawals = data.withdrawals || [];

      // 3. Calculate Balances (Same logic as before, just using RPC data)
      const balances = {};
      let totalLifetimeCalc = 0;

      // Add Earnings
      earnings.forEach(item => {
        const mId = item.merchant_id;
        const pts = Number(item.calculated_value || 0);
        if (!balances[mId]) balances[mId] = 0;
        balances[mId] += pts;
        totalLifetimeCalc += pts; 
      });

      // Subtract Withdrawals
      withdrawals.forEach(item => {
        const mId = item.merchant_id;
        const amt = Number(item.amount || 0);
        if (balances[mId]) balances[mId] -= amt;
      });

      // Finalize Available Balance
      let totalAvailable = 0;
      for (const mId in balances) {
        balances[mId] = Number(balances[mId].toFixed(2));
        if (balances[mId] > 0) totalAvailable += balances[mId];
        else balances[mId] = 0;
      }

      merchantBalances.value = balances;
      maxWithdrawal.value = totalAvailable.toFixed(2);
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

        const takeAmount = Math.min(balance, remainingToWithdraw);
        transactions.push({
          merchant_id: mId,
          amount: takeAmount,
          bank_name: bankDetails.bankName,
          account_number: bankDetails.accountNumber,
          account_holder_name: bankDetails.holderName
        });
        remainingToWithdraw -= takeAmount;
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

  return { loading, maxWithdrawal, withdrawalHistory, lifetimeEarnings, fetchBalance, submitWithdrawal };
}