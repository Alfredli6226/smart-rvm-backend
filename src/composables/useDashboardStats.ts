import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { proxySelect } from '../services/supabaseProxy';
import { supabase } from '../services/supabase';

export function useDashboardStats() {
  const loading = ref(true);
  const pendingCount = ref(0);
  const totalPoints = ref(0);
  const totalWeight = ref(0);

  const recentWithdrawals = ref<any[]>([]);
  const recentSubmissions = ref<any[]>([]);
  const recentCleaning = ref<any[]>([]);

  async function fetchMerchantUserIds(merchantId: string): Promise<string[]> {
    const [walletsRes, withdrawalsRes, reviewsRes] = await Promise.all([
      proxySelect('merchant_wallets', { select: 'user_id', eq: { merchant_id: merchantId }, limit: 10000 }),
      proxySelect('withdrawals', { select: 'user_id', eq: { merchant_id: merchantId }, limit: 10000 }),
      proxySelect('submission_reviews', { select: 'user_id', eq: { merchant_id: merchantId }, limit: 10000 }),
    ]);

    return Array.from(new Set([
      ...(walletsRes.data || []).map((row: any) => row.user_id).filter(Boolean),
      ...(withdrawalsRes.data || []).map((row: any) => row.user_id).filter(Boolean),
      ...(reviewsRes.data || []).map((row: any) => row.user_id).filter(Boolean),
    ]));
  }

  async function fetchStats() {
    const auth = useAuthStore();

    if (auth.loading || !auth.role) {
      return;
    }

    loading.value = true;

    try {
      const merchantId = auth.merchantId || null;

      if (merchantId) {
        const [pendingRes, recWRes, recCRes, walletsRes] = await Promise.all([
          proxySelect('withdrawals', { count: true, head: true, eq: { status: 'PENDING', merchant_id: merchantId } }),
          proxySelect('withdrawals', {
            eq: { merchant_id: merchantId },
            order: { column: 'created_at', ascending: false },
            limit: 5,
          }),
          proxySelect('cleaning_records', {
            eq: { merchant_id: merchantId },
            order: { column: 'created_at', ascending: false },
            limit: 5,
          }),
          proxySelect('merchant_wallets', {
            select: 'user_id,current_balance,total_earnings,total_weight',
            eq: { merchant_id: merchantId },
            limit: 10000,
          }),
        ]);

        pendingCount.value = Number(pendingRes.count || 0);
        recentWithdrawals.value = recWRes.data || [];
        recentCleaning.value = recCRes.data || [];

        const wallets = walletsRes.data || [];
        totalWeight.value = wallets.reduce((sum: number, w: any) => sum + (Number(w.total_weight) || 0), 0);
        totalPoints.value = wallets.reduce((sum: number, w: any) => sum + (Number(w.total_earnings) || 0), 0);

        const userIds = Array.from(new Set(wallets.map((w: any) => w.user_id).filter(Boolean)));
        if (userIds.length > 0) {
          const usersRes = await proxySelect('users', {
            select: 'id,user_id,nickName,total_weight,total_points,last_active_at',
            in: { id: userIds },
            order: { column: 'last_active_at', ascending: false },
            limit: 20,
          });

          recentSubmissions.value = (usersRes.data || []).map((u: any) => ({
            user_name: u.nickName || u.user_id,
            api_weight: u.total_weight || 0,
            calculated_value: u.total_points || 0,
            submitted_at: u.last_active_at || null,
          }));
        } else {
          recentSubmissions.value = [];
        }

        return;
      }

      // Use direct Supabase for SUPER_ADMIN (no merchantId) — proxy was unreliable
      const [pendingCountRes, recWRes, recSRes, recCRes, usersStatsRes] = await Promise.all([
        supabase.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('withdrawals').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('users').select('nickName,user_id,total_weight,total_points,last_active_at').order('last_active_at', { ascending: false }).limit(20),
        supabase.from('cleaning_records').select('*').order('cleaned_at', { ascending: false }).limit(5),
        supabase.from('users').select('total_weight,total_points').limit(10000),
      ]);

      pendingCount.value = Number(pendingCountRes.count || 0);
      recentWithdrawals.value = recWRes.data || [];
      recentCleaning.value = recCRes.data || [];
      recentSubmissions.value = (recSRes.data || []).map((u: any) => ({
        user_name: u.nickName || u.user_id,
        api_weight: u.total_weight || 0,
        calculated_value: u.total_points || 0,
        submitted_at: u.last_active_at || null,
      }));

      const usersData = usersStatsRes.data || [];
      totalWeight.value = usersData.reduce((sum: number, u: any) => sum + (Number(u.total_weight) || 0), 0);
      totalPoints.value = usersData.reduce((sum: number, u: any) => sum + (Number(u.total_points) || 0), 0);
    } catch (err) {
      console.error('Stats Error:', err);
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    pendingCount,
    totalPoints,
    totalWeight,
    recentWithdrawals,
    recentSubmissions,
    recentCleaning,
    fetchStats,
  };
}
