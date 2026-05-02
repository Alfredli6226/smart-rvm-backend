<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { useMachineStore } from '../stores/machines';
import { useCollectionReports } from '../composables/useCollectionReports';
import { useMaintenanceReports } from '../composables/useMaintenanceReports';
import { useAuthStore } from '../stores/auth';
import { storeToRefs } from 'pinia';
import { ChevronRight, FileText, Calendar, Search, User, Download, RefreshCw } from 'lucide-vue-next';

const machineStore = useMachineStore();
const authStore = useAuthStore();
const { machines, loading: machinesLoading } = storeToRefs(machineStore);
const { loading: authLoading } = storeToRefs(authStore);

// Create composable instances
const collectionReports = useCollectionReports();
const maintenanceReports = useMaintenanceReports();

// Use the same instance for all operations
const {
  loading: collectionLoading,
  error: collectionError,
  collectionSummary,
  collectorLogs,
  filters: collectionFilters,
  currentPage: collectionPage,
  itemsPerPage,
  totalLogs,
  paginatedLogs,
  totalPages: collectionTotalPages,
  fetchAll: fetchCollectionData,
  clearFilters: clearCollectionFilters,
  applyFilters: applyCollectionFilters,
  exportToCsv: exportCollectionCsv,
  fetchCollectorLogs
} = collectionReports;

const {
  loading: maintenanceLoading,
  records: maintenanceRecords,
  summary: maintenanceSummary,
  filters: maintenanceFilters,
  currentPage: maintenancePage,
  totalRecords,
  paginatedRecords,
  totalPages: maintenanceTotalPages,
  fetchAll: fetchMaintenanceData,
  clearFilters: clearMaintenanceFilters,
  applyFilters: applyMaintenanceFilters,
  exportToCsv: exportMaintenanceCsv
} = maintenanceReports;

const activeTab = ref('Collection');

const tabs = [
  { id: 'Collection', label: 'Collection' },
  { id: 'Maintenance', label: 'Maintenance' },
  { id: 'Collector Logs', label: 'Collector Logs' },
  { id: 'Financials', label: 'Financials' }
];

const groupByOptions = [
  { value: 'collector', label: 'By Collector' },
  { value: 'location', label: 'By Location' }
];

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'VERIFIED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' }
];

const loading = computed(() => {
  if (activeTab.value === 'Collection') return collectionLoading.value;
  if (activeTab.value === 'Maintenance') return maintenanceLoading.value;
  if (activeTab.value === 'Financials') return financialLoading.value;
  return false;
});

const activeError = computed(() => {
  if (activeTab.value === 'Collection') return collectionError.value;
  if (activeTab.value === 'Maintenance') return null;
  if (activeTab.value === 'Financials') return financialError.value;
  return null;
});

const clearFiltersLocal = () => {
  if (activeTab.value === 'Collection') {
    collectionFilters.value = {
      startDate: '',
      endDate: '',
      collectorId: '',
      location: '',
      groupBy: 'collector'
    };
    fetchCollectionData();
  } else if (activeTab.value === 'Maintenance') {
    maintenanceFilters.value = { startDate: '', endDate: '', status: '', machineId: '' };
    fetchMaintenanceData();
  } else if (activeTab.value === 'Financials') {
    financialFilters.value = { startDate: '', endDate: '' };
    fetchFinancialData();
  }
};

const applyFilters = () => {
  if (activeTab.value === 'Collection') {
    applyCollectionFilters();
  } else if (activeTab.value === 'Maintenance') {
    applyMaintenanceFilters();
  } else if (activeTab.value === 'Financials') {
    fetchFinancialData();
  }
};

const handleExport = () => {
  if (activeTab.value === 'Collection') {
    exportCollectionCsv();
  } else if (activeTab.value === 'Maintenance') {
    exportMaintenanceCsv();
  } else if (activeTab.value === 'Financials') {
    exportFinancialCsv();
  }
};

const handlePageChange = (page: number) => {
  if (activeTab.value === 'Collector Logs') {
    fetchCollectorLogs(page);
  } else if (activeTab.value === 'Maintenance') {
    maintenanceReports.fetchReports(page);
  } else if (activeTab.value === 'Financials') {
    financialCurrentPage.value = page;
  }
};

const currentFilters = computed(() => {
  if (activeTab.value === 'Maintenance') return maintenanceFilters.value;
  if (activeTab.value === 'Financials') return financialFilters.value;
  return collectionFilters.value;
});

// Financials specific
const financialLoading = ref(false);
const financialError = ref<string | null>(null);
const financialTransactions = ref<FinancialTransaction[]>([]);
const financialFilters = ref({
  startDate: '',
  endDate: ''
});
const financialCurrentPage = ref(1);
const financialItemsPerPage = ref(20);
const financialTotalRecords = ref(0);

const paginatedFinancialTransactions = computed(() => {
  const start = (financialCurrentPage.value - 1) * financialItemsPerPage.value;
  return processedFinancialTransactions.value.slice(start, start + financialItemsPerPage.value);
});

const totalFinancialPages = computed(() => Math.ceil(processedFinancialTransactions.value.length / financialItemsPerPage.value));

const totalIncome = computed(() => {
  return processedFinancialTransactions.value
    .filter(t => t.category === 'Income')
    .reduce((sum, t) => sum + t.amount, 0);
});

const totalExpenses = computed(() => {
  return processedFinancialTransactions.value
    .filter(t => t.category === 'Expense')
    .reduce((sum, t) => sum + t.amount, 0);
});

const netBalance = computed(() => {
  return totalIncome.value - totalExpenses.value;
});

const getRunningBalance = (paginatedIndex: number): number => {
  const offset = (financialCurrentPage.value - 1) * financialItemsPerPage.value;
  const actualIndex = offset + paginatedIndex;
  let balance = 0;
  for (let i = 0; i <= actualIndex; i++) {
    const t = processedFinancialTransactions.value[i];
    if (t) {
      balance += t.category === 'Income' ? t.amount : -t.amount;
    }
  }
  return balance;
};

interface FinancialTransaction {
  date: string;
  category: 'Income' | 'Expense';
  type: string;
  description: string;
  amount: number;
  reference_id?: string;
}

// Raw transaction data from different sources
interface RawTransaction {
  date: string;
  amount: number;
  type: string;
  description: string;
  reference_id?: string;
}

// Computed property that takes raw data array and calculates running balance
const processedFinancialTransactions = computed(() => {
  // Combine all raw transactions
  const allTransactions: RawTransaction[] = [];

  // Add collection income (from collector logs)
  collectorLogs.value.forEach(log => {
    if (log.status === 'VERIFIED') {
      allTransactions.push({
        date: log.timestamp,
        amount: log.value || 0,
        type: 'Income',
        description: `Collection - ${log.waste_type} (${log.device_no})`,
        reference_id: log.id
      });
    }
  });

  // Add maintenance expenses (from maintenance records)
  maintenanceRecords.value.forEach(record => {
    allTransactions.push({
      date: record.maintenance_date,
      amount: record.cost_of_repair || 0,
      type: 'Expense',
      description: `Maintenance - ${record.issue_description?.substring(0, 50) || ''}`,
      reference_id: record.id
    });
  });

  // Note: Withdrawals would be added here if accessible

  // Sort by date (oldest first) for running balance calculation
  allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate running balance
  let runningBalance = 0;
  const processed: FinancialTransaction[] = allTransactions.map(transaction => {
    const isIncome = transaction.type === 'Income';
    runningBalance += isIncome ? transaction.amount : -transaction.amount;
    const dateStr = transaction.date ? new Date(transaction.date).toISOString().split('T')[0] : new Date(0).toISOString().split('T')[0];

    return {
      date: dateStr as string,
      category: isIncome ? 'Income' : 'Expense',
      type: transaction.type,
      description: transaction.description,
      amount: transaction.amount,
      reference_id: transaction.reference_id
    };
  });

  // Apply date filter if present
  if (financialFilters.value.startDate || financialFilters.value.endDate) {
    return processed.filter(t => {
      const date = t.date;
      if (financialFilters.value.startDate && date < financialFilters.value.startDate) return false;
      if (financialFilters.value.endDate && date > financialFilters.value.endDate) return false;
      return true;
    });
  }

  return processed;
});

const fetchFinancialData = async () => {
  financialLoading.value = true;
  financialError.value = null;

  try {
    // Fetch collector logs and maintenance records in parallel
    await Promise.all([
      collectionReports.fetchCollectorLogs(1),
      maintenanceReports.fetchAll()
    ]);

    // Set total count after data is loaded
    financialTotalRecords.value = processedFinancialTransactions.value.length;
    financialCurrentPage.value = 1;
  } catch (err: any) {
    financialError.value = err.message || 'Failed to fetch financial data';
  } finally {
    financialLoading.value = false;
  }
};

const exportFinancialCsv = () => {
  const transactions = processedFinancialTransactions.value;
  if (!transactions.length) return;

  let csvContent = 'Financial Transactions Report\n';
  csvContent += `Generated: ${new Date().toISOString()}\n\n`;
  csvContent += 'Date,Category,Type,Description,Amount,Running Balance\n';

  let runningBalance = 0;
  transactions.forEach(t => {
    runningBalance += t.category === 'Income' ? t.amount : -t.amount;
    csvContent += `${t.date},${t.category},${t.type},"${t.description}",${t.amount.toFixed(2)},${runningBalance.toFixed(2)}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `financial-transactions-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};

onMounted(async () => {
  // Wait for auth to be ready
  while (authLoading.value) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Fetch machines
  await machineStore.fetchMachines();

  if (activeTab.value === 'Collection') {
    fetchCollectionData();
  } else if (activeTab.value === 'Maintenance') {
    fetchMaintenanceData();
  } else if (activeTab.value === 'Financials') {
    fetchFinancialData();
  }
});

watch(activeTab, (newTab) => {
  if (newTab === 'Collection') {
    fetchCollectionData();
  } else if (newTab === 'Maintenance') {
    fetchMaintenanceData();
  } else if (newTab === 'Financials') {
    fetchFinancialData();
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header Section -->
    <div class="bg-white border-b border-gray-200 px-6 py-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <span>Dashboard</span>
            <ChevronRight :size="16" />
            <span class="text-gray-900">Reports</span>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">System Reports</h1>
        </div>
        <button 
          @click="handleExport"
          class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <Download :size="18" />
          Export CSV
        </button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="bg-white border-b border-gray-200 px-6">
      <nav class="flex gap-8">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="[
            'py-4 text-sm font-medium border-b-2 transition-colors',
            activeTab === tab.id 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Filter Bar -->
    <div class="bg-white px-6 py-4 border-b border-gray-200">
      <div class="flex flex-wrap items-center gap-4">
        <!-- Date Range Picker -->
        <div class="flex items-center gap-2">
          <div class="relative">
            <Calendar :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              v-model="currentFilters.startDate"
              type="date" 
              class="pl-9 block w-40 rounded-lg border-gray-300 bg-gray-50 border focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2"
              title="Start Date"
            />
          </div>
          <span class="text-gray-400">to</span>
          <div class="relative">
            <Calendar :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              v-model="currentFilters.endDate"
              type="date" 
              class="pl-9 block w-40 rounded-lg border-gray-300 bg-gray-50 border focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2"
              title="End Date"
            />
          </div>
        </div>

        <!-- Collection-specific filters -->
        <template v-if="activeTab === 'Collection'">
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User :size="16" class="text-gray-400" />
            </div>
            <input 
              v-model="collectionFilters.collectorId"
              type="text" 
              placeholder="Collector ID..." 
              class="pl-9 block w-40 rounded-lg border-gray-300 bg-gray-50 border focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2"
            />
          </div>

          <div class="relative">
            <select 
              v-model="collectionFilters.location"
              class="block w-48 rounded-lg border-gray-300 bg-gray-50 border focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 appearance-none pl-3"
            >
              <option value="">All Locations</option>
              <option v-for="m in machines" :key="m.id" :value="m.deviceNo">
                {{ m.deviceNo }} - {{ m.name }}
              </option>
            </select>
          </div>

          <div class="relative">
            <select 
              v-model="collectionFilters.groupBy"
              class="block w-40 rounded-lg border-gray-300 bg-gray-50 border focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 appearance-none pl-3"
            >
              <option v-for="opt in groupByOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
        </template>

        <!-- Maintenance-specific filters -->
        <template v-if="activeTab === 'Maintenance'">
          <div class="relative">
            <select 
              v-model="maintenanceFilters.status"
              class="block w-40 rounded-lg border-gray-300 bg-gray-50 border focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 appearance-none pl-3"
            >
              <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div class="relative">
            <select 
              v-model="maintenanceFilters.machineId"
              class="block w-48 rounded-lg border-gray-300 bg-gray-50 border focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 appearance-none pl-3"
            >
              <option value="">All Machines</option>
              <option v-for="m in machines" :key="m.id" :value="m.deviceNo">
                {{ m.deviceNo }} - {{ m.name }}
              </option>
            </select>
          </div>
        </template>

        <!-- Financials-specific filters -->
        <template v-if="activeTab === 'Financials'">
          <div class="flex items-center gap-2">
            <div class="relative">
              <Calendar :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                v-model="financialFilters.startDate"
                type="date" 
                class="pl-9 block w-40 rounded-lg border-gray-300 bg-gray-50 border focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2"
                title="Start Date"
              />
            </div>
            <span class="text-gray-400">to</span>
            <div class="relative">
              <Calendar :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                v-model="financialFilters.endDate"
                type="date" 
                class="pl-9 block w-40 rounded-lg border-gray-300 bg-gray-50 border focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2"
                title="End Date"
              />
            </div>
          </div>
        </template>

        <!-- Apply/Clear -->
        <button 
          @click="applyFilters"
          class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <Search :size="16" />
          Apply
        </button>
        <button 
          v-if="currentFilters.startDate || currentFilters.endDate || (activeTab === 'Collection' && (collectionFilters.collectorId || collectionFilters.location)) || (activeTab === 'Maintenance' && (maintenanceFilters.status || maintenanceFilters.machineId)) || (activeTab === 'Financials' && (financialFilters.startDate || financialFilters.endDate))"
          @click="clearFiltersLocal"
          class="text-sm text-red-600 hover:text-red-700 font-medium"
        >
          Clear Filters
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="p-6">
      <!-- Error Display -->
      <div v-if="activeError" class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
        <p class="text-red-600 font-medium">Error: {{ activeError }}</p>
        <button @click="activeTab === 'Collection' ? fetchCollectionData() : fetchMaintenanceData()" class="mt-2 text-sm text-red-700 underline">Retry</button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center h-64">
        <RefreshCw :size="32" class="animate-spin text-blue-600" />
      </div>

      <div v-else-if="activeTab === 'Collection'">
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p class="text-sm text-gray-500 mb-1">Total Weight Collected</p>
            <p class="text-3xl font-bold text-gray-900">
              {{ collectionSummary?.total_collected?.weight?.toFixed(2) || '0.00' }} <span class="text-lg font-normal text-gray-500">kg</span>
            </p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p class="text-sm text-gray-500 mb-1">Total Items Collected</p>
            <p class="text-3xl font-bold text-gray-900">
              {{ collectionSummary?.total_collected?.quantity?.toLocaleString() || '0' }}
            </p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p class="text-sm text-gray-500 mb-1">Total Value</p>
            <p class="text-3xl font-bold text-gray-900">
              {{ collectionSummary?.total_collected?.value?.toFixed(2) || '0.00' }} <span class="text-lg font-normal text-gray-500">pts</span>
            </p>
          </div>
        </div>

        <!-- Data Table -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900">
              {{ collectionFilters.groupBy === 'collector' ? 'By Collector' : 'By Location' }}
            </h3>
          </div>
          
          <div class="overflow-x-auto -mx-3 sm:mx-0">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {{ collectionFilters.groupBy === 'collector' ? 'Collector ID' : 'Location' }}
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Weight (kg)
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Value (pts)
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-if="collectionFilters.groupBy === 'collector'" v-for="row in collectionSummary?.by_collector" :key="row.collector_id" class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ row.collector_id?.slice(0, 8) }}...
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {{ row.total_weight?.toFixed(2) || '0.00' }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {{ row.total_quantity || 0 }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {{ row.total_value?.toFixed(2) || '0.00' }}
                  </td>
                </tr>
                <tr v-else v-for="row in collectionSummary?.by_location" :key="row.location" class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ row.location }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {{ row.total_weight?.toFixed(2) || '0.00' }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {{ row.total_quantity || 0 }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {{ row.total_value?.toFixed(2) || '0.00' }}
                  </td>
                </tr>
                <tr v-if="(collectionFilters.groupBy === 'collector' && !collectionSummary?.by_collector?.length) || (collectionFilters.groupBy === 'location' && !collectionSummary?.by_location?.length)">
                  <td colspan="4" class="px-6 py-8 text-center text-gray-500">
                    No data available for the selected filters
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'Maintenance'">
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p class="text-sm text-gray-500 mb-1">Completed</p>
            <p class="text-3xl font-bold text-green-600">
              {{ maintenanceSummary?.completed || 0 }}
            </p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p class="text-sm text-gray-500 mb-1">Pending</p>
            <p class="text-3xl font-bold text-amber-600">
              {{ maintenanceSummary?.pending || 0 }}
            </p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p class="text-sm text-gray-500 mb-1">Rejected</p>
            <p class="text-3xl font-bold text-red-600">
              {{ maintenanceSummary?.rejected || 0 }}
            </p>
          </div>
        </div>

        <!-- Maintenance Table -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900">Maintenance Records</h3>
            <p class="text-sm text-gray-500 mt-1">Sorted by most recent maintenance date</p>
          </div>
          
          <div class="overflow-x-auto -mx-3 sm:mx-0">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Machine ID
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issue Description
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Technician
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="record in paginatedRecords" :key="record.id" class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ new Date(record.maintenance_date).toLocaleString() }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ record.machine_id }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ record.issue_description }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ record.technician_name }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {{ record.cost_of_repair?.toFixed(2) || '0.00' }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center">
                    <span class="px-2 py-1 rounded-full text-xs font-medium"
                      :class="{
                        'bg-green-100 text-green-800': record.status === 'VERIFIED',
                        'bg-yellow-100 text-yellow-800': record.status === 'PENDING',
                        'bg-red-100 text-red-800': record.status === 'REJECTED'
                      }"
                    >
                      {{ record.status === 'VERIFIED' ? 'Completed' : record.status === 'PENDING' ? 'Pending' : 'Rejected' }}
                    </span>
                  </td>
                </tr>
                <tr v-if="!maintenanceRecords.length">
                  <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                    No maintenance records found for the selected filters
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div class="text-sm text-gray-500">
              Showing {{ (maintenancePage - 1) * itemsPerPage + 1 }} to {{ Math.min(maintenancePage * itemsPerPage, totalRecords) }} of {{ totalRecords }} results
            </div>
            <div class="flex gap-2">
              <button 
                @click="handlePageChange(maintenancePage - 1)"
                :disabled="maintenancePage === 1"
                class="px-3 py-1 rounded border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button 
                @click="handlePageChange(maintenancePage + 1)"
                :disabled="maintenancePage >= maintenanceTotalPages"
                class="px-3 py-1 rounded border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'Collector Logs'">
        <!-- Collector Logs Table -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900">Collection Events</h3>
            <p class="text-sm text-gray-500 mt-1">Showing individual collection events with collector and item details</p>
          </div>
          
          <div class="overflow-x-auto -mx-3 sm:mx-0">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Collector ID
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Waste Type
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Weight (kg)
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value (pts)
                  </th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="log in paginatedLogs" :key="log.id" class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ new Date(log.timestamp).toLocaleString() }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ log.collector_id?.slice(0, 8) }}...
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ log.device_no }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span class="px-2 py-1 rounded-full text-xs font-medium"
                      :class="{
                        'bg-blue-100 text-blue-800': log.waste_type === 'plastic',
                        'bg-yellow-100 text-yellow-800': log.waste_type === 'paper',
                        'bg-green-100 text-green-800': log.waste_type === 'uco'
                      }"
                    >
                      {{ log.waste_type }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {{ log.weight?.toFixed(2) || '0.00' }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {{ log.value?.toFixed(2) || '0.00' }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center">
                    <span class="px-2 py-1 rounded-full text-xs font-medium"
                      :class="{
                        'bg-green-100 text-green-800': log.status === 'VERIFIED',
                        'bg-yellow-100 text-yellow-800': log.status === 'PENDING',
                        'bg-red-100 text-red-800': log.status === 'REJECTED'
                      }"
                    >
                      {{ log.status }}
                    </span>
                  </td>
                </tr>
                <tr v-if="!collectorLogs.length">
                  <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                    No collection events found for the selected filters
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div class="text-sm text-gray-500">
              Showing {{ (collectionPage - 1) * itemsPerPage + 1 }} to {{ Math.min(collectionPage * itemsPerPage, totalLogs) }} of {{ totalLogs }} results
            </div>
            <div class="flex gap-2">
              <button 
                @click="handlePageChange(collectionPage - 1)"
                :disabled="collectionPage === 1"
                class="px-3 py-1 rounded border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button 
                @click="handlePageChange(collectionPage + 1)"
                :disabled="collectionPage >= collectionTotalPages"
                class="px-3 py-1 rounded border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Financials Tab -->
      <div v-else-if="activeTab === 'Financials'">
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p class="text-sm text-gray-500 mb-1">Total Income</p>
            <p class="text-3xl font-bold text-green-600">
              {{ totalIncome.toFixed(2) }}
            </p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p class="text-sm text-gray-500 mb-1">Total Expenses</p>
            <p class="text-3xl font-bold text-red-600">
              {{ totalExpenses.toFixed(2) }}
            </p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p class="text-sm text-gray-500 mb-1">Net Balance</p>
            <p class="text-3xl font-bold" :class="netBalance >= 0 ? 'text-blue-600' : 'text-red-600'">
              {{ netBalance.toFixed(2) }}
            </p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p class="text-sm text-gray-500 mb-1">Transactions</p>
            <p class="text-3xl font-bold text-gray-900">
              {{ processedFinancialTransactions.length }}
            </p>
          </div>
        </div>

        <!-- Financial Data Table -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-semibold text-gray-900">Transaction History</h3>
                <p class="text-sm text-gray-500 mt-1">Detailed financial transactions with running balance</p>
              </div>
            </div>
          </div>

          <div class="overflow-x-auto -mx-3 sm:mx-0">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Income
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expense
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Running Balance
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="(transaction, index) in paginatedFinancialTransactions" :key="index" class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ transaction.date }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span 
                      class="px-2 py-1 rounded-full text-xs font-medium"
                      :class="transaction.category === 'Income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                    >
                      {{ transaction.category }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right font-medium">
                    {{ transaction.category === 'Income' ? transaction.amount.toFixed(2) : '-' }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right font-medium">
                    {{ transaction.category === 'Expense' ? transaction.amount.toFixed(2) : '-' }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                    {{ getRunningBalance(index).toFixed(2) }}
                  </td>
                </tr>
                <tr v-if="!processedFinancialTransactions.length">
                  <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                    No financial transactions found for the selected filters
                  </td>
                </tr>
              </tbody>
              <tfoot class="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colspan="2" class="px-6 py-4 text-left text-sm font-bold text-gray-900">
                    Total Net Profit
                  </td>
                  <td class="px-6 py-4 text-right text-sm font-bold text-green-600">
                    {{ totalIncome.toFixed(2) }}
                  </td>
                  <td class="px-6 py-4 text-right text-sm font-bold text-red-600">
                    {{ totalExpenses.toFixed(2) }}
                  </td>
                  <td class="px-6 py-4 text-right text-sm font-bold" :class="netBalance >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ netBalance.toFixed(2) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Pagination -->
          <div v-if="processedFinancialTransactions.length > financialItemsPerPage" 
               class="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div class="text-sm text-gray-500">
              Showing {{ (financialCurrentPage - 1) * financialItemsPerPage + 1 }} to {{ Math.min(financialCurrentPage * financialItemsPerPage, processedFinancialTransactions.length) }} of {{ processedFinancialTransactions.length }} results
            </div>
            <div class="flex gap-2">
              <button 
                @click="handlePageChange(financialCurrentPage - 1)"
                :disabled="financialCurrentPage === 1"
                class="px-3 py-1 rounded border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button 
                @click="handlePageChange(financialCurrentPage + 1)"
                :disabled="financialCurrentPage >= totalFinancialPages"
                class="px-3 py-1 rounded border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>