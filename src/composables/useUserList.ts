import { ref, onMounted } from 'vue';
import { supabase } from '../services/supabase';
import { proxy, proxySelect, proxyUpdate, proxyInsert, proxyDelete, proxyUpsert } from '../services/supabaseProxy';
import { useAuthStore } from '../stores/auth';
import axios from 'axios';

export function useUserList() {
  const auth = useAuthStore();
  const users = ref<any[]>([]);
  const loading = ref(true);
  const isSubmitting = ref(false);

  async function fetchMerchantScopedUsers(merchantId: string) {
    // Use direct supabase client (frontend VITE env vars work correctly)
    const [walletsRes, withdrawalsRes, reviewsRes] = await Promise.all([
      supabase.from('merchant_wallets').select('id,user_id,merchant_id,current_balance,total_earnings,total_weight').eq('merchant_id', merchantId).limit(10000),
      supabase.from('withdrawals').select('id,user_id,merchant_id,amount,status,created_at').eq('merchant_id', merchantId).limit(10000),
      supabase.from('submission_reviews').select('id,user_id,merchant_id,calculated_value,status,api_weight,submitted_at,created_at').eq('merchant_id', merchantId).limit(10000),
    ]);

    const wallets = walletsRes.data || [];
    const withdrawals = withdrawalsRes.data || [];
    const reviews = reviewsRes.data || [];

    const userIds = Array.from(new Set([
      ...wallets.map((row: any) => row.user_id),
      ...withdrawals.map((row: any) => row.user_id),
      ...reviews.map((row: any) => row.user_id),
    ].filter(Boolean)));

    if (userIds.length === 0) {
      users.value = [];
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error);

    const walletsByUser = wallets.reduce((acc: any, row: any) => {
      if (!acc[row.user_id]) acc[row.user_id] = [];
      acc[row.user_id].push(row);
      return acc;
    }, {});

    const withdrawalsByUser = withdrawals.reduce((acc: any, row: any) => {
      if (!acc[row.user_id]) acc[row.user_id] = [];
      acc[row.user_id].push(row);
      return acc;
    }, {});

    const reviewsByUser = reviews.reduce((acc: any, row: any) => {
      if (!acc[row.user_id]) acc[row.user_id] = [];
      acc[row.user_id].push(row);
      return acc;
    }, {});

    users.value = (data || []).map((u: any) => {
      const userWallets = walletsByUser[u.id] || [];
      const userWithdrawals = withdrawalsByUser[u.id] || [];
      const userReviews = reviewsByUser[u.id] || [];

      const totalEarned = userReviews
        .filter((r: any) => r.status === 'VERIFIED')
        .reduce((sum: number, r: any) => sum + Number(r.calculated_value || 0), 0);

      const totalWithdrawn = userWithdrawals
        .filter((w: any) => w.status !== 'REJECTED')
        .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0);

      const walletWeight = userWallets.reduce((sum: number, w: any) => sum + Number(w.total_weight || 0), 0);
      const walletBalance = userWallets.reduce((sum: number, w: any) => sum + Number(w.current_balance || 0), 0);

      return {
        ...u,
        nickname: u.nickname || u.nickName || u.full_name || u.phone,
        merchant_wallets: userWallets,
        withdrawals: userWithdrawals,
        submission_reviews: userReviews,
        balance: Number(walletBalance.toFixed(2)),
        earnings: Number(totalEarned.toFixed(2)),
        total_weight: Number(walletWeight.toFixed(2)),
      };
    });
  }

  const fetchUsers = async () => {
    loading.value = true;
    try {
      // Direct Supabase query (frontend client uses VITE_SUPABASE_URL which is correct)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) throw new Error(usersError.message);
      if (!usersData || usersData.length === 0) { users.value = []; return; }

      // Fetch submission_reviews to calculate actual weight and points
      const { data: submissions } = await supabase
        .from('submission_reviews')
        .select('user_id,api_weight,points_awarded,status,calculated_value')
        .limit(10000);

      // Fetch withdrawals for balance calculation
      const { data: withdrawals } = await supabase
        .from('withdrawals')
        .select('user_id,amount,status')
        .limit(10000);

      // Aggregate submissions by user
      const subTotals: Record<string, { weight: number; points: number }> = {};
      if (submissions) {
        for (const s of submissions) {
          if (!s.user_id) continue;
          if (!subTotals[s.user_id]) subTotals[s.user_id] = { weight: 0, points: 0 };
          subTotals[s.user_id].weight += Number(s.api_weight || 0);
          subTotals[s.user_id].points += Number(s.points_awarded || 0);
        }
      }

      // Aggregate withdrawals by user
      const withdrawTotals: Record<string, number> = {};
      if (withdrawals) {
        for (const w of withdrawals) {
          if (!w.user_id || w.status === 'REJECTED') continue;
          withdrawTotals[w.user_id] = (withdrawTotals[w.user_id] || 0) + Number(w.amount || 0);
        }
      }

      users.value = usersData.map((u: any) => {
        const subs = subTotals[u.user_id] || { weight: 0, points: 0 };
        const withdrawn = withdrawTotals[u.user_id] || 0;
        const balance = Math.max(0, subs.points - withdrawn);
        return {
          ...u,
          id: u.id,
          nickname: u.nickname || u.nickName || u.full_name || u.phone || 'User',
          total_weight: Number(subs.weight.toFixed(2)),
          total_points: Number(subs.points.toFixed(2)),
          balance: Number(balance.toFixed(2)),
          earnings: Number(subs.points.toFixed(2)),
          last_active_at: u.last_active_at || '',
          status: u.status || 'active',
        };
      });
    } catch (err: any) {
      console.error('Error fetching users:', err.message);
      // Fallback: proxy-based merchant-scoped query
      if (auth.merchantId) {
        try { await fetchMerchantScopedUsers(auth.merchantId); } catch {}
      }
    } finally {
      loading.value = false;
    }
  };

  const adjustBalance = async (userId: string, amount: number, note: string, category: 'ADJUSTMENT' | 'WITHDRAWAL') => {
    if (!userId || amount === 0) return;
    isSubmitting.value = true;
    try {
      let targetMerchantId = auth.merchantId;

      if (!targetMerchantId) {
        const { data: userWallets } = await proxy.from('merchant_wallets')
          .select('merchant_id')
          .eq('user_id', userId)
          .order('total_earnings', { ascending: false })
          .limit(1)
          .run('select');

        targetMerchantId = userWallets?.[0]?.merchant_id;

        if (!targetMerchantId) {
          const fallbackRes = await proxy.from('merchants')
            .select('id')
            .limit(1)
            .single()
            .run('select');
          targetMerchantId = fallbackRes?.data?.[0]?.id;
        }
      }

      if (!targetMerchantId) throw new Error('Could not determine target merchant.');

      const walletRes = await proxy.from('merchant_wallets')
        .select('*')
        .eq('user_id', userId)
        .eq('merchant_id', targetMerchantId)
        .maybeSingle()
        .run('select');
      const wallet = walletRes?.data?.[0] || null;

      const currentBal = wallet ? Number(wallet.current_balance) : 0;
      const currentEarn = wallet ? Number(wallet.total_earnings) : 0;
      const newBalance = currentBal + amount;

      if (wallet) {
        await proxyUpdate('merchant_wallets', {
          current_balance: newBalance,
          total_earnings: amount > 0 ? currentEarn + amount : currentEarn,
        }, { id: wallet.id });
      } else {
        await proxyInsert('merchant_wallets', {
          user_id: userId,
          merchant_id: targetMerchantId,
          current_balance: newBalance,
          total_earnings: amount > 0 ? amount : 0,
        });
      }

      if (category === 'WITHDRAWAL') {
        await proxyInsert('withdrawals', {
          user_id: userId,
          merchant_id: targetMerchantId,
          amount: Math.abs(amount),
          status: 'EXTERNAL_SYNC',
        });
      } else if (category === 'ADJUSTMENT' && amount > 0) {
        await proxyInsert('submission_reviews', {
          user_id: userId,
          merchant_id: targetMerchantId,
          vendor_record_id: `ADJ-${Date.now()}`,
          device_no: 'MANUAL_ADJ',
          waste_type: 'Manual Adjustment',
          api_weight: 0,
          calculated_value: amount,
          rate_per_kg: 0,
          status: 'VERIFIED',
          submitted_at: new Date().toISOString(),
          phone: 'MANUAL',
          photo_url: '',
        });
      }

      await proxyInsert('wallet_transactions', {
        merchant_id: targetMerchantId,
        user_id: userId,
        amount,
        balance_after: newBalance,
        transaction_type: category === 'WITHDRAWAL' ? 'WITHDRAWAL_SYNC' : 'MANUAL_ADJUSTMENT',
        description: note || (category === 'WITHDRAWAL' ? 'Imported Historical Withdrawal' : 'Balance Correction'),
      });

      await fetchUsers();
      return { success: true, newBalance };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      isSubmitting.value = false;
    }
  };

  const importUser = async (nickname: string, phone: string) => {
    isSubmitting.value = true;
    try {
      const newUserRes = await proxyUpsert('users', {
        phone,
        nickname: nickname || phone,
        is_active: true,
      }, 'phone');

      const newUser = newUserRes?.data?.[0];
      if (!newUser) throw new Error('Failed to create user');

      if (auth.merchantId) {
        const wRes = await proxyInsert('merchant_wallets', {
          user_id: newUser.id,
          merchant_id: auth.merchantId,
          current_balance: 0,
          total_earnings: 0,
        });
        if (wRes.error) throw new Error(wRes.error);
      }

      try {
        await axios.post('/api/onboard', { phone });
      } catch (e) {
        console.warn('Onboard sync warning:', e);
      }

      await fetchUsers();
      return { success: true };
    } catch (err: any) {
      console.error('Import failed:', err);
      return { success: false, error: err.response?.data?.error || err.message };
    } finally {
      isSubmitting.value = false;
    }
  };

  const deleteUser = async (userId: string) => {
    if (!userId) return { success: false, error: 'User ID is required' };
    isSubmitting.value = true;
    try {
      await proxyDelete('merchant_wallets', { user_id: userId });
      await proxyDelete('withdrawals', { user_id: userId });
      await proxyDelete('submission_reviews', { user_id: userId });
      await proxyDelete('wallet_transactions', { user_id: userId });
      const dRes = await proxyDelete('users', { id: userId });
      if (dRes.error) throw new Error(dRes.error);

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
    deleteUser,
  };
}
