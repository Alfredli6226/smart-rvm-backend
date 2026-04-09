import { ref, computed } from 'vue';
import { supabase } from '../services/supabase';

export interface MaintenanceRecord {
  id: string;
  machine_id: string;
  issue_description: string;
  technician_name: string;
  cost_of_repair: number;
  maintenance_date: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  photo_url?: string;
  notes?: string;
}

export interface MaintenanceSummary {
  completed: number;
  pending: number;
  rejected: number;
  total: number;
}

export function useMaintenanceReports() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  const records = ref<MaintenanceRecord[]>([]);
  const summary = ref<MaintenanceSummary | null>(null);
  
  const filters = ref({
    startDate: '',
    endDate: '',
    status: '' as '' | 'PENDING' | 'VERIFIED' | 'REJECTED',
    machineId: ''
  });

  const currentPage = ref(1);
  const itemsPerPage = ref(10);
  const totalRecords = ref(0);

  const paginatedRecords = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    return records.value.slice(start, start + itemsPerPage.value);
  });

  const totalPages = computed(() => Math.ceil(records.value.length / itemsPerPage.value));

  const fetchSummary = async () => {
    try {
      const { data: allRecords, error: fetchError } = await supabase
        .from('cleaning_records')
        .select('status');

      if (fetchError) throw fetchError;

      const completed = (allRecords || []).filter(r => r.status === 'VERIFIED').length;
      const pending = (allRecords || []).filter(r => r.status === 'PENDING').length;
      const rejected = (allRecords || []).filter(r => r.status === 'REJECTED').length;

      summary.value = {
        completed,
        pending,
        rejected,
        total: (allRecords || []).length
      };
    } catch (err: any) {
      console.error('[MaintenanceReports] Summary error:', err);
    }
  };

  const fetchReports = async (page = 1) => {
    loading.value = true;
    error.value = null;
    currentPage.value = page;
    
    try {
      const offset = (page - 1) * itemsPerPage.value;
      
      let query = supabase
        .from('cleaning_records')
        .select('*', { count: 'exact' })
        .order('cleaned_at', { ascending: false })
        .range(offset, offset + itemsPerPage.value - 1);

      if (filters.value.startDate) {
        query = query.gte('cleaned_at', filters.value.startDate);
      }
      if (filters.value.endDate) {
        query = query.lte('cleaned_at', filters.value.endDate + 'T23:59:59');
      }
      if (filters.value.status) {
        query = query.eq('status', filters.value.status);
      }
      if (filters.value.machineId) {
        query = query.eq('device_no', filters.value.machineId);
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      records.value = (data || []).map(r => ({
        id: r.id,
        machine_id: r.device_no,
        issue_description: r.waste_type || 'General maintenance',
        technician_name: r.cleaner_name || 'Unassigned',
        cost_of_repair: r.bag_weight_collected || 0,
        maintenance_date: r.cleaned_at,
        status: r.status,
        photo_url: r.photo_url,
        notes: r.admin_note
      }));
      
      totalRecords.value = count || 0;
      
      // Also fetch summary
      await fetchSummary();
    } catch (err: any) {
      console.error('[MaintenanceReports] Error:', err);
      error.value = err.message || 'Failed to fetch maintenance reports';
    } finally {
      loading.value = false;
    }
  };

  const fetchAll = async () => {
    await fetchReports(1);
  };

  const updateStatus = async (id: string, status: string, note?: string) => {
    try {
      const { error: updateError } = await supabase
        .from('cleaning_records')
        .update({ status, admin_note: note })
        .eq('id', id);

      if (updateError) throw updateError;
      
      await fetchReports(currentPage.value);
      return true;
    } catch (err) {
      console.error('Failed to update status:', err);
      return false;
    }
  };

  const clearFilters = () => {
    filters.value = { startDate: '', endDate: '', status: '', machineId: '' };
    fetchAll();
  };

  const applyFilters = () => {
    fetchAll();
  };

  const exportToCsv = () => {
    let csvContent = 'Maintenance Report Export\n';
    csvContent += `Generated: ${new Date().toISOString()}\n\n`;
    
    csvContent += `Summary\n`;
    csvContent += `Status,Count\n`;
    csvContent += `Completed,${summary.value?.completed || 0}\n`;
    csvContent += `Pending,${summary.value?.pending || 0}\n`;
    csvContent += `Rejected,${summary.value?.rejected || 0}\n\n`;
    
    csvContent += 'Details\n';
    csvContent += 'Machine ID,Issue,Technician,Cost,Date,Status\n';
    records.value.forEach(r => {
      csvContent += `${r.machine_id},"${r.issue_description}",${r.technician_name},${r.cost_of_repair},${r.maintenance_date},${r.status}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `maintenance-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return {
    loading,
    error,
    records,
    summary,
    filters,
    currentPage,
    itemsPerPage,
    totalRecords,
    paginatedRecords,
    totalPages,
    fetchReports,
    fetchAll,
    updateStatus,
    clearFilters,
    applyFilters,
    exportToCsv
  };
}