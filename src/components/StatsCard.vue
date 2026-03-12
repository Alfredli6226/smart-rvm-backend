<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  title: string;
  value: string | number;
  color: 'blue' | 'green' | 'amber' | 'purple';
  description?: string;
}>();

const styles = computed(() => {
  const map = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    green: 'bg-green-50 text-green-600 ring-green-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
    purple: 'bg-purple-50 text-purple-600 ring-purple-100',
  };
  return map[props.color];
});
</script>

<template>
  <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-sm font-medium text-gray-500 mb-1">{{ title }}</p>
        <h3 class="text-3xl font-bold text-gray-900 tracking-tight">{{ value }}</h3>
        <p v-if="description" class="text-xs text-gray-400 mt-2 font-medium">{{ description }}</p>
      </div>
      <div :class="`p-3 rounded-xl ring-1 ${styles}`">
        <slot name="icon"></slot>
      </div>
    </div>
  </div>
</template>