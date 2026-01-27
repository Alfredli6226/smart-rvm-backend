<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="close"></div>
    
    <div class="relative bg-white rounded-3xl w-full max-w-xs p-6 shadow-2xl text-center">
      
      <div class="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors"
        :class="type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'">
        <svg v-if="type === 'success'" xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>

      <h3 class="text-lg font-bold text-gray-900 mb-2">{{ title }}</h3>
      <p class="text-sm text-gray-500 mb-6">{{ message }}</p>

      <button 
        @click="close" 
        class="w-full py-3 rounded-xl font-bold text-white transition transform active:scale-95"
        :class="type === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-800 hover:bg-gray-900'"
      >
        {{ type === 'success' ? 'Okay, Great!' : 'Close' }}
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  isOpen: Boolean,
  type: { type: String, default: 'error' }, // 'success' or 'error'
  title: String,
  message: String
});

const emit = defineEmits(['close']);
const close = () => emit('close');
</script>