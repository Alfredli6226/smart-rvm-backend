<script setup lang="ts">
import { ref, watch } from 'vue';
import { Search, Filter, X } from 'lucide-vue-next';

// Define what data we pass back to the parent
const emit = defineEmits(['update:filters']);

const filters = ref({
  search: '',      // For Phone, Machine ID, Record ID
  wasteType: '',   // Dropdown
  startDate: '',
  endDate: ''
});

// Watch for changes and emit immediately
watch(filters, (newVal) => {
  emit('update:filters', newVal);
}, { deep: true });

// Helper to clear all
const clearFilters = () => {
  filters.value = { search: '', wasteType: '', startDate: '', endDate: '' };
};
</script>

<template>
  <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6 space-y-4">
    
    <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
      
      <div class="md:col-span-5 relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search :size="18" class="text-gray-400" />
        </div>
        <input 
          v-model="filters.search"
          type="text" 
          placeholder="Search Phone, Machine No, or ID..." 
          class="pl-10 block w-full rounded-lg border-gray-300 bg-gray-50 border focus:bg-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 transition-all"
        />
      </div>

      <div class="md:col-span-3 relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Filter :size="18" class="text-gray-400" />
        </div>
        <select 
          v-model="filters.wasteType"
          class="pl-10 block w-full rounded-lg border-gray-300 bg-gray-50 border focus:bg-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 appearance-none"
        >
          <option value="">All Waste Types</option>
          <option value="Plastic">Plastic</option>
          <option value="Paper">Paper</option>
          <option value="UCO">UCO (Oil)</option>
          <option value="Metal">Metal/Aluminium</option>
        </select>
      </div>

      <div class="md:col-span-4 flex gap-2">
        <div class="relative flex-1">
          <input 
            v-model="filters.startDate"
            type="date" 
            class="block w-full rounded-lg border-gray-300 bg-gray-50 border focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3"
            title="Start Date"
          />
        </div>
        <div class="relative flex-1">
          <input 
            v-model="filters.endDate"
            type="date" 
            class="block w-full rounded-lg border-gray-300 bg-gray-50 border focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3"
            title="End Date"
          />
        </div>
      </div>
    </div>

    <div v-if="filters.search || filters.wasteType || filters.startDate" class="flex items-center gap-2 text-xs">
      <span class="font-semibold text-gray-500">Active Filters:</span>
      <button @click="clearFilters" class="text-red-600 hover:underline flex items-center gap-1">
        <X :size="12" /> Clear All
      </button>
    </div>

  </div>
</template> 