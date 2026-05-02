import { ref } from 'vue';
import { getUserRecords, syncUserAccount } from '../services/autogcm';
import { proxyInsert, proxySelect, proxyUpdate } from '../services/supabaseProxy';
import { useAuthStore } from '../stores/auth';
import { detectWasteType } from '../utils/wasteUtils'; // Helper needed for waste type detection
import type { User, Withdrawal, SubmissionReview } from '../types';

export function useUserProfile(userId: string) {
  const auth = useAuthStore();
  const user = ref<User | null>(null);
  // 🔥 CHANGED: Now holds local SubmissionReviews, not ApiDisposalRecords
  const recyclingHistory = ref<SubmissionReview[]>([]);
  const withdrawalHistory = ref<Withdrawal[]>([]);
  
  const loading = ref(true);
  const isSyncing = ref(false);

  // AUDIT STATE
  const auditResult = ref({
    totalEarned: 0,
    totalWithdrawn: 0,
    currentBalance: 0,
  });

  // 1. FETCH DATA (Read from Local DB only)
  const fetchProfile = async () => {
    loading.value = true;
    try {
      const isPlatformOwner = auth.role === 'SUPER_ADMIN' && !auth.merchantId;

      if (isPlatformOwner) {
        const [userRes, withdrawalsRes, reviewsRes] = await Promise.all([
          proxySelect('users', { select: '*', eq: { id: userId }, single: true }),
          proxySelect('withdrawals', { select: '*', eq: { user_id: userId }, order: { column: 'created_at', ascending: false }, limit: 10000 }),
          proxySelect('submission_reviews', { select: '*, merchants(currency_symbol)', eq: { user_id: userId }, order: { column: 'submitted_at', ascending: false }, limit: 10000 }),
        ]);

        user.value = (userRes.data || null) as User | null;
        withdrawalHistory.value = (withdrawalsRes.data as Withdrawal[]) || [];
        recyclingHistory.value = (reviewsRes.data as SubmissionReview[]) || [];
      } else if (auth.merchantId) {
        const [walletsRes, withdrawalsRes, reviewsRes] = await Promise.all([
          proxySelect('merchant_wallets', { select: '*', eq: { merchant_id: auth.merchantId, user_id: userId }, limit: 10 }),
          proxySelect('withdrawals', { select: '*', eq: { merchant_id: auth.merchantId, user_id: userId }, order: { column: 'created_at', ascending: false }, limit: 10000 }),
          proxySelect('submission_reviews', { select: '*, merchants(currency_symbol)', eq: { merchant_id: auth.merchantId, user_id: userId }, order: { column: 'submitted_at', ascending: false }, limit: 10000 }),
        ]);

        const hasAccess = (walletsRes.data || []).length > 0 || (withdrawalsRes.data || []).length > 0 || (reviewsRes.data || []).length > 0;
        if (!hasAccess) {
          user.value = null;
          withdrawalHistory.value = [];
          recyclingHistory.value = [];
          return;
        }

        const userRes = await proxySelect('users', { select: '*', eq: { id: userId }, single: true });
        user.value = (userRes.data || null) as User | null;
        withdrawalHistory.value = (withdrawalsRes.data as Withdrawal[]) || [];
        recyclingHistory.value = (reviewsRes.data as SubmissionReview[]) || [];
      } else {
        user.value = null;
        withdrawalHistory.value = [];
        recyclingHistory.value = [];
      }

      // D. Calculate Balance (Only VERIFIED counts)
      calculateBalance();

    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      loading.value = false;
    }
  };

  // 2. CALCULATE BALANCE
  const calculateBalance = () => {
      // Sum only VERIFIED transactions
      const totalEarned = recyclingHistory.value
        .filter(r => r.status === 'VERIFIED')
        .reduce((sum, r) => sum + Number(r.calculated_value || 0), 0);
      
      const totalWithdrawn = withdrawalHistory.value
        .filter(w => w.status !== 'REJECTED')
        .reduce((sum, w) => sum + Number(w.amount || 0), 0);
      
      const balance = totalEarned - totalWithdrawn;
      
      auditResult.value = {
          totalEarned: parseFloat(totalEarned.toFixed(2)),
          totalWithdrawn: parseFloat(totalWithdrawn.toFixed(2)),
          currentBalance: parseFloat(balance.toFixed(2))
      };
  };

  // 3. SMART SYNC (The "Mini-Harvester")
  // src/composables/useUserProfile.ts

  // ... inside useUserProfile function ...

  const syncData = async () => {
    if (!user.value) return;
    isSyncing.value = true;

    try {
      console.log("🔄 Starting Mini-Harvest for User...");

      // A. Fetch Raw Data from China
      const apiAccount = await syncUserAccount(user.value.phone);
      // 🔥 INCREASED LIMIT TO 50
      const apiRecords = await getUserRecords(user.value.phone, 1, 50); 

      if (apiRecords && apiRecords.length > 0) {
        
        // B. Pre-load Machine Map (With Rates from MACHINES table)
        const deviceNos = [...new Set(apiRecords.map((r: any) => r.deviceNo))];
        const { data: machines } = await proxySelect('machines', {
            select: 'device_no, merchant_id, rate_plastic, rate_can, rate_paper, rate_uco, rate_glass, config_bin_1, config_bin_2',
            in: { device_no: deviceNos },
            limit: 10000,
        });
            
        const machineMap: Record<string, any> = {};
        machines?.forEach(m => {
            if(m.device_no) machineMap[m.device_no] = m;
        });

        // C. Loop and Insert Missing Records
        for (const record of apiRecords) {
            // Check if exists
            const exists = recyclingHistory.value.find(r => r.vendor_record_id === record.id);
            if (exists) continue;

            // Resolve Machine
            const machine = machineMap[record.deviceNo];
            if (!machine) {
                console.warn(`Skipping record from unassigned machine: ${record.deviceNo}`);
                continue;
            }

            // Calculate Value (Updated SaaS Logic)
            const weight = Number(record.weight || 0);
            let wasteType = 'Plastic';
            if (record.rubbishLogDetailsVOList?.[0]) {
                 wasteType = detectWasteType(record.rubbishLogDetailsVOList[0].rubbishName);
            }

            // 🔥 ROBUST RATE MATCHING (Copied from Harvester)
            let rate = 0;
            const typeKey = wasteType.toLowerCase();

            if (typeKey.includes('paper') || typeKey.includes('kertas')) {
                rate = Number(machine.rate_paper || 0);
            } 
            else if (typeKey.includes('uco') || typeKey.includes('oil') || typeKey.includes('minyak')) {
                rate = Number(machine.rate_uco || 0);
            }
            else if (typeKey.includes('glass') || typeKey.includes('kaca')) {
                rate = Number(machine.rate_glass || 0);
            }
            else if (typeKey.includes('plastic') || typeKey.includes('plastik') || typeKey.includes('botol')) {
                rate = Number(machine.rate_plastic || 0);
            }
            else if (typeKey.includes('can') || typeKey.includes('tin') || typeKey.includes('aluminium')) {
                rate = Number(machine.rate_can || 0);
            }

            const calculatedValue = weight * rate;

            // Insert as MANUAL_SYNC
            await proxyInsert('submission_reviews', {
                vendor_record_id: record.id,
                user_id: user.value.id,
                phone: user.value.phone,
                merchant_id: machine.merchant_id,
                device_no: record.deviceNo,
                waste_type: wasteType,
                api_weight: weight,
                calculated_value: calculatedValue,
                rate_per_kg: rate,
                photo_url: record.imgUrl,
                submitted_at: record.createTime,
                status: 'PENDING', 
                source: 'MANUAL_SYNC'
            });
        }
      }

      // D. Update User Metadata
      if (apiAccount) {
          // Prepare update object
          const updates: any = {
             last_synced_at: new Date().toISOString(),
             nickname: apiAccount.nikeName || apiAccount.name || user.value.nickname, 
             avatar_url: apiAccount.imgUrl || user.value.avatar_url,
             
             // ✅ FIX: Save the Vendor IDs from the API response
             vendor_user_no: apiAccount.userNo, 
             
             // Assuming vendor_internal_id is also mapped to userNo (based on your existing data)
             // or if it comes from the record list, you could use apiRecords[0]?.userId
             vendor_internal_id: apiAccount.userNo 
          };

          await proxyUpdate('users', updates, { id: userId });
      }

      // E. Refresh View
      await fetchProfile();

    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      isSyncing.value = false;
    }
  };

  fetchProfile();

  return { 
    user, 
    recyclingHistory, // Renamed from disposalHistory
    withdrawalHistory, 
    loading, 
    isSyncing, 
    syncData,
    auditResult 
  };
}
