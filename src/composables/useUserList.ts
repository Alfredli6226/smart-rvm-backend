import { ref, onMounted } from 'vue';
import { proxy, proxySelect, proxyUpdate, proxyInsert, proxyDelete, proxyUpsert } from '../services/supabaseProxy';
import { useAuthStore } from '../stores/auth';
import axios from 'axios';

export function useUserList() {
  const auth = useAuthStore();
  const users = ref<any[]>([]);
  const loading = ref(true);
  const isSubmitting = ref(false);

  async function fetchMerchantScopedUsers(merchantId: string) {
    const [walletsRes, withdrawalsRes, reviewsRes] = await Promise.all([
      proxySelect('merchant_wallets', {
        select: 'id,user_id,merchant_id,current_balance,total_earnings,total_weight',
        eq: { merchant_id: merchantId },
        limit: 10000,
      }),
      proxySelect('withdrawals', {
        select: 'id,user_id,merchant_id,amount,status,created_at',
        eq: { merchant_id: merchantId },
        limit: 10000,
      }),
      proxySelect('submission_reviews', {
        select: 'id,user_id,merchant_id,calculated_value,status,api_weight,submitted_at,created_at',
        eq: { merchant_id: merchantId },
        limit: 10000,
      }),
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

    const { data, error } = await proxy.from('users')
      .select('*')
      .in('id', userIds)
      .order('created_at', { ascending: false })
      .run('select');

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
    // Try live vendor API first for real user data
    try {
      const r = await fetch('/api/user-analytics?endpoint=active-recyclers&limit=1000');
      if (r.ok) {
        const d = await r.json();
        if (d.success && Array.isArray(d.data) && d.data.length > 0) {
          users.value = d.data.map((u, i) => ({
            id: u.userId || i, user_id: u.userId || '',
            nickname: u.userName || ('User ' + (u.userId || u.id || '').slice(-6)), phone: u.phone || '',
            email: u.email || '', total_weight: u.totalRecycled || 0,
            total_points: u.carbonSaved || 0, balance: 0, earnings: 0,
            last_active_at: u.lastSubmission || '', status: u.status || '',
            device_no: u.deviceNo || '', machine_location: u.machineLocation || '',
            _source: 'vendor'
          }));
          loading.value = false; return;
        }
      }
    } catch(e) {}
    
    // Skip auth check - if vendor API failed, show empty (not blocked)
    const isPlatformOwner = auth.role === 'SUPER_ADMIN' && !auth.merchantId;
    const isViewer = auth.role === 'VIEWER';
    if (!auth.merchantId && !isPlatformOwner && !isViewer) { 
      loading.value = false; 
      return; // No data but not blocked - shows empty table
    }
    try {
      if (auth.merchantId) {
        await fetchMerchantScopedUsers(auth.merchantId);
        return;
      }

      const [usersRes, walletsRes] = await Promise.all([
        proxy.from('users')
          .select('*')
          .order('created_at', { ascending: false })
          .run('select'),
        proxy.from('merchant_wallets')
          .select('user_id,current_balance,total_earnings,merchant_id,total_weight')
          .limit(10000)
          .run('select'),
      ]);

      if (usersRes.error) throw new Error(usersRes.error);
      
      // Fetch live vendor weights and merge with Supabase user data
      let vendorWeights: Record<string, number> = {};
      try {
        const r = await fetch('/api/user-analytics?endpoint=active-recyclers&limit=200');
        if (r.ok) {
          const d = await r.json();
          if (d.success && d.data) {
            d.data.forEach((v: any) => {
              if (v.userId) vendorWeights[v.userId] = v.totalRecycled || 0;
              if (v.phone) vendorWeights[v.phone] = v.totalRecycled || 0;
            });
          }
        }
      } catch(e) {}

      const wallets = walletsRes.data || [];

      const walletsByUser = wallets.reduce((acc: any, row: any) => {
        if (!acc[row.user_id]) acc[row.user_id] = [];
        acc[row.user_id].push(row);
        return acc;
      }, {});

      users.value = (usersRes.data || []).map((u: any) => {
        const userWallets = walletsByUser[u.user_id] || [];
        const walletWeight = userWallets.reduce((sum: number, w: any) => sum + Number(w.total_weight || 0), 0);
        const walletBalance = userWallets.reduce((sum: number, w: any) => sum + Number(w.current_balance || 0), 0);
        
        // Prefer live vendor weight over stale wallet weight
        const liveWeight = vendorWeights[u.user_id] || vendorWeights[u.phone] || 0;
        const weight = liveWeight > 0 ? liveWeight : walletWeight;

        return {
          ...u,
          merchant_wallets: userWallets,
          nickname: u.nickname || u.nickName || u.full_name || u.phone,
          balance: Number(walletBalance.toFixed(2)),
          earnings: Number(walletBalance.toFixed(2)),
          total_weight: Number(weight.toFixed(2)),
        };
      });
    } catch (err: any) {
      console.error('Error fetching users:', err.message);
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
