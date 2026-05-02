import { ref } from 'vue';
import { proxy, proxySelect, proxyInsert, proxyUpdate, proxyDelete } from '../services/supabaseProxy';
import { WithdrawalStatus, type Withdrawal } from '../types';
import { useAuthStore } from '../stores/auth';

interface WithdrawalWithBundle extends Withdrawal {
  total_amount?: number;
  bundled_ids?: string[];
  sub_withdrawals?: any[];
  is_bundled?: boolean;
  merchant_name?: string;
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
    type: 'success' | 'error';
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

  // Cache for merchant names
  const merchantNames = ref<Record<string, string>>({});

  // Fetch merchant names
  const loadMerchantNames = async () => {
    try {
      const { data } = await proxy.from('merchants').select('id,name').run('select');
      if (data) {
        data.forEach((m: any) => {
          merchantNames.value[m.id] = m.name;
        });
      }
    } catch (e) {
      console.warn('Failed to load merchant names', e);
    }
  };

  // 1. Fetch Withdrawals via Proxy
  // Add new cash out record
  const createWithdrawal = async (userId: string, amount: number) => {
    const store = useAuthStore();
    await proxyInsert('withdrawals', {
      user_id: userId,
      merchant_id: store.merchantId || '11111111-1111-1111-1111-111111111111',
      amount: amount,
      status: 'PENDING',
    });
    await fetchWithdrawals();
  };

  const fetchWithdrawals = async () => {
    const auth = useAuthStore();

    if (auth.loading || !auth.role) {
      console.log("Withdrawals: Waiting for auth/role to be ready... loading:", auth.loading, "role:", auth.role);
      setTimeout(() => fetchWithdrawals(), 500);
      return;
    }

    loading.value = true;
    console.log("Withdrawals: Fetching with role:", auth.role);

    try {
      // Load merchant names first
      await loadMerchantNames();

      const params: any = {
        select: '*',
        order: { column: 'created_at', ascending: false }
      };

      // 🔥 SaaS Filter - VIEWER role can see ALL data
      if (auth.role !== 'VIEWER' && auth.merchantId) {
        params.eq = { merchant_id: auth.merchantId };
      }

      const { data, error } = await proxy.from('withdrawals').select('*').order('created_at', { ascending: false }).run('select');

      if (error) throw new Error(error);
      console.log("Withdrawals: Raw response - data:", data?.length, "records");

      if (!data) {
        withdrawals.value = [];
        return;
      }

      // Attach merchant names after fetch
      const records: WithdrawalWithBundle[] = data.map((item: any) => ({
        ...item,
        merchant_name: merchantNames.value[item.merchant_id] || 'Unknown'
      }));

      if (!auth.merchantId) {
        // SUPER ADMIN: Bundle split records
        const groups = new Map<string, WithdrawalWithBundle>();
        records.forEach((item) => {
          const timeKey = new Date(item.created_at).toISOString().split('.')[0];
          const key = `${item.user_id}_${timeKey}_${item.status}`;

          if (!groups.has(key)) {
            groups.set(key, {
              ...item,
              is_bundled: false,
              total_amount: Number(item.amount),
              bundled_ids: [item.id],
              sub_withdrawals: [item]
            });
          } else {
            const group = groups.get(key)!;
            group.is_bundled = true;
            group.total_amount = (group.total_amount || 0) + Number(item.amount);
            group.bundled_ids?.push(item.id);
            group.sub_withdrawals?.push(item);
            group.amount = Number((group.total_amount || 0).toFixed(2)) as any;
          }
        });
        withdrawals.value = Array.from(groups.values());
      } else {
        withdrawals.value = records;
      }
    } catch (error) {
      console.error("Failed to load withdrawals", error);
    } finally {
      loading.value = false;
    }
  };

  // 2. Update Status via Proxy
  const updateStatus = async (id: string, newStatus: WithdrawalStatus) => {
    if (!confirm(`Mark this request as ${newStatus}?`)) return;

    try {
      const target = withdrawals.value.find(w => w.id === id);
      const idsToUpdate = target?.bundled_ids || [id];

      // Batch update all IDs
      for (const wid of idsToUpdate) {
        await proxyUpdate('withdrawals', { status: newStatus }, { id: wid });
      }

      if (balanceResult.value?.id === id) {
        balanceResult.value = null;
      }
      await fetchWithdrawals();
    } catch (error) {
      alert("Failed to update status");
      console.error(error);
    }
  };

  // 3. Hybrid Balance Check via Proxy
  const checkBalance = async (withdrawal: WithdrawalWithBundle) => {
    const auth = useAuthStore();
    const userId = withdrawal.user_id;

    checkingBalanceId.value = withdrawal.id;
    balanceResult.value = null;

    try {
      const targetMerchantId = auth.merchantId || withdrawal.merchant_id;

      // Fetch total earnings from submission_reviews
      const earningsParams: any = {
        select: 'calculated_value',
        neq: { status: 'REJECTED' },
        eq: { user_id: userId }
      };
      if (targetMerchantId) {
        earningsParams.eq = { ...earningsParams.eq, merchant_id: targetMerchantId };
      }

      const { data: earningsData } = await proxy.from('submission_reviews')
        .select('calculated_value')
        .eq('user_id', userId)
        .neq('status', 'REJECTED')
        .run('select');

      const totalEarned = (earningsData || []).reduce((sum: number, r: any) => sum + Number(r.calculated_value || 0), 0);

      // Fetch total withdrawals
      const withdrawalsParams: any = {
        select: 'amount',
        neq: { status: 'REJECTED' },
        eq: { user_id: userId }
      };
      if (targetMerchantId) {
        withdrawalsParams.eq = { ...withdrawalsParams.eq, merchant_id: targetMerchantId };
      }

      const { data: withdrawalsData } = await proxy.from('withdrawals')
        .select('amount')
        .neq('status', 'REJECTED')
        .eq('user_id', userId)
        .run('select');

      const totalWithdrawn = (withdrawalsData || []).reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);

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

  // 4. Verify Live Balance
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

  // 5. Batch Sync
  const isBatchSyncing = ref(false);

  const prepareSync = async () => {
    const { data, error } = await proxy.from('users')
      .select('id')
      .neq('phone', null)
      .run('select');

    if (error) {
        syncStatus.value = { isOpen: true, type: 'error', title: 'Error', message: 'Database connection failed.' };
        return;
    }

    syncConfirm.value = {
        isOpen: true,
        title: 'Start Global Audit?',
        message: `This will scan ALL ${(data || []).length || 0} registered users for external spending on AutoGCM machines.\n\nThis process may take a minute.`
    };
  };

  const executeSync = async () => {
    isBatchSyncing.value = true;

    let updates = 0;
    let verified = 0;
    let processedCount = 0;

    try {
      console.log("🚀 Starting Bulk Audit...");

      const { data: allUsers, error } = await proxy.from('users')
        .select('id,phone')
        .neq('phone', null)
        .run('select');

      if (error || !allUsers) throw new Error("No users found");

      // Map to the format expected by the batch API
      const usersForApi = allUsers.map((u: any) => ({ userId: u.id, phone: u.phone }));
      const totalUsers = usersForApi.length;

      // BATCHING LOGIC
      const BATCH_SIZE = 10;

      for (let i = 0; i < totalUsers; i += BATCH_SIZE) {
          const batch = usersForApi.slice(i, i + BATCH_SIZE);

          syncConfirm.value.message = `Processing Batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(totalUsers/BATCH_SIZE)}...\n(${processedCount}/${totalUsers} users checked)`;

          try {
              const response = await fetch('/api/batch-sync-balance', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ users: batch })
              });

              const { results } = await response.json();

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

    console.log("🏁 Audit Complete.");

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
    createWithdrawal,
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
