import { ref, computed } from 'vue';
import { proxy } from '../services/supabaseProxy';

export interface CollectorSummary {
  collector_id: string;
  total_weight: number;
  total_quantity: number;
  total_value: number;
}

export interface LocationSummary {
  location: string;
  total_weight: number;
  total_quantity: number;
  total_value: number;
}

export interface CollectionLog {
  id: string;
  collector_id: string;
  device_no: string;
  waste_type: string;
  weight: number;
  value: number;
  timestamp: string;
  status: string;
}

export function useCollectionReports() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  const collectionSummary = ref<{
    total_collected: { weight: number; quantity: number; value: number };
    by_collector: CollectorSummary[];
    by_location: LocationSummary[];
  } | null>(null);
  
  const collectorLogs = ref<CollectionLog[]>([]);
  
  const filters = ref({
    startDate: '',
    endDate: '',
    collectorId: '',
    location: '',
    groupBy: 'collector' as 'collector' | 'location'
  });

  const currentPage = ref(1);
  const itemsPerPage = ref(10);
  const totalLogs = ref(0);

  const paginatedLogs = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    return collectorLogs.value.slice(start, start + itemsPerPage.value);
  });

  const totalPages = computed(() => Math.ceil(collectorLogs.value.length / itemsPerPage.value));

  const fetchCollectionSummary = async () => {
    loading.value = true;
    error.value = null;
    
    try {
      let query = proxy
        .from('submission_reviews')
        .select('*');

      if (filters.value.startDate) {
        query = query.gte('submitted_at', filters.value.startDate);
      }
      if (filters.value.endDate) {
        query = query.lte('submitted_at', filters.value.endDate + 'T23:59:59');
      }

      const { data: reviews, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const byCollector: Record<string, { collector_id: string, total_weight: number, total_quantity: number, total_value: number }> = {};
      const byLocation: Record<string, { location: string, total_weight: number, total_quantity: number, total_value: number }> = {};

      if (reviews) {
        for (const r of reviews) {
          const collectorId = r.user_id || 'unknown';
          if (!byCollector[collectorId]) {
            byCollector[collectorId] = { collector_id: collectorId, total_weight: 0, total_quantity: 0, total_value: 0 };
          }
          byCollector[collectorId].total_weight += Number(r.api_weight) || 0;
          byCollector[collectorId].total_quantity += 1;
          byCollector[collectorId].total_value += Number(r.calculated_value) || 0;

          const location = r.device_no || 'unknown';
          if (!byLocation[location]) {
            byLocation[location] = { location, total_weight: 0, total_quantity: 0, total_value: 0 };
          }
          byLocation[location].total_weight += Number(r.api_weight) || 0;
          byLocation[location].total_quantity += 1;
          byLocation[location].total_value += Number(r.calculated_value) || 0;
        }
      }

      const totalWeight = Object.values(byCollector).reduce((sum, c) => sum + c.total_weight, 0);
      const totalQuantity = Object.values(byCollector).reduce((sum, c) => sum + c.total_quantity, 0);
      const totalValue = Object.values(byCollector).reduce((sum, c) => sum + c.total_value, 0);

      collectionSummary.value = {
        total_collected: {
          weight: totalWeight,
          quantity: totalQuantity,
          value: totalValue
        },
        by_collector: Object.values(byCollector),
        by_location: Object.values(byLocation)
      };
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch collection data';
    } finally {
      loading.value = false;
    }
  };

  const fetchCollectorLogs = async (page = 1) => {
    loading.value = true;
    currentPage.value = page;
    
    try {
      const offset = (page - 1) * itemsPerPage.value;
      
      let query = proxy
        .from('submission_reviews')
        .select('id, user_id, device_no, waste_type, api_weight, calculated_value, submitted_at, status')
        .order('submitted_at', { ascending: false })
        .range(offset, offset + itemsPerPage.value - 1);

      if (filters.value.startDate) {
        query = query.gte('submitted_at', filters.value.startDate);
      }
      if (filters.value.endDate) {
        query = query.lte('submitted_at', filters.value.endDate + 'T23:59:59');
      }
      if (filters.value.collectorId) {
        query = query.eq('user_id', filters.value.collectorId);
      }
      if (filters.value.location) {
        query = query.eq('device_no', filters.value.location);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      collectorLogs.value = (data || []).map(log => ({
        id: log.id,
        collector_id: log.user_id,
        device_no: log.device_no,
        waste_type: log.waste_type,
        weight: log.api_weight,
        value: log.calculated_value,
        timestamp: log.submitted_at,
        status: log.status
      }));
      
      totalLogs.value = collectorLogs.value.length;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch collector logs';
    } finally {
      loading.value = false;
    }
  };

  const fetchAll = async () => {
    await Promise.all([
      fetchCollectionSummary(),
      fetchCollectorLogs(1)
    ]);
  };

  const clearFilters = () => {
    filters.value = {
      startDate: '',
      endDate: '',
      collectorId: '',
      location: '',
      groupBy: 'collector'
    };
    fetchAll();
  };

  const applyFilters = () => {
    fetchAll();
  };

  const exportToCsv = () => {
    if (!collectionSummary.value) return;

    const { by_collector, by_location, total_collected } = collectionSummary.value;
    
    let csvContent = 'Collection Report Export\n';
    csvContent += `Generated: ${new Date().toISOString()}\n\n`;
    
    csvContent += `Total Collected\n`;
    csvContent += `Weight,Quantity,Value\n`;
    csvContent += `${total_collected.weight.toFixed(2)},${total_collected.quantity},${total_collected.value.toFixed(2)}\n\n`;

    if (filters.value.groupBy === 'collector') {
      csvContent += 'By Collector\n';
      csvContent += 'Collector ID,Total Weight,Total Quantity,Total Value\n';
      by_collector.forEach(c => {
        csvContent += `${c.collector_id},${c.total_weight.toFixed(2)},${c.total_quantity},${c.total_value.toFixed(2)}\n`;
      });
    } else {
      csvContent += 'By Location\n';
      csvContent += 'Location,Total Weight,Total Quantity,Total Value\n';
      by_location.forEach(l => {
        csvContent += `${l.location},${l.total_weight.toFixed(2)},${l.total_quantity},${l.total_value.toFixed(2)}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `collection-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return {
    loading,
    error,
    collectionSummary,
    collectorLogs,
    filters,
    currentPage,
    itemsPerPage,
    totalLogs,
    paginatedLogs,
    totalPages,
    fetchCollectionSummary,
    fetchCollectorLogs,
    fetchAll,
    clearFilters,
    applyFilters,
    exportToCsv
  };
}