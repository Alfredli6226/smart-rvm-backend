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
    // Use live vendor API ONLY (no Supabase proxy dependency)
    loading.value = true;
    try {
      const r = await fetch('/api/user-analytics?endpoint=active-recyclers&limit=1000');
      if (r.ok) {
        const d = await r.json();
        if (d.success && Array.isArray(d.data)) {
          users.value = d.data.map((u: any, i: number) => ({
            id: u.userId || i,
            user_id: u.userId || '',
            nickname: u.userName || 'User ' + (u.userId || '').slice(-6),
            phone: u.phone || '',
            email: u.email || '',
            total_weight: u.totalRecycled || 0,
            total_points: u.carbonSaved || 0,
            balance: 0,
            earnings: 0,
            last_active_at: u.lastSubmission || '',
            status: u.status || '',
            device_no: u.deviceNo || '',
            machine_location: u.machineLocation || '',
            _source: 'vendor'
          }));
          return;
        }
      }
      // Fallback to Supabase if vendor API fails
    } catch (err: any) {
      console.error('Vendor API failed:', err.message);
    }
    
    // Supabase fallback (original logic)
    const isPlatformOwner = auth.role === 'SUPER_ADMIN' && !auth.merchantId;
    const isViewer = auth.role === 'VIEWER';
    if (!auth.merchantId && !isPlatformOwner && !isViewer) { loading.value = false; return; }
    try {
      if (auth.merchantId) {
        await fetchMerchantScopedUsers(auth.merchantId);
        return;
      }
      const [usersRes, walletsRes] = await Promise.all([
        proxy.from('users').select('*').order('created_at', { ascending: false }).run('select'),
        proxy.from('merchant_wallets').select('user_id,current_balance,total_earnings,merchant_id,total_weight').limit(10000).run('select'),
      ]);
      if (usersRes.error) throw new Error(usersRes.error);
      let vendorWeights = {};
      try {
        const vr = await fetch('/api/user-analytics?endpoint=active-recyclers&limit=200');
        if (vr.ok) {
          const vd = await vr.json();
          if (vd.success && vd.data) vd.data.forEach((v: any) => {
            if (v.userId) vendorWeights[v.userId] = v.totalRecycled || 0;
            if (v.phone) vendorWeights[v.phone] = v.totalRecycled || 0;
          });
        }
      } catch(e) {}
      const wallets = walletsRes.data || [];
      const walletsByUser = wallets.reduce((acc: any, r: any) => {
        if (!acc[r.user_id]) acc[r.user_id] = []; acc[r.user_id].push(r); return acc;
      }, {});
      users.value = (usersRes.data || []).map((u: any) => {
        const w = walletsByUser[u.user_id] || [];
        const ww = w.reduce((s: number, x: any) => s + Number(x.total_weight || 0), 0);
        const wb = w.reduce((s: number, x: any) => s + Number(x.current_balance || 0), 0);
        const lw = vendorWeights[u.user_id] || vendorWeights[u.phone] || 0;
        return { ...u, merchant_wallets: w, nickname: u.nickname || u.nickName || u.phone, balance: +wb.toFixed(2), earnings: +wb.toFixed(2), total_weight: +(lw > 0 ? lw : ww).toFixed(2) };
      });
    } catch (err: any) { console.error('Error fetching users:', err.message);
    } finally { loading.value = false; }
  }
