<script setup lang="ts">
import { CheckCircle2, XCircle } from 'lucide-vue-next';

defineProps<{
  isOpen: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
}>();

const emit = defineEmits(['close']);
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
      
      <div class="p-6 text-center">
        <div v-if="type === 'success'" class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
          <CheckCircle2 class="h-8 w-8 text-green-600" />
        </div>
        <div v-else class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
          <XCircle class="h-8 w-8 text-red-600" />
        </div>

        <h3 class="text-xl font-bold text-gray-900">{{ title }}</h3>
        <p class="mt-2 text-sm text-gray-500 whitespace-pre-line leading-relaxed">{{ message }}</p>
      </div>

      <div class="p-4 border-t border-gray-100 bg-gray-50">
        <button 
          @click="$emit('close')" 
          class="w-full py-3 text-sm font-bold text-white rounded-xl shadow-lg transition-colors"
          :class="type === 'success' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'"
        >
          Close
        </button>
      </div>

    </div>
  </div>
</template>