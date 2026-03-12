<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { DownloadCloud, Smartphone, User, X } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
  isSubmitting: boolean;
}>();

const emit = defineEmits(['close', 'create']);

const nickname = ref(''); // Global nickname (Optional)
const phoneInput = ref(''); // Raw text area input

// Reset on open
watch(() => props.isOpen, (val) => {
  if (val) {
    nickname.value = '';
    phoneInput.value = '';
  }
});

// Computed property to parse phone numbers
const parsedPhones = computed(() => {
  if (!phoneInput.value) return [];
  // Split by newlines or commas, trim whitespace, filter empty
  return phoneInput.value
    .split(/[\n,]+/)
    .map(p => p.trim())
    .filter(p => p.length >= 9 && /^\d+$/.test(p)); // Basic validation: digits only, min length
});

const handleSubmit = () => {
  if (parsedPhones.value.length > 0) {
    // If nickname is provided, it applies to ALL (or maybe just the first one? usually leave blank for bulk)
    // We emit an array of objects for the parent to loop through
    const usersToCreate = parsedPhones.value.map(phone => ({
      phone,
      nickname: nickname.value // Optional: apply same tag to all, or leave empty
    }));
    
    emit('create', usersToCreate);
  }
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
        
        <div class="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
          <div>
              <h3 class="font-bold text-gray-900 flex items-center gap-2 text-lg">
                  <DownloadCloud class="text-blue-600" :size="20"/> Bulk Import Users
              </h3>
              <p class="text-xs text-gray-500 mt-1">Sync multiple users from RVM Machine Cloud.</p>
          </div>
          <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        
        <div class="p-6 space-y-5 overflow-y-auto">
          
          <div class="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-xs flex gap-2 items-start leading-relaxed border border-blue-100">
             <span class="text-lg">ℹ️</span>
             <span>
               Enter <b>Phone Numbers</b> (one per line). The system will fetch their existing names and points. <br/>
               If you provide a nickname below, it will overwrite the name for <b>ALL</b> entered numbers.
             </span>
          </div>

          <div>
              <label class="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase mb-1.5">
                  <User :size="12" /> Batch Tag / Nickname <span class="text-gray-400 font-normal normal-case">(Optional - Overwrites All)</span>
              </label>
              <input v-model="nickname" class="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-medium" placeholder="Leave empty to fetch existing names" />
          </div>

          <div class="flex flex-col h-full">
              <div class="flex justify-between items-center mb-1.5">
                <label class="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase">
                    <Smartphone :size="12" /> Phone Numbers list
                </label>
                <span class="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">
                  {{ parsedPhones.length }} valid
                </span>
              </div>
              
              <div class="relative">
                <textarea 
                  v-model="phoneInput" 
                  rows="6"
                  class="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-mono leading-relaxed resize-none" 
                  placeholder="0123456789&#10;0198765432&#10;017..." 
                ></textarea>
                
                <button v-if="phoneInput" @click="phoneInput = ''" class="absolute top-2 right-2 text-gray-300 hover:text-gray-500 p-1 bg-white rounded-md shadow-sm border border-gray-100">
                  <X :size="12"/>
                </button>
              </div>
              <p class="text-[10px] text-gray-400 mt-1.5 text-right">Format: 01... (One per line)</p>
          </div>

        </div>

        <div class="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button @click="$emit('close')" class="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
          
          <button 
            @click="handleSubmit" 
            :disabled="isSubmitting || parsedPhones.length === 0" 
            class="px-6 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95 flex items-center gap-2"
          >
              <DownloadCloud v-if="!isSubmitting" :size="16" />
              <svg v-else class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              {{ isSubmitting ? `Syncing ${parsedPhones.length}...` : `Import ${parsedPhones.length > 0 ? parsedPhones.length : ''} Users` }}
          </button>
        </div>
    </div>
  </div>
</template>