<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useWithdrawals } from '../composables/useWithdrawals';
import { useAuthStore } from '../stores/auth'; 
import WithdrawalFilters from '../components/WithdrawalFilters.vue';  
import SimpleConfirmModal from '../components/SimpleConfirmModal.vue';
import StatusModal from '../components/StatusModal.vue';
import { 
  CheckCircle2, XCircle, RefreshCcw,  ChevronLeft, ChevronRight,
  Clock, CheckSquare, Download, PlusCircle
} from 'lucide-vue-next';
import { Eye } from 'lucide-vue-next';
import type { Withdrawal } from '../types';
import WithdrawalDetailsModal from '../components/WithdrawalDetailsModal.vue';
import ExportSummaryModal from '../components/ExportSummaryModal.vue';

// 1. Init Logic from Composable
const { 
  withdrawals, 
  loading, 
  createWithdrawal,
  fetchWithdrawals, 
  updateStatus,
  prepareSync, 
  executeSync, 
  syncConfirm, 
  syncStatus,
  isBatchSyncing
} = useWithdrawals();

// Record Cash Out modal
const showRecordModal = ref(false);
const recordUserId = ref('');
const recordAmount = ref(0);
const recordSubmitting = ref(false);

const handleRecordCashOut = async () => {
  if (!recordUserId.value || recordAmount.value <= 0) {
    alert('Please enter user ID and amount');
    return;
  }
  recordSubmitting.value = true;
  try {
    await createWithdrawal(recordUserId.value, recordAmount.value);
    showRecordModal.value = false;
    recordUserId.value = '';
    recordAmount.value = 0;
  } catch (err: any) {
    alert('Failed: ' + (err.message || 'Unknown error'));
  } finally {
    recordSubmitting.value = false;
  }
};

const auth = useAuthStore();

// 2. Tab State (New)
const activeTab = ref<string>('PENDING'); // Default to Pending

// 3. Filter State
const searchFilters = ref({ 
  search: '', 
  startDate: '', 
  endDate: '' 
});

// 4. Filter Logic (Computed - Updated for Tabs)
const filteredList = computed(() => {
  return withdrawals.value.filter(w => {
    
    // A. Tab Filtering
    if (activeTab.value === 'PENDING') {
       if (w.status !== 'PENDING') return false;
    } 
    else if (activeTab.value === 'APPROVED') {
       // Group APPROVED, PAID, and EXTERNAL_SYNC together as "Completed"
       if (!['APPROVED', 'PAID', 'EXTERNAL_SYNC'].includes(w.status)) return false;
    }
    else if (activeTab.value === 'REJECTED') {
       if (w.status !== 'REJECTED') return false;
    }

    // B. Date Range Check
    if (searchFilters.value.startDate || searchFilters.value.endDate) {
       const date = w.created_at.split('T')[0] || '';
       if (searchFilters.value.startDate && date < searchFilters.value.startDate) return false;
       if (searchFilters.value.endDate && date > searchFilters.value.endDate) return false;
    }

    // C. Text Search
    const q = searchFilters.value.search.toLowerCase();
    if (q) {
      const match = 
        (w.user_id || '').toLowerCase().includes(q) ||
        (w.bank_name || '').toLowerCase().includes(q) ||
        (w.account_number || '').toLowerCase().includes(q);
      
      if (!match) return false;
    }

    return true;
  });
});

// ... (Pagination Logic stays same) ...
const currentPage = ref(1);
const itemsPerPage = ref(10);
const totalPages = computed(() => Math.ceil(filteredList.value.length / itemsPerPage.value));

const paginatedList = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return filteredList.value.slice(start, start + itemsPerPage.value);
});

watch([filteredList, activeTab], () => currentPage.value = 1);

// ... (Helpers and Modal logic stay same) ...

// Selection Logic
const selectedIds = ref(new Set<string>());

const toggleSelection = (id: string) => {
  const newSet = new Set(selectedIds.value);
  if (newSet.has(id)) newSet.delete(id);
  else newSet.add(id);
  selectedIds.value = newSet;
};

const toggleSelectAll = () => {
  const newSet = new Set(selectedIds.value);
  const pageIds = paginatedList.value.map(w => w.id);
  const allSelected = pageIds.every(id => newSet.has(id));

  if (allSelected) {
    pageIds.forEach(id => newSet.delete(id));
  } else {
    pageIds.forEach(id => newSet.add(id));
  }
  selectedIds.value = newSet;
};

const isPageSelected = computed(() => {
  return paginatedList.value.length > 0 && paginatedList.value.every(w => selectedIds.value.has(w.id));
});

// Smart Data for Export
const dataToExport = computed(() => {
  if (selectedIds.value.size > 0) {
    return withdrawals.value.filter(w => selectedIds.value.has(w.id));
  }
  return filteredList.value;
});

// Clear selection on tab change
watch([filteredList, activeTab], () => {
  selectedIds.value.clear();
});

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'APPROVED': 
    case 'PAID': 
      return { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2, label: 'Paid' };
    case 'EXTERNAL_SYNC': 
      return { bg: 'bg-blue-50', text: 'text-blue-700', icon: CheckSquare, label: 'Migrated' };
    case 'REJECTED': 
      return { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Rejected' };
    default: 
      return { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock, label: 'Pending' };
  }
};

const showModal = ref(false);
const selectedWithdrawal = ref<Withdrawal | null>(null);
const showExportModal = ref(false);

// User withdrawal history for the detail modal
const userWithdrawalHistory = ref<Withdrawal[]>([]);

// Flatten bundled withdrawals into individual records for history
const allIndividualWithdrawals = computed(() => {
  const items: any[] = [];
  for (const w of withdrawals.value) {
    if (w.is_bundled && w.sub_withdrawals) {
      items.push(...w.sub_withdrawals);
    } else {
      items.push(w);
    }
  }
  return items;
});

const openDetails = (w: Withdrawal) => {
  selectedWithdrawal.value = w;
  // Compute user's past withdrawals (exclude current one)
  const currentIds = new Set(w.bundled_ids || [w.id]);
  userWithdrawalHistory.value = allIndividualWithdrawals.value
    .filter((item: any) => item.user_id === w.user_id && !currentIds.has(item.id))
    .slice(0, 20); // Show last 20
  showModal.value = true;
};


onMounted(() => fetchWithdrawals());

// Watch for auth to finish loading, then refetch
watch(() => auth.loading, (isLoading) => {
  if (!isLoading) {
    console.log("Withdrawals: Auth loaded, refetching data...");
    fetchWithdrawals();
  }
});

// Also watch for role to be set
watch(() => auth.role, (newRole) => {
  if (newRole) {
    console.log("Withdrawals: Role set to " + newRole + ", refetching data...");
    fetchWithdrawals();
  }
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <div>
        <h2 class="text-lg font-bold text-gray-900">Withdrawal Requests</h2>
        <p class="text-sm text-gray-500 mt-1">Manage point redemption requests</p>
      </div>
      
      <div class="flex items-center gap-3">
        <button 
          @click="showExportModal = true"
          :disabled="filteredList.length === 0"
          class="flex items-center space-x-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 px-4 py-2 rounded-lg hover:bg-green-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download :size="16" />
          <span>{{ selectedIds.size > 0 ? `Export Selected (${selectedIds.size})` : 'Export All' }}</span>
        </button>

        <button 
          @click="prepareSync" 
          :disabled="isBatchSyncing"
          class="flex items-center space-x-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-100 transition-all disabled:opacity-50"
        >
          <RefreshCcw :size="16" :class="{'animate-spin': isBatchSyncing}" />
          <span>{{ isBatchSyncing ? 'Auditing...' : 'Global Audit' }}</span>
        </button>

        <button 
          @click="showRecordModal = true"
          class="flex items-center space-x-2 text-sm font-bold text-white bg-purple-600 border border-purple-600 px-4 py-2 rounded-lg hover:bg-purple-700 transition-all"
        >
          <PlusCircle :size="16" />
          <span>Record Cash Out</span>
        </button>

        <button 
          @click="fetchWithdrawals" 
          :disabled="loading"
          class="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50"
        >
          <RefreshCcw :size="14" :class="{'animate-spin': loading}" />
          <span>Refresh</span>
        </button>
      </div>
      </div>

    <div class="space-y-4">
        <WithdrawalFilters @update:filters="(val) => searchFilters = val" />

        <div class="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
            <button 
                @click="activeTab = 'PENDING'"
                :class="`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'PENDING' ? 'bg-white shadow text-amber-700' : 'text-gray-500 hover:text-gray-900'}`"
            >
                <Clock :size="16" class="mr-2"/> Pending
            </button>
            <button 
                @click="activeTab = 'APPROVED'"
                :class="`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'APPROVED' ? 'bg-white shadow text-green-700' : 'text-gray-500 hover:text-gray-900'}`"
            >
                <CheckCircle2 :size="16" class="mr-2"/> Paid / History
            </button>
            <button 
                @click="activeTab = 'REJECTED'"
                :class="`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'REJECTED' ? 'bg-white shadow text-red-700' : 'text-gray-500 hover:text-gray-900'}`"
            >
                <XCircle :size="16" class="mr-2"/> Rejected
            </button>
        </div>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto -mx-3 sm:mx-0">
        <table class="w-full text-left border-collapse">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase font-semibold tracking-wider whitespace-nowrap">
            <tr>
              <th class="px-6 py-4 border-b w-10">
                <input 
                  type="checkbox" 
                  :checked="isPageSelected" 
                  @change="toggleSelectAll"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                />
              </th>
              <th class="px-6 py-4 border-b">Date</th>
              <th class="px-6 py-4 border-b">User</th>
              <th class="px-6 py-4 border-b">Phone</th>
              <th class="px-6 py-4 border-b text-right">Amount</th>
              <th class="px-6 py-4 border-b text-center">Status</th> 
              <th class="px-6 py-4 border-b text-right">Actions</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-100 text-sm">
            <tr v-if="paginatedList.length === 0">
              <td :colspan="activeTab === 'PENDING' ? 8 : 7" class="p-8 text-center text-gray-400">
  <p class="text-lg mb-1">📭 No requests</p>
  <p class="text-xs">Withdrawals appear here when users cash out</p>
</td>
            </tr>

            <tr 
              v-for="w in paginatedList" 
              :key="w.id" 
              :class="selectedIds.has(w.id) ? 'bg-blue-50/60' : 'hover:bg-gray-50/80'" 
              class="transition-colors group"
            >
              <td class="px-6 py-4">
                <input 
                  type="checkbox" 
                  :checked="selectedIds.has(w.id)" 
                  @change="toggleSelection(w.id)"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                />
              </td>

              <td class="px-6 py-4 whitespace-nowrap text-gray-500 text-xs">
                <div>{{ new Date(w.created_at).toLocaleDateString() }}</div>
                <div class="mt-0.5">{{ new Date(w.created_at).toLocaleTimeString() }}</div>
              </td>

              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-2 overflow-hidden shrink-0">
                    <span class="text-xs font-bold text-gray-500">{{ (w.user_id || '?').slice(-2) }}</span>
                  </div>
                  <span class="font-medium text-gray-900">{{ w.user_id || 'Guest' }}</span>
                </div>
              </td>

              <td class="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-600">
                {{ '-' }}
              </td>

              <td class="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
                {{ w.amount }} pts
              </td>

              <td class="px-6 py-4 whitespace-nowrap text-center">
                <span :class="`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusConfig(w.status).bg} ${getStatusConfig(w.status).text} border-opacity-20`">
                  <component :is="getStatusConfig(w.status).icon" :size="12" class="mr-1.5" />
                  {{ getStatusConfig(w.status).label }}
                </span>
              </td>

              <td class="px-6 py-4 whitespace-nowrap text-right">
                <div class="flex justify-end gap-2">
                  <button @click="openDetails(w)" class="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200" title="View Details">
                    <Eye :size="16" />
                  </button>
                  </div>
              </td>

            </tr>
          </tbody>
        </table>
        
        <div class="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
             <span class="text-sm text-gray-500">
               Page {{ currentPage }} of {{ totalPages || 1 }}
             </span>
             <div class="flex gap-2">
                <button @click="currentPage--" :disabled="currentPage === 1" class="p-1 rounded hover:bg-gray-200 disabled:opacity-50"><ChevronLeft :size="20"/></button>
                <button @click="currentPage++" :disabled="currentPage >= totalPages" class="p-1 rounded hover:bg-gray-200 disabled:opacity-50"><ChevronRight :size="20"/></button>
             </div>
        </div>

      </div>
    </div>
    
    <WithdrawalDetailsModal 
      :isOpen="showModal" 
      :withdrawal="selectedWithdrawal" 
      :userWithdrawalHistory="userWithdrawalHistory"
      @close="showModal = false" 
      @update-status="(id, status) => updateStatus(id, status)"
    />

    <ExportSummaryModal 
      :isOpen="showExportModal"
      :data="dataToExport"
      mode="withdrawals" 
      @close="showExportModal = false"
    />

    <SimpleConfirmModal 
      :isOpen="syncConfirm.isOpen"
      :title="syncConfirm.title"
      :message="syncConfirm.message"
      :isProcessing="isBatchSyncing"
      @confirm="executeSync"
      @close="syncConfirm.isOpen = false"
    />

    <StatusModal 
      :isOpen="syncStatus.isOpen"
      :type="syncStatus.type"
      :title="syncStatus.title"
      :message="syncStatus.message"
      @close="syncStatus.isOpen = false"
    />

    <!-- Record Cash Out Modal -->
    <div v-if="showRecordModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showRecordModal = false">
      <div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl mx-4">
        <h3 class="text-lg font-bold text-gray-900 mb-4">Record Cash Out</h3>
        <p class="text-sm text-gray-500 mb-4">Manually record a cash-out transaction for a user.</p>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">User ID</label>
            <input v-model="recordUserId" type="text" placeholder="e.g. 1384523"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Amount (RM)</label>
            <input v-model.number="recordAmount" type="number" step="0.01" min="0" placeholder="0.00"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button @click="showRecordModal = false" class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button @click="handleRecordCashOut" :disabled="recordSubmitting"
            class="px-4 py-2 text-sm font-bold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
            {{ recordSubmitting ? 'Saving...' : 'Record' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>