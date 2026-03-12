import { ref } from 'vue';
import { supabase } from '../services/supabase';
//import { syncUserAccount } from '../services/autogcm';
import { WithdrawalStatus, type Withdrawal } from '../types';
import { useAuthStore } from '../stores/auth';

interface WithdrawalWithBundle extends Withdrawal {
  total_amount?: number;
  bundled_ids?: string[];
  sub_withdrawals?: any[];
  is_bundled?: boolean;
}

interface BalanceCheckResult {
  id: string;
  available: number;
  lifetime: number;
  spent: number;
}

const syncConfirm = ref({ isOpen: false, title: '', message: '' });
const syncStatus = ref<{
    isOpen: boolean;
    type: 'success' | 'error'; // <--- This fixes the TS Error
    title: string;
    message: string;
  }>({ 
    isOpen: false, 
    type: 'success', 
    title: '', 
    message: '' 
  });

export function useWithdrawals() {
  const withdrawals = ref<WithdrawalWithBundle[]>([]);
  const loading = ref(false);
  
  // Balance Check State
  const checkingBalanceId = ref<string | null>(null);
  const balanceResult = ref<BalanceCheckResult | null>(null);

  // 1. Fetch Data
  const fetchWithdrawals = async () => {
    const auth = useAuthStore();
    
    // Wait for auth to be loaded if still loading or role not set
    if (auth.loading || !auth.role) {
        console.log("Withdrawals: Waiting for auth/role to be ready... loading:", auth.loading, "role:", auth.role);
        // Don't return - try again after a short delay
        setTimeout(() => fetchWithdrawals(), 500);
        return;
    }
    
    loading.value = true;
    console.log("Withdrawals: Fetching with role:", auth.role);
    try {
      let query = supabase
        .from('withdrawals')
        .select(`
            *,
            users ( nickname, phone, avatar_url ),
            merchants!merchant_id ( name ) 
        `)
        .order('created_at', { ascending: false });

      // 🔥 SaaS Filter - VIEWER role can see ALL data
      // Check VIEWER first before checking merchantId
      if (auth.role === 'VIEWER') {
          // No filter - see all data
      } else if (auth.merchantId) {
          query = query.eq('merchant_id', auth.merchantId);
      }

      const { data, error } = await query;
      console.log("Withdrawals: Raw response - data:", data?.length, "records, error:", error);
      console.log("🔥 Raw Data from Supabase:", data);

      if (error) throw error;
     if (!auth.merchantId && data) {
        // SUPER ADMIN: Bundle split records
        const groups = new Map<string, WithdrawalWithBundle>();

        data.forEach((item: any) => {
          // Group by User + Exact Time + Status
          const timeKey = new Date(item.created_at).toISOString().split('.')[0]; 
          const key = `${item.user_id}_${timeKey}_${item.status}`;

          if (!groups.has(key)) {
            // 👇 FIX: Explicitly cast 'item' to allow adding new properties
            const newItem: WithdrawalWithBundle = {
              ...item,
              is_bundled: false,
              total_amount: Number(item.amount),
              bundled_ids: [item.id],
              sub_withdrawals: [item]
            };
            groups.set(key, newItem);
          } else {
            const group = groups.get(key)!;
            group.is_bundled = true;
            group.total_amount = (group.total_amount || 0) + Number(item.amount);
            group.bundled_ids?.push(item.id);
            group.sub_withdrawals?.push(item);
            
            // 👇 FIX: Ensure type compatibility. 
            // If 'amount' in your types.ts is number, cast it. If string, keeps as string.
            // Assuming amount is string based on toFixed(2) usage:
            group.amount = group.total_amount?.toFixed(2) as any; 
          }
        });
        withdrawals.value = Array.from(groups.values());
      } else {
        // MERCHANTS: See raw data
        withdrawals.value = data as WithdrawalWithBundle[];
      }
    } catch (error) {
      console.error("Failed to load withdrawals", error);
    } finally {
      loading.value = false;
    }
  };

  // 2. Update Status
  const updateStatus = async (id: string, newStatus: WithdrawalStatus) => {
    if (!confirm(`Mark this request as ${newStatus}?`)) return;

    try {
      // 👇 3. REPLACE THE UPDATE LOGIC HERE:
      // Find bundle to update ALL sub-transactions at once
      const target = withdrawals.value.find(w => w.id === id);
      const idsToUpdate = target?.bundled_ids || [id];

      const { error } = await supabase
        .from('withdrawals')
        .update({ status: newStatus })
        .in('id', idsToUpdate);

      if (error) throw error;

      // Clear balance check if it was for this item
      if (balanceResult.value?.id === id) {
        balanceResult.value = null;
      }
      await fetchWithdrawals(); // Refresh list
    } catch (error) {
      alert("Failed to update status");
      console.error(error);
    }
  };

  // 3. Hybrid Balance Check
  const checkBalance = async (withdrawal: WithdrawalWithBundle) => {
    const auth = useAuthStore();
    const userId = withdrawal.user_id;

    checkingBalanceId.value = withdrawal.id;
    balanceResult.value = null;

    try {
      // 1. Define the scope (Specific Merchant vs Global)
      const targetMerchantId = auth.merchantId || withdrawal.merchant_id;

      // 2. Fetch Total Earnings from THIS Merchant (Source of Truth)
      // We look at submission_reviews to see how much recycling they did here.
      let earningsQuery = supabase
        .from('submission_reviews')
        .select('machine_given_points')
        .eq('user_id', userId)
        .neq('status', 'REJECTED'); // Valid recycles only

      if (targetMerchantId) {
        earningsQuery = earningsQuery.eq('merchant_id', targetMerchantId);
      }

      const { data: earningsData } = await earningsQuery;
      const totalEarned = (earningsData || []).reduce((sum, r) => sum + Number(r.machine_given_points || 0), 0);

      // 3. Fetch Total Withdrawals from THIS Merchant
      let withdrawalsQuery = supabase
        .from('withdrawals')
        .select('amount')
        .eq('user_id', userId)
        .neq('status', 'REJECTED'); // Valid withdrawals only

      if (targetMerchantId) {
        withdrawalsQuery = withdrawalsQuery.eq('merchant_id', targetMerchantId);
      }

      const { data: withdrawalsData } = await withdrawalsQuery;
      const totalWithdrawn = (withdrawalsData || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);

      // 4. Calculate Available Balance for THIS Merchant
      const availableBalance = totalEarned - totalWithdrawn;

      balanceResult.value = {
        id: withdrawal.id,
        available: Number(availableBalance.toFixed(2)), 
        lifetime: Number(totalEarned.toFixed(2)),
        spent: Number(totalWithdrawn.toFixed(2))
      };

    } catch (error: any) {
      alert(`Audit Error: ${error.message || "Unknown"}`);
      console.error(error);
    } finally {
      checkingBalanceId.value = null;
    }
  };

 // 4. Verify Live Balance (Call Backend)
  const verifyLiveBalance = async (userId: string, phone: string) => {
    try {
        const response = await fetch('/api/sync-balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, phone })
        });
        return await response.json();
    } catch (e) {
        console.error(e);
        return { status: 'ERROR', msg: 'Connection failed' };
    }
  };

  // 5. Batch Sync (The Button Logic)
  const isBatchSyncing = ref(false);
  
  // 5. GLOBAL AUDIT: Step 1 - Prepare (Show Modal)
  const prepareSync = async () => {
    // Get total count for the modal message
    const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .not('phone', 'is', null);

    if (error) {
        syncStatus.value = { isOpen: true, type: 'error', title: 'Error', message: 'Database connection failed.' };
        return;
    }

    syncConfirm.value = {
        isOpen: true,
        title: 'Start Global Audit?',
        message: `This will scan ALL ${count || 0} registered users for external spending on AutoGCM machines.\n\nThis process may take a minute.`
    };
  };

  // 6. GLOBAL AUDIT: Step 2 - Execute (Run Logic)
  const executeSync = async () => {
    isBatchSyncing.value = true;
    
    let updates = 0;
    let verified = 0;
    let processedCount = 0;

    try {
      console.log("🚀 Starting Bulk Audit...");

      const { data: allUsers } = await supabase
        .from('users')
        .select('userId:id, phone, nickname') // Alias id to userId
        .not('phone', 'is', null);

      if (!allUsers) throw new Error("No users found");

      const totalUsers = allUsers.length;
      
      // === NEW: BATCHING LOGIC ===
      const BATCH_SIZE = 10; // Process 10 users at once
      
      for (let i = 0; i < totalUsers; i += BATCH_SIZE) {
          const batch = allUsers.slice(i, i + BATCH_SIZE);
          
          // Update Modal Message
          syncConfirm.value.message = `Processing Batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(totalUsers/BATCH_SIZE)}...\n(${processedCount}/${totalUsers} users checked)`;
          
          try {
              // Call the new BULK API
              const response = await fetch('/api/batch-sync-balance', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ users: batch })
              });
              
              const { results } = await response.json();

              // Tally results
              if (results) {
                  results.forEach((r: any) => {
                      if (r.status === 'MATCHED') verified++;
                      if (r.status === 'RISK_DETECTED') {
                          updates++;
                          console.warn(`⚠️ Risk detected for user ${r.userId}`);
                      }
                  });
              }

              processedCount += batch.length;

          } catch (e) {
              console.error("Batch failed", e);
          }
      }

    } catch(e) {
       console.error("Audit Critical Failure:", e);
       syncConfirm.value.isOpen = false;
       syncStatus.value = { isOpen: true, type: 'error', title: 'Audit Failed', message: 'Check console.' };
       isBatchSyncing.value = false;
       return;
    }
    
    console.log("🏁 Audit Complete."); // Final Log

    // Cleanup
    await fetchWithdrawals(); 
    isBatchSyncing.value = false;
    syncConfirm.value.isOpen = false; 

    if (updates > 0) {
        syncStatus.value = { 
            isOpen: true, 
            type: 'success', 
            title: 'Audit Complete', 
            message: `⚠️ ${updates} accounts updated/adjusted.\n✅ ${verified} accounts verified.` 
        };
    } else {
        syncStatus.value = { 
            isOpen: true, 
            type: 'success', 
            title: 'Perfectly Synced', 
            message: `✅ All ${verified} users match AutoGCM records.` 
        };
    }
  };
  
  return {
    withdrawals,
    loading,
    checkingBalanceId,
    balanceResult,
    fetchWithdrawals,
    updateStatus,
    checkBalance,
    verifyLiveBalance,
    prepareSync, 
    executeSync,
    syncConfirm, 
    syncStatus,
    isBatchSyncing
  };
}