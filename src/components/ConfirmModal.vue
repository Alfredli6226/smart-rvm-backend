<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" @click="$emit('cancel')"></div>
    
    <div class="relative bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl transform transition-all scale-100">
      <div class="flex flex-col items-center text-center">
        <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-3xl">
          🔓
        </div>
        
        <h3 class="text-xl font-bold text-gray-800 mb-2">{{ title }}</h3>
        <p class="text-sm text-gray-500 mb-6 leading-relaxed">
          {{ message }}
        </p>

        <div class="flex gap-3 w-full">
          <button 
            @click="$emit('cancel')" 
            class="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button 
            @click="$emit('confirm')" 
            class="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition transform active:scale-95"
          >
            Yes, Open
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  isOpen: Boolean,
  title: String,
  message: String
});
defineEmits(['confirm', 'cancel']);
</script>