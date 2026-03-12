<script setup lang="ts">
import { ref, watch } from 'vue';
import { Search, Filter, X } from 'lucide-vue-next';

const emit = defineEmits(['update:filters']);

const filters = ref({
  search: '',
  status: '',
  startDate: '', // ✅ New
  endDate: ''    // ✅ New
});

// Auto-emit on change
watch(filters, (val) => emit('update:filters', val), { deep: true });

const clear = () => filters.value = { search: '', status: '', startDate: '', endDate: '' };
</script>

<template>
  <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6 grid grid-cols-1 md:grid-cols-12 gap-4">
    
    <div class="md:col-span-5 relative">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
        <Search :size="18" />
      </div>
      <input 
        v-model="filters.search"
        type="text" 
        placeholder="Search Phone, Name, Bank, or Acct No..." 
        class="pl-10 w-full rounded-lg border-gray-300 bg-gray-50 border focus:ring-blue-500 py-2 text-sm transition-all"
      />
    </div>

    <div class="md:col-span-3 relative">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
        <Filter :size="18" />
      </div>
      <select 
        v-model="filters.status"
        class="pl-10 w-full rounded-lg border-gray-300 bg-gray-50 border focus:ring-blue-500 py-2 text-sm appearance-none"
      >
        <option value="">All Statuses</option>
        <option value="PENDING">Pending</option>
        <option value="APPROVED">Approved</option>
        <option value="REJECTED">Rejected</option>
      </select>
    </div>

    <div class="md:col-span-4 flex gap-2">
      <input 
        v-model="filters.startDate" 
        type="date" 
        class="w-full rounded-lg border-gray-300 bg-gray-50 border py-2 px-3 text-sm focus:ring-blue-500" 
        title="Start Date"
      />
      <span class="self-center text-gray-400">-</span>
      <input 
        v-model="filters.endDate" 
        type="date" 
        class="w-full rounded-lg border-gray-300 bg-gray-50 border py-2 px-3 text-sm focus:ring-blue-500" 
        title="End Date"
      />
    </div>

    <div v-if="filters.search || filters.status || filters.startDate" class="md:col-span-12 flex justify-end">
      <button @click="clear" class="text-xs text-red-600 hover:underline flex items-center gap-1">
        <X :size="12" /> Clear Filters
      </button>
    </div>
  </div>
</template>