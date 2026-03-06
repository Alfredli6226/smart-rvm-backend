<template>
  <div class="min-h-screen bg-gray-50 flex flex-col font-sans">
    
    <div class="bg-white px-4 py-3 shadow-sm flex items-center sticky top-0 z-20">
      <button @click="$router.back()" class="p-2 rounded-full hover:bg-gray-100 transition active:scale-95">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="ml-2 text-lg font-bold text-gray-800">{{ t('machine.details_title') }}</h1>
    </div>

    <div v-if="isLoading" class="flex-1 flex flex-col items-center justify-center p-10">
      <div class="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mb-4"></div>
      <p class="text-gray-500 font-medium animate-pulse">{{ t('machine.connecting') }}</p>
    </div>

    <div v-else class="p-6 flex-1 flex flex-col max-w-md mx-auto w-full pb-20">
      
      <div class="bg-white rounded-3xl p-6 shadow-sm mb-8 text-center border border-gray-100 relative overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-green-400 to-blue-500"></div>
        
        <div class="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-white shadow-sm">
           <span class="text-4xl filter drop-shadow-sm">♻️</span>
        </div>
        
        <h2 class="text-2xl font-bold text-gray-800 mb-1 tracking-tight">{{ deviceNo }}</h2>
        <p class="text-sm text-gray-500 px-4 leading-relaxed">{{ address || t('machine.unknown_location') }}</p>
        
        <div class="mt-4 flex justify-center">
           <div class="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm border"
             :class="isOnline ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'">
             <span class="relative flex h-2.5 w-2.5">
               <span v-if="isOnline" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
               <span class="relative inline-flex rounded-full h-2.5 w-2.5" :class="isOnline ? 'bg-green-500' : 'bg-red-500'"></span>
             </span>
             {{ isOnline ? t('rvm.status.online') : t('rvm.status.offline') }}
           </div>
        </div>
      </div>

      <div v-if="isOnline" class="flex-1">
        <h3 class="text-gray-800 font-bold mb-4 text-lg flex items-center gap-2 px-1">
          <span>🔓</span> {{ t('machine.select_door') }}
        </h3>
        
        <div class="flex flex-col gap-4">
          <button 
            v-for="bin in machineBins" 
            :key="bin.positionNo"
            @click="initiateUnlock(bin)"
            :disabled="bin.isFull"
            class="relative group overflow-hidden rounded-2xl p-4 flex items-center transition-all duration-200 border-2 text-left shadow-sm active:scale-[0.98] bg-white"
            :class="[
              bin.isFull ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed grayscale' : 
              bin.theme.border + ' hover:shadow-md hover:bg-opacity-50'
            ]"
          >
            <div class="w-20 h-20 flex-shrink-0 bg-white rounded-xl flex items-center justify-center shadow-sm mr-4 border border-gray-100 overflow-hidden relative" :class="bin.theme.bg">
               
               <img v-if="bin.theme.icons.length === 1" :src="bin.theme.icons[0]" alt="Icon" class="w-12 h-12 object-contain" />
               
               <div v-else class="flex items-center justify-center w-full h-full gap-1 p-1">
                   <img :src="bin.theme.icons[0]" alt="Plastic" class="w-8 h-8 object-contain transform -rotate-12" />
                   <img :src="bin.theme.icons[1]" alt="Can" class="w-8 h-8 object-contain transform rotate-12" />
               </div>

            </div>

            <div class="flex-1 min-w-0">
               <div class="flex justify-between items-center mb-1">
                  <span class="font-bold text-gray-800 text-lg leading-tight">{{ bin.translatedName }}</span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ml-2"
                     :class="bin.isFull ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-600 border-gray-100'">
                     {{ bin.isFull ? t('rvm.state.bin_full') : `${bin.percent}%` }}
                  </span>
               </div>
               
               <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                     :class="[
                        bin.isFull ? 'bg-red-500' : 
                        bin.percent > 85 ? 'bg-orange-500' : 'bg-green-500'
                     ]"
                     :style="{ width: `${bin.percent}%` }">
                  </div>
               </div>

               <p class="text-xs mt-1.5 font-medium" :class="bin.isFull ? 'text-red-500' : 'text-gray-400'">
                  {{ bin.isFull ? t('machine.bin_full_msg') : t('machine.tap_to_open') }}
               </p>
            </div>

            <div v-if="!bin.isFull" class="ml-2 text-gray-300 group-hover:text-blue-500 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
               </svg>
            </div>
          </button>
        </div>
      </div>
      
      <div v-else class="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
         <div class="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">🔌</div>
         <p class="text-gray-500 font-bold">{{ t('rvm.status.offline') }}</p>
         <p class="text-xs text-gray-400 mt-1 px-8">We cannot connect to this machine right now.</p>
      </div>

      <p class="text-center text-xs text-gray-400 mt-8 leading-relaxed max-w-xs mx-auto">
        {{ t('machine.instruction') }}
      </p>

    </div> <div v-if="isOpening" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity">
      <div class="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center">
        <div class="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
        <h3 class="text-lg font-bold text-gray-800">Processing...</h3>
        <p class="text-sm text-gray-500 mt-1">Sending command to machine</p>
      </div>
    </div>
    

    <ConfirmModal 
      :isOpen="showConfirm"
      :title="t('machine.confirm_title', { type: selectedBin?.translatedName })"
      :message="t('machine.instruction')" 
      @confirm="handleConfirmUnlock"
      @cancel="showConfirm = false"
    />

    <StatusModal
      :isOpen="showStatus.isOpen"
      :type="showStatus.type"
      :title="showStatus.title"
      :message="showStatus.message"
      @close="showStatus.isOpen = false"
    />

  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { getMachineConfig, openRubbishPort } from "../services/autogcm.js";
import { supabase } from "../services/supabase.js"; 
import { useI18n } from "vue-i18n";

// Components
import ConfirmModal from "../components/ConfirmModal.vue";
import StatusModal from "../components/StatusModal.vue";

const { t } = useI18n();
const route = useRoute();
const deviceNo = route.params.deviceNo;

const isLoading = ref(true);
const isOnline = ref(false);
const address = ref("");
const machineBins = ref([]);
const showConfirm = ref(false);
const selectedBin = ref(null);
const showStatus = ref({ isOpen: false, type: 'error', title: '', message: '' });
const isOpening = ref(false);

// 🟢 UPDATED THEME HELPER WITH FLATICON LINKS
const getBinTheme = (rawName) => {
  const name = rawName.toLowerCase();
  
  // 1. PAPER
  if (name.includes('paper') || name.includes('kertas')) {
      return {
         icons: ['https://cdn-icons-png.flaticon.com/512/7296/7296301.png'],
         bg: 'bg-indigo-50',
         border: 'border-indigo-100',
         key: 'paper'
      };
  }
  
  // 2. UCO / OIL
  if (name.includes('oil') || name.includes('uco') || name.includes('minyak')) {
      return {
         icons: ['https://cdn-icons-png.flaticon.com/512/3082/3082045.png'],
         bg: 'bg-yellow-50',
         border: 'border-yellow-100',
         key: 'uco'
      };
  }

  // 3. PLASTIC / CAN / ALUMINIUM (Combined Icons)
  if (name.includes('plastic') || name.includes('botol') || name.includes('can') || name.includes('tin') || name.includes('aluminium')) {
      return {
         icons: [
            'https://cdn-icons-png.flaticon.com/512/3239/3239567.png', // Plastic
            'https://cdn-icons-png.flaticon.com/512/4426/4426822.png'  // Aluminium
         ],
         bg: 'bg-blue-50',
         border: 'border-blue-100',
         key: 'plastik_aluminium'
      };
  }
  
  // Default
  return {
     icons: ['https://cdn-icons-png.flaticon.com/512/3082/3082045.png'],
     bg: 'bg-gray-50',
     border: 'border-gray-100',
     key: 'default'
  };
};

onMounted(async () => {
  try {
    // 1. FETCH DB DATA (Now includes 'is_manual_offline')
    const { data: dbMachine } = await supabase
      .from('machines')
      .select('name, address, is_manual_offline') 
      .eq('device_no', deviceNo)
      .maybeSingle();
      
    if (dbMachine) address.value = dbMachine.address || dbMachine.name;

    // 2. CHECK IF MANUALLY DISABLED
    if (dbMachine?.is_manual_offline) {
        console.warn("⛔ Machine is manually set to OFFLINE via Admin Panel");
        isOnline.value = false;
        isLoading.value = false;
        return; // Stop here, do not fetch API
    }

    // 3. IF NOT DISABLED, CHECK LIVE API STATUS
    const res = await getMachineConfig(deviceNo);
    
    if (res.code === 200 && res.data && res.data.length > 0) {
      isOnline.value = true;
      machineBins.value = res.data.map(bin => {
         let percent = bin.rate ? Math.round(bin.rate) : 0;
         if (bin.rubbishTypeName.toLowerCase().includes('uco') || bin.rubbishTypeName.toLowerCase().includes('oil')) {
             if (!bin.rate && bin.weight) {
                 percent = Math.min(Math.round((Number(bin.weight) / 400) * 100), 100);
             }
         }

         const isFull = percent >= 98 || bin.isFull; 
         const theme = getBinTheme(bin.rubbishTypeName);
         
         let translatedName = t(`waste.${theme.key}`);
         if(translatedName.includes('waste.')) translatedName = bin.rubbishTypeName;

         return {
             ...bin,
             percent,
             isFull,
             theme,
             translatedName,
         };
      });
    } else {
      isOnline.value = false;
    }

  } catch (err) {
    console.error(err);
    isOnline.value = false;
  } finally {
    isLoading.value = false;
  }
});

const initiateUnlock = (bin) => {
  const user = JSON.parse(localStorage.getItem("autogcmUser") || "{}");
  if (!user.phone) {
      showStatus.value = {
        isOpen: true,
        type: 'error',
        title: 'Login Required',
        message: 'Please login to use this machine.'
      };
      return;
  }
  selectedBin.value = bin;
  showConfirm.value = true;
};

const handleConfirmUnlock = async () => {
  showConfirm.value = false; 
  isOpening.value = true; // START LOADING
  
  const user = JSON.parse(localStorage.getItem("autogcmUser") || "{}");

  const payload = {
      deviceNo: deviceNo,
      phone: user.phone,
      positionNo: selectedBin.value.positionNo
  };
  console.log("🔓 [REQUEST] Opening Door:", payload);
  
  try {
    const res = await openRubbishPort(deviceNo, user.phone, selectedBin.value.positionNo);
    
    console.log("🔓 [RESPONSE] Server Output:", res);

    if (res.code === 200) {
        showStatus.value = {
          isOpen: true,
          type: 'success',
          title: 'Opening Door...',
          message: `The ${selectedBin.value.translatedName} door is opening now.`
        };
    } else {
        let msg = res.msg || 'Unknown error';
        if (msg.includes('设备响应服务超时') || msg.includes('timeout') || msg.includes('Bad Gateway')) {
            msg = "The machine is not responding. It might be offline or busy. Please try again.";
        }
        showStatus.value = {
          isOpen: true,
          type: 'error',
          title: 'Failed to Open',
          message: msg
        };
    }
  } catch (e) {
    console.error("❌ [ERROR] Connection Failed:", e);
    showStatus.value = {
      isOpen: true,
      type: 'error',
      title: 'Connection Error',
      message: 'Could not connect to the server. Please check your internet.'
    };
  } finally {
    isOpening.value = false; // STOP LOADING (Always run this)
  }
};
</script>