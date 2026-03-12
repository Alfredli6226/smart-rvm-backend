import { ref, onMounted } from 'vue';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/auth';
import axios from 'axios';

export function useUserList() {
  const auth = useAuthStore();
  const users = ref<any[]>([]);
  const loading = ref(true);
  const isSubmitting = ref(false);

  // 1. Fetch Users + Wallet for Current Merchant
  const fetchUsers = async () => {
    // 1. Define Platform Owner Logic
    const isPlatformOwner = auth.role === 'SUPER_ADMIN' && !auth.merchantId;
    const isViewer = auth.role === 'VIEWER';
    
    // 2. Security Check - VIEWER can see all data
    if (!auth.merchantId && !isPlatformOwner && !isViewer) return;

    loading.value = true;
    try {
        // 3. Build Query
        // 🔥 ADDED: submission_reviews to get the REAL earned value
        let query = supabase
            .from('users')
            .select(`
                *,
                merchant_wallets (
                    current_balance,
                    total_earnings,
                    merchant_id,
                    total_weight
                ),
                withdrawals (
                    amount,
                    status,
                    merchant_id
                ),
                submission_reviews (
                    calculated_value,
                    status,
                    merchant_id
                )
            `)
            .order('created_at', { ascending: false });

        // 4. Apply Filter (If not Super Admin)
        // Note: We still fetch all user data, filtering happens in the map logic for specific columns
        if (!isPlatformOwner && auth.merchantId) {
             // Optional: You could optimize here, but filtering in JS is safer for the complex join logic
        }

        const { data, error } = await query;
        if (error) throw error;

        // 5. Map Data (Replicating useUserProfile Logic)
        users.value = data.map(u => {
            let totalEarned = 0;
            let totalWithdrawn = 0;
            let currentBalance = 0;
            
            // Arrays from the join
            const userReviews = u.submission_reviews || [];
            const userWithdrawals = u.withdrawals || [];

            // --- A. MERCHANT VIEW (Specific Merchant Data Only) ---
            if (auth.merchantId) {
                // 1. Calculate Earned (Only Verified & This Merchant)
                totalEarned = userReviews
                    .filter((r: any) => r.merchant_id === auth.merchantId && r.status === 'VERIFIED')
                    .reduce((sum: number, r: any) => sum + Number(r.calculated_value || 0), 0);

                // 2. Calculate Withdrawn (Only Approved/Pending & This Merchant)
                totalWithdrawn = userWithdrawals
                    .filter((w: any) => w.merchant_id === auth.merchantId && w.status !== 'REJECTED')
                    .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0);
                
                // 3. Balance
                currentBalance = totalEarned - totalWithdrawn;

                // (Optional) Weight Logic for Merchant
                // We can use the wallet weight as it is usually accurate for merchant specific
                const wallet = u.merchant_wallets?.find((w: any) => w.merchant_id === auth.merchantId);
                u.display_weight = wallet ? Number(wallet.total_weight || 0) : 0;
            } 
            // --- B. SUPER ADMIN VIEW (Global Data) ---
            else {
                // 1. Calculate Earned (All Verified Reviews)
                // 🔥 This fixes the negative balance. We sum the ACTUAL verified reviews, ignoring the 'lifetime_integral' column which might be synced incorrectly.
                totalEarned = userReviews
                    .filter((r: any) => r.status === 'VERIFIED')
                    .reduce((sum: number, r: any) => sum + Number(r.calculated_value || 0), 0);

                // 2. Calculate Withdrawn (All Non-Rejected Withdrawals)
                totalWithdrawn = userWithdrawals
                    .filter((w: any) => w.status !== 'REJECTED')
                    .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0);

                // 3. Balance
                currentBalance = totalEarned - totalWithdrawn;

                // Global Weight
                u.display_weight = Number(u.total_weight || 0);
            }

            return {
                ...u,
                balance: Number(currentBalance.toFixed(2)),
                earnings: Number(totalEarned.toFixed(2)),
                total_weight: Number(u.display_weight.toFixed(2)), // Normalized field for UI
            };
        });

    } catch (err: any) {
        console.error('Error fetching users:', err.message);
    } finally {
        loading.value = false;
    }
  };

  // 2. Adjust Balance
  const adjustBalance = async (userId: string, amount: number, note: string, category: 'ADJUSTMENT' | 'WITHDRAWAL') => {
      if (!userId || amount === 0) return;
      isSubmitting.value = true;
      try {
          let targetMerchantId = auth.merchantId;

          // Super Admin Logic: Find User's Primary Wallet to attribute the adjustment to
          if (!targetMerchantId) {
              const { data: userWallets } = await supabase
                  .from('merchant_wallets')
                  .select('merchant_id')
                  .eq('user_id', userId)
                  .order('total_earnings', { ascending: false }) 
                  .limit(1);
              
              targetMerchantId = userWallets?.[0]?.merchant_id;

              // Fallback if user has no wallets yet
              if (!targetMerchantId) {
                  const { data: fallback } = await supabase.from('merchants').select('id').limit(1).single();
                  targetMerchantId = fallback?.id;
              }
          }

          if (!targetMerchantId) throw new Error("Could not determine target merchant.");

          // Update Wallet (Legacy support, though we rely on Ledger now, it's good to keep wallets updated)
          const { data: wallet } = await supabase
              .from('merchant_wallets')
              .select('*')
              .eq('user_id', userId)
              .eq('merchant_id', targetMerchantId)
              .maybeSingle();

          const currentBal = wallet ? Number(wallet.current_balance) : 0;
          const currentEarn = wallet ? Number(wallet.total_earnings) : 0;
          const newBalance = currentBal + amount;

          if (wallet) {
              await supabase.from('merchant_wallets').update({
                  current_balance: newBalance,
                  total_earnings: amount > 0 ? currentEarn + amount : currentEarn
              }).eq('id', wallet.id);
          } else {
              await supabase.from('merchant_wallets').insert({
                  user_id: userId,
                  merchant_id: targetMerchantId,
                  current_balance: newBalance,
                  total_earnings: amount > 0 ? amount : 0
              });
          }

          // Create Withdrawal Record (Critical for the calculation above to recognize the deduction)
          if (category === 'WITHDRAWAL') {
              await supabase.from('withdrawals').insert({
                  user_id: userId,
                  merchant_id: targetMerchantId,
                  amount: Math.abs(amount),
                  status: 'EXTERNAL_SYNC' // Matches your logic
              });
          }
          // 🔥 NEW: Handle MANUAL_ADJUSTMENT affecting the balance
          // If we add money (Positive Adjustment), we should technically add a 'dummy' submission review or handle it via a separate 'adjustments' table.
          // However, based on your current schema, the calculation above depends on `submission_reviews` (Positive) - `withdrawals` (Negative).
          // If you do a POSITIVE adjustment here, it won't show up in the list calculation unless it's a submission or we add a logic for `wallet_transactions` in the fetch.
          // For now, assuming you mostly use this for Withdrawals (Negative).
          // If you need Positive Adjustments to appear, consider inserting a dummy 'VERIFIED' record into submission_reviews.

          else if (category === 'ADJUSTMENT' && amount > 0) {
             // Hack to make positive adjustment appear in the ledger calculation
             await supabase.from('submission_reviews').insert({
                 user_id: userId,
                 merchant_id: targetMerchantId,
                 vendor_record_id: `ADJ-${Date.now()}`,
                 device_no: 'MANUAL_ADJ',
                 waste_type: 'Manual Adjustment',
                 api_weight: 0,
                 calculated_value: amount, // Positive Value
                 rate_per_kg: 0,
                 status: 'VERIFIED',
                 submitted_at: new Date().toISOString(),
                 phone: 'MANUAL',
                 photo_url: ''
             });
          }

          // Ledger Entry (Audit Trail)
          await supabase.from('wallet_transactions').insert({
              merchant_id: targetMerchantId,
              user_id: userId,
              amount: amount,
              balance_after: newBalance,
              transaction_type: category === 'WITHDRAWAL' ? 'WITHDRAWAL_SYNC' : 'MANUAL_ADJUSTMENT',
              description: note || (category === 'WITHDRAWAL' ? 'Imported Historical Withdrawal' : 'Balance Correction')
          });
          
          await fetchUsers(); 
          return { success: true, newBalance };

      } catch (err: any) {
          return { success: false, error: err.message };
      } finally {
          isSubmitting.value = false;
      }
  };
  
  // 3. Import User (Unchanged)
  const importUser = async (nickname: string, phone: string) => {
      isSubmitting.value = true;
      try {
          const { data: newUser, error: uError } = await supabase
              .from('users')
              .upsert({ phone, nickname, is_active: true }, { onConflict: 'phone' })
              .select().single();

          if (uError) throw uError;

          if (auth.merchantId) {
              const { error: wError } = await supabase
                  .from('merchant_wallets')
                  .insert({
                      user_id: newUser.id,
                      merchant_id: auth.merchantId,
                      current_balance: 0,
                      total_earnings: 0
                  });
              if (wError && wError.code !== '23505') throw wError;
          }

          try { await axios.post('/api/onboard', { phone }); } catch (e) { console.warn("Onboard sync warning:", e); }

          await fetchUsers(); 
          return { success: true };

      } catch (err: any) {
          console.error("Import failed:", err);
          return { success: false, error: err.response?.data?.error || err.message };
      } finally {
          isSubmitting.value = false;
      }
  };

  // 4. Delete User
  const deleteUser = async (userId: string) => {
      if (!userId) return { success: false, error: 'User ID is required' };
      isSubmitting.value = true;
      try {
          // Delete related records first (cascading)
          // Delete merchant_wallets
          await supabase.from('merchant_wallets').delete().eq('user_id', userId);
          // Delete withdrawals
          await supabase.from('withdrawals').delete().eq('user_id', userId);
          // Delete submission_reviews
          await supabase.from('submission_reviews').delete().eq('user_id', userId);
          // Delete wallet_transactions
          await supabase.from('wallet_transactions').delete().eq('user_id', userId);
          
          // Finally delete the user
          const { error: uError } = await supabase.from('users').delete().eq('id', userId);
          if (uError) throw uError;

          await fetchUsers();
          return { success: true };
      } catch (err: any) {
          console.error('Delete failed:', err);
          return { success: false, error: err.message };
      } finally {
          isSubmitting.value = false;
      }
  };

  onMounted(() => {
    fetchUsers();
  });

  return { 
      users, 
      loading, 
      isSubmitting,
      fetchUsers, 
      adjustBalance, 
      importUser,
      deleteUser
  };
}