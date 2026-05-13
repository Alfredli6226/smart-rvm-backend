// src/composables/useCleaningRecords.ts
import { ref } from 'vue';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/auth';

export interface CleaningRecord {
    id: string;
    device_no: string;
    waste_type: string;
    bag_weight_collected: number;
    cleaned_at: string;
    cleaner_name: string;
    status: 'PENDING' | 'VERIFIED' | 'REJECTED';
    photo_url?: string;
    admin_note?: string;
    // Live data fields
    is_live?: boolean;
    phone?: string;
}

export function useCleaningRecords() {
    const records = ref<CleaningRecord[]>([]);
    const loading = ref(false);

    // 1. Fetch Logs - combines cleaning_records + live submission_reviews data
    const fetchCleaningLogs = async () => {
        const auth = useAuthStore();
        
        if (auth.loading || !auth.role) {
            console.log("CleaningRecords: Waiting for auth/role...");
            return;
        }
        
        loading.value = true;
        try {
            console.log("CleaningRecords: Fetching live data...");
            
            // Fetch actual cleaning records
            const { data: cleanData, error: cleanError } = await supabase
                .from('cleaning_records')
                .select('*')
                .order('cleaned_at', { ascending: false })
                .limit(100);

            if (cleanError) console.error("CleaningRecords: Error:", cleanError);
            
            const cleanRecords: CleaningRecord[] = (cleanData || []).map((r: any) => ({
                id: r.id,
                device_no: r.device_no || '-',
                waste_type: r.waste_type || 'Mixed',
                bag_weight_collected: Number(r.bag_weight_collected || 0),
                cleaned_at: r.cleaned_at || r.created_at,
                cleaner_name: r.cleaner_name || 'System',
                status: r.status || 'VERIFIED',
                photo_url: r.photo_url,
                admin_note: r.admin_note,
                is_live: false
            }));

            // Also fetch live submission reviews as waste disposal records
            const { data: submissions, error: subError } = await supabase
                .from('submission_reviews')
                .select('id, device_no, waste_type, api_weight, calculated_value, submitted_at, phone, photo_url, status')
                .order('submitted_at', { ascending: false })
                .limit(200);

            if (subError) console.error("CleaningRecords: Submission fetch error:", subError);

            const subRecords: CleaningRecord[] = (submissions || []).map((s: any) => ({
                id: `sub-${s.id}`,
                device_no: s.device_no || '-',
                waste_type: s.waste_type || 'Recyclable',
                bag_weight_collected: Number(s.api_weight || 0),
                cleaned_at: s.submitted_at || new Date().toISOString(),
                cleaner_name: s.phone ? `User: ${s.phone.substring(0, 8)}...` : 'Unknown',
                status: s.status === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
                photo_url: s.photo_url || '',
                is_live: true,
                phone: s.phone
            }));

            // Merge both arrays, sorted by time (newest first)
            const merged = [...cleanRecords, ...subRecords].sort((a, b) => 
                new Date(b.cleaned_at).getTime() - new Date(a.cleaned_at).getTime()
            );

            records.value = merged;

            if (records.value.length === 0) {
                console.log('[CleaningRecords] No data found from any source');
            } else {
                console.log(`[CleaningRecords] Loaded ${records.value.length} records (${cleanRecords.length} cleaning, ${subRecords.length} live submissions)`);
            }
            
        } catch (err) {
            console.error("Error fetching logs:", err);
        } finally {
            loading.value = false;
        }
    };

    // 2. Approve
    const approveCleaning = async (id: string) => {
        if (id.startsWith('sub-')) return; // Can't approve live submissions
        const { error } = await supabase
            .from('cleaning_records')
            .update({ status: 'VERIFIED' })
            .eq('id', id);
        if (!error) await fetchCleaningLogs();
    };

    // 3. Reject
    const rejectCleaning = async (id: string, reason: string) => {
        if (id.startsWith('sub-')) return; // Can't reject live submissions
        const { error } = await supabase
            .from('cleaning_records')
            .update({ status: 'REJECTED', admin_note: reason })
            .eq('id', id);
        if (!error) await fetchCleaningLogs();
    };

    // 4. Helper
    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('en-MY', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return {
        records,
        loading,
        fetchCleaningLogs,
        approveCleaning,
        rejectCleaning,
        formatDate
    };
}
