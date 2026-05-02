import { ref } from 'vue';
import { getMachineStatusSnapshot, normalizeMachineStatus } from '../services/autogcm';
import { proxySelect } from '../services/supabaseProxy';
import { useAuthStore } from '../stores/auth';

export function useBigDataStats() {
  const loading = ref(true);
  const statsLoading = ref(false);

  const timeFilter = ref('all');
  const dateRange = ref({ start: '', end: '' });
  const selectedMachineId = ref('');

  const totalUsers = ref(0);
  const totalWeight = ref(0);
  const totalLifetimePoints = ref(0);
  const totalMachines = ref(0);
  const machineLocations = ref<any[]>([]);
  const onlineCount = ref(0);
  const offlineCount = ref(0);
  const recentSubmissions = ref<any[]>([]);

  const summary = ref({
    deliveryVolume: 0,
    submissions: 0,
    newUsers: 0,
    pointsGiven: 0,
  });

  const wasteTrends = ref<any[]>([]);
  const withdrawalTrends = ref<any[]>([]);
  const collectionLogs = ref<any[]>([]);

  function getStartDate(): string {
    if (dateRange.value.start) return new Date(dateRange.value.start).toISOString();
    const d = new Date();
    if (timeFilter.value === 'day') d.setDate(d.getDate() - 1);
    else if (timeFilter.value === 'week') d.setDate(d.getDate() - 7);
    else if (timeFilter.value === 'month') d.setMonth(d.getMonth() - 1);
    else return '';
    return d.toISOString();
  }

  async function fetchMerchantScopedUserIds(merchantId: string): Promise<string[]> {
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

  async function fetchInitialData(background = false) {
    const auth = useAuthStore();

    if (!background) loading.value = true;

    try {
      const merchantId = auth.merchantId || null;
      const machineQuery: any = { limit: 100 };
      if (merchantId) machineQuery.eq = { merchant_id: merchantId };

      const { data: machines } = await proxySelect('machines', machineQuery);
      if (machines) {
        const statusSnapshot = await getMachineStatusSnapshot();
        const results = machines.map((m: any) => {
          const vendorState = normalizeMachineStatus(statusSnapshot[String(m.device_no)] || null);
          const isOnline = vendorState.isOnline || m.is_online === true || m.isOnline === true || String(m.status || '').toUpperCase() === 'ONLINE';
          return { ...m, isOnline, vendorStatus: vendorState.vendorStatus, vendorStatusText: vendorState.vendorStatusText };
        });
        machineLocations.value = results;
        totalMachines.value = results.length;
        onlineCount.value = results.filter((m: any) => m.isOnline).length;
        offlineCount.value = totalMachines.value - onlineCount.value;
      }

      if (merchantId) {
        const [walletsRes, userIds] = await Promise.all([
          proxySelect('merchant_wallets', {
            select: 'user_id,total_weight,total_earnings,created_at,current_balance',
            eq: { merchant_id: merchantId },
            limit: 10000,
          }),
          fetchMerchantScopedUserIds(merchantId),
        ]);

        const wallets = walletsRes.data || [];
        totalWeight.value = wallets.reduce((sum: number, row: any) => sum + (Number(row.total_weight) || 0), 0);
        totalLifetimePoints.value = wallets.reduce((sum: number, row: any) => sum + (Number(row.total_earnings) || 0), 0);
        totalUsers.value = userIds.length;

        const [recentReviewsRes, recentUsersRes] = await Promise.all([
          proxySelect('submission_reviews', {
            select: 'id,user_id,api_weight,calculated_value,submitted_at,created_at',
            eq: { merchant_id: merchantId },
            order: { column: 'submitted_at', ascending: false },
            limit: 20,
          }),
          userIds.length > 0
            ? proxySelect('users', {
                select: 'id,nickName,user_id,phone,last_active_at,created_at',
                in: { id: userIds },
                limit: 10000,
              })
            : Promise.resolve({ data: [] }),
        ]);

        const usersById = new Map((recentUsersRes.data || []).map((u: any) => [u.id, u]));
        recentSubmissions.value = (recentReviewsRes.data || []).map((r: any) => {
          const user = usersById.get(r.user_id) || {};
          return {
            id: r.id,
            user_name: user.nickName || user.user_id || r.user_id,
            phone: user.phone || '',
            api_weight: r.api_weight || 0,
            calculated_value: r.calculated_value || 0,
            submitted_at: r.submitted_at || r.created_at || null,
          };
        });
      } else {
        const { count: uCount } = await proxySelect('users', { select: '*', count: true, head: true });
        totalUsers.value = uCount || 0;

        const { data: users } = await proxySelect('users', {
          select: 'total_weight,total_points',
          limit: 10000,
        });
        totalWeight.value = (users || []).reduce((sum: number, u: any) => sum + (Number(u.total_weight) || 0), 0);
        totalLifetimePoints.value = (users || []).reduce((sum: number, u: any) => sum + (Number(u.total_points) || 0), 0);

        const { data: recentUsers } = await proxySelect('users', {
          select: 'nickName,user_id,phone,total_weight,total_points,last_active_at',
          order: { column: 'last_active_at', ascending: false },
          limit: 20,
        });
        recentSubmissions.value = (recentUsers || []).map((u: any) => ({
          user_name: u.nickName || u.user_id,
          phone: u.phone || '',
          api_weight: u.total_weight || 0,
          calculated_value: u.total_points || 0,
          submitted_at: u.last_active_at || null,
        }));
      }
    } catch (err) {
      console.error('Init Error:', err);
    } finally {
      await fetchFilteredStats();
      loading.value = false;
    }
  }

  async function fetchFilteredStats() {
    const auth = useAuthStore();
    statsLoading.value = true;

    try {
      const merchantId = auth.merchantId || null;
      const startDateStr = getStartDate();

      if (merchantId) {
        const userIds = await fetchMerchantScopedUserIds(merchantId);
        const [walletsRes, withdrawalsRes, cleanDataRes, reviewsRes, usersRes] = await Promise.all([
          proxySelect('merchant_wallets', {
            select: 'user_id,total_weight,total_earnings,created_at',
            eq: { merchant_id: merchantId },
            limit: 10000,
          }),
          proxySelect('withdrawals', {
            select: 'amount,status,created_at',
            eq: { merchant_id: merchantId },
            limit: 10000,
          }),
          proxySelect('cleaning_records', {
            eq: { merchant_id: merchantId },
            order: { column: 'cleaned_at', ascending: false },
            limit: 50,
          }),
          proxySelect('submission_reviews', {
            select: 'user_id,api_weight,calculated_value,created_at,submitted_at,status',
            eq: { merchant_id: merchantId },
            limit: 10000,
          }),
          userIds.length > 0
            ? proxySelect('users', {
                select: 'id,created_at,nickName,user_id',
                in: { id: userIds },
                limit: 10000,
              })
            : Promise.resolve({ data: [] }),
        ]);

        let wallets = walletsRes.data || [];
        let withdrawals = withdrawalsRes.data || [];
        let reviews = reviewsRes.data || [];
        let users = usersRes.data || [];

        if (startDateStr) {
          wallets = wallets.filter((row: any) => !row.created_at || row.created_at >= startDateStr);
          withdrawals = withdrawals.filter((row: any) => !row.created_at || row.created_at >= startDateStr);
          reviews = reviews.filter((row: any) => (row.submitted_at || row.created_at || '') >= startDateStr);
          users = users.filter((row: any) => !row.created_at || row.created_at >= startDateStr);
        }

        summary.value.newUsers = users.length;
        summary.value.deliveryVolume = wallets.reduce((sum: number, row: any) => sum + (Number(row.total_weight) || 0), 0);
        summary.value.pointsGiven = wallets.reduce((sum: number, row: any) => sum + (Number(row.total_earnings) || 0), 0);
        summary.value.submissions = reviews.filter((row: any) => Number(row.api_weight) > 0).length;

        const wasteMap = new Map();
        reviews.forEach((row: any) => {
          const dateKey = (row.submitted_at || row.created_at || '').split('T')[0];
          if (!dateKey) return;
          if (!wasteMap.has(dateKey)) wasteMap.set(dateKey, { date: dateKey, delivery_weight: 0, delivery_count: 0, collection_weight: 0, collection_count: 0 });
          const entry = wasteMap.get(dateKey);
          entry.delivery_weight += Number(row.api_weight) || 0;
          if (Number(row.api_weight) > 0) entry.delivery_count += 1;
        });
        wasteTrends.value = Array.from(wasteMap.values()).sort((a: any, b: any) => a.date.localeCompare(b.date));

        const withdrawalMap = new Map();
        withdrawals.forEach((row: any) => {
          const dateKey = (row.created_at || '').split('T')[0];
          if (!dateKey) return;
          if (!withdrawalMap.has(dateKey)) withdrawalMap.set(dateKey, { date: dateKey, request_amount: 0, approved_amount: 0, applicants: 0 });
          const entry = withdrawalMap.get(dateKey);
          const amount = Number(row.amount) || 0;
          entry.request_amount += amount;
          if (String(row.status || '').toUpperCase() === 'APPROVED' || String(row.status || '').toUpperCase() === 'PAID') {
            entry.approved_amount += amount;
          }
          entry.applicants += 1;
        });
        withdrawalTrends.value = Array.from(withdrawalMap.values()).sort((a: any, b: any) => a.date.localeCompare(b.date));
        collectionLogs.value = cleanDataRes.data || [];
      } else {
        const { data: allUsers } = await proxySelect('users', { limit: 10000 });
        let filtered = allUsers || [];
        if (startDateStr) filtered = filtered.filter((u: any) => u.created_at >= startDateStr);

        summary.value.newUsers = filtered.length;
        if (timeFilter.value === 'all' && !startDateStr) {
          summary.value.deliveryVolume = totalWeight.value;
          summary.value.pointsGiven = totalLifetimePoints.value;
          summary.value.submissions = filtered.filter((u: any) => Number(u.total_weight) > 0).length;
        } else {
          summary.value.deliveryVolume = filtered.reduce((sum: number, u: any) => sum + (Number(u.total_weight) || 0), 0);
          summary.value.pointsGiven = filtered.reduce((sum: number, u: any) => sum + (Number(u.total_points) || 0), 0);
          summary.value.submissions = filtered.filter((u: any) => Number(u.total_weight) > 0).length;
        }

        const wasteMap = new Map();
        filtered.forEach((u: any) => {
          const dateKey = u.created_at ? u.created_at.split('T')[0] : null;
          if (!dateKey) return;
          if (!wasteMap.has(dateKey)) wasteMap.set(dateKey, { date: dateKey, delivery_weight: 0, delivery_count: 0, collection_weight: 0, collection_count: 0 });
          const entry = wasteMap.get(dateKey);
          entry.delivery_weight += Number(u.total_weight) || 0;
          if (Number(u.total_weight) > 0) entry.delivery_count += 1;
        });
        wasteTrends.value = Array.from(wasteMap.values()).sort((a: any, b: any) => a.date.localeCompare(b.date));

        withdrawalTrends.value = [];
        const { data: cleanData } = await proxySelect('cleaning_records', {
          order: { column: 'cleaned_at', ascending: false },
          limit: 50,
        });
        collectionLogs.value = cleanData || [];
      }
    } catch (e) {
      console.error('fetchFilteredStats error:', e);
    } finally {
      statsLoading.value = false;
    }
  }

  return {
    loading,
    statsLoading,
    timeFilter,
    dateRange,
    selectedMachineId,
    totalUsers,
    totalWeight,
    totalLifetimePoints,
    totalMachines,
    summary,
    machineLocations,
    onlineCount,
    offlineCount,
    wasteTrends,
    withdrawalTrends,
    recentSubmissions,
    collectionLogs,
    fetchInitialData,
    fetchFilteredStats,
  };
}
