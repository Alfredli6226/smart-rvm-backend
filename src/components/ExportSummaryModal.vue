<script setup lang="ts">
import { computed } from 'vue';
import { X, PieChart, FileSpreadsheet, FileText } from 'lucide-vue-next';
import { useExcelExport, type ExportMode } from '../composables/useExcelExport';
import { useWordExport } from '../composables/useWordExport';

const props = defineProps<{
  isOpen: boolean;
  data: any[];
  mode: ExportMode; // NEW: Prop to distinguish mode
}>();

const emit = defineEmits(['close']);
const { generateSummary, downloadExcel } = useExcelExport();
const { downloadWord } = useWordExport();

// Pass mode to summary generator
const stats = computed(() => generateSummary(props.data, props.mode));

const percentages = computed(() => {
  const total = stats.value.totalCount || 1;
  const counts = stats.value.statusCounts;
  
  // Combine "Success" statuses (Paid, Approved, Verified)
  const successCount = (counts['APPROVED'] || 0) + (counts['VERIFIED'] || 0) + (counts['PAID'] || 0);
  
  return {
    pending: ((counts['PENDING'] || 0) / total) * 100,
    success: (successCount / total) * 100,
    rejected: ((counts['REJECTED'] || 0) / total) * 100
  };
});

const handleExcelDownload = () => {
  downloadExcel(props.data, props.mode);
  emit('close');
};

const handleWordDownload = async () => {
  await downloadWord(props.data, props.mode);
  emit('close');
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div @click="emit('close')" class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"></div>

    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <div class="bg-slate-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <h3 class="text-lg font-bold text-gray-800 flex items-center gap-2">
          <PieChart :size="20" class="text-blue-600"/> Export {{ mode === 'withdrawals' ? 'Withdrawals' : 'Logs' }}
        </h3>
        <button @click="emit('close')" class="p-1 hover:bg-gray-200 rounded-full transition-colors">
          <X :size="20" class="text-gray-500" />
        </button>
      </div>

      <div class="p-6 space-y-6">
        
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
            <div class="text-sm text-blue-600 font-semibold uppercase tracking-wider">Rows</div>
            <div class="text-3xl font-bold text-gray-900">{{ stats.totalCount }}</div>
          </div>
          <div class="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
            <div class="text-sm text-green-600 font-semibold uppercase tracking-wider">
                {{ mode === 'withdrawals' ? 'Total Value' : 'Total Kg' }}
            </div>
            <div class="text-3xl font-bold text-gray-900">{{ stats.totalValue.toLocaleString() }}</div>
          </div>
        </div>

        <div>
          <h4 class="text-xs font-bold text-gray-500 uppercase mb-2">Status Distribution</h4>
          
          <div class="h-4 w-full bg-gray-100 rounded-full flex overflow-hidden">
            <div class="bg-amber-400 h-full" :style="{ width: percentages.pending + '%' }" title="Pending"></div>
            <div class="bg-green-500 h-full" :style="{ width: percentages.success + '%' }" title="Success"></div>
            <div class="bg-red-500 h-full" :style="{ width: percentages.rejected + '%' }" title="Rejected"></div>
          </div>

          <div class="flex justify-between text-xs mt-2 text-gray-600">
            <div class="flex items-center gap-1">
                <div class="w-2 h-2 rounded-full bg-amber-400"></div> Pending ({{ stats.statusCounts['PENDING'] || 0 }})
            </div>
            <div class="flex items-center gap-1">
                <div class="w-2 h-2 rounded-full bg-green-500"></div> 
                {{ mode === 'withdrawals' ? 'Paid' : 'Verified' }} ({{ (stats.statusCounts['APPROVED'] || 0) + (stats.statusCounts['VERIFIED'] || 0) + (stats.statusCounts['PAID'] || 0) }})
            </div>
            <div class="flex items-center gap-1">
                <div class="w-2 h-2 rounded-full bg-red-500"></div> Rejected ({{ stats.statusCounts['REJECTED'] || 0 }})
            </div>
          </div>
        </div>

        <p class="text-xs text-gray-400 text-center italic">
          This export will include {{ stats.totalCount }} rows based on your current selection/filters.
        </p>
      </div>

      <div class="p-4 border-t border-gray-100 bg-gray-50 grid grid-cols-2 gap-3">
        <button @click="handleWordDownload" class="py-2.5 text-sm font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 border border-blue-200 rounded-xl transition-all flex items-center justify-center gap-2">
          <FileText :size="18" /> Word Doc
        </button>

        <button @click="handleExcelDownload" class="py-2.5 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-xl shadow-lg shadow-gray-200 flex items-center justify-center gap-2 transition-all">
          <FileSpreadsheet :size="18" /> Excel Sheet
        </button>
      </div>

    </div>
  </div>
</template>