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
      const r = await fetch('/api/user-sync?action=list');
      if (r.ok) {
        const d = await r.json();
        if (d.success && Array.isArray(d.users) && d.users.length > 0) {
          users.value = d.users.map((u, i) => ({
            id: u.userId || i, user_id: u.userId || '',
            nickname: u.name || 'User', phone: u.phone || '',
            email: '', total_weight: u.totalWeight || 0,
            total_points: u.totalPoints || 0, balance: 0, earnings: 0,
            last_active_at: u.lastSeen || '', status: 'active',
            _source: 'merged'
          }));
          loading.value = false; return;
        }
      }
    } catch(e) {}
    
    if (!loading.value && users.value.length === 0) {
      users.value = [];
    }
    loading.value = false;
};
}
