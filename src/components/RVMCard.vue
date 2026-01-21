<template>
  <div class="bg-white rounded-2xl shadow-sm overflow-hidden w-80 flex-shrink-0 mx-2 hover:shadow-lg transition border border-gray-100">
    
    <div class="relative">
      <img :src="image" alt="RVM Machine" class="w-full h-36 object-cover" />
      
      <span class="absolute top-2 right-2 text-white text-xs px-3 py-1 rounded-md font-medium shadow-sm"
        :class="{
            'bg-green-500': status === 'Online',
            'bg-red-500': status === 'Bin Full' || status === 'Maintenance',
            'bg-gray-500': status === 'Offline'
        }">
        {{ translateStatus(status) }}
      </span>
    </div>

    <div class="p-4 relative">
      <div class="flex justify-between items-start text-gray-700 mb-3">
        <p class="font-semibold text-sm leading-tight flex-1 pr-2">{{ address }}</p>
        
        <div class="flex flex-col items-end gap-2 flex-shrink-0">
           <div class="flex items-center text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
              📍 {{ distance }} km
           </div>

           <a 
             v-if="latitude && longitude"
             :href="`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`"
             target="_blank"
             class="flex items-center gap-1 bg-green-600 text-white text-[10px] px-3 py-1.5 rounded-full font-bold shadow-sm hover:bg-green-700 transition"
           >
             <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
             </svg>
             GO
           </a>
        </div>
      </div>

      <div class="space-y-3 mt-4">
        <div v-for="(item, i) in compartments" :key="i" class="bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
          
          <div class="flex justify-between items-center mb-1">
            <div class="flex items-center space-x-2">
              <div class="w-2 h-2 rounded-full" 
                :class="{
                  'bg-green-500': item.color === 'green',
                  'bg-orange-500': item.color === 'orange',
                  'bg-blue-500': item.color === 'blue'
                }"></div>
              <span class="text-xs font-semibold text-gray-700">{{ translateWaste(item.label) }}</span>
            </div>

            <span class="text-xs font-bold uppercase tracking-wide"
              :class="{
                'text-green-600': item.statusColor === 'green',
                'text-red-500': item.statusColor === 'red',
                'text-orange-500': item.statusColor === 'orange'
              }">
              {{ translateState(item.statusText) }} ({{ item.percent }}%)
            </span>
          </div>

          <div class="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500"
              :class="{
                'bg-green-500': item.percent < 80,
                'bg-orange-500': item.percent >= 80 && item.percent < 95,
                'bg-red-500': item.percent >= 95
              }"
              :style="{ width: item.percent + '%' }">
            </div>
          </div>

        </div>
      </div>

      <p class="mt-4 text-[10px] text-gray-400 font-mono text-center">ID: {{ deviceNo }}</p>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();

defineProps({
  image: { type: String, default: "https://lassification.oss-cn-shenzhen.aliyuncs.com/static/mini/imgv2/cb83c4f1-6d9b-4455-a994-01f53b08c9ba.jpg" },
  status: String,
  deviceNo: String,
  distance: [Number, String],
  address: String,
  compartments: Array, 
  latitude: [Number, String], 
  longitude: [Number, String], 
});

// 1. Translate Machine Status (Online, Maintenance, etc)
const translateStatus = (status) => {
  if (!status) return "";
  const key = status.toLowerCase().replace(/\s+/g, '_'); // "Bin Full" -> "bin_full"
  return t(`rvm.status.${key}`);
};

// 2. Translate Waste Name (Paper, UCO, etc) - Same logic as Dashboard
const translateWaste = (name) => {
  if (!name) return "";
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const translated = t(`waste.${key}`);
  return translated.includes('waste.') ? name : translated;
};

// 3. Translate Compartment State (Available, Bin Full)
const translateState = (state) => {
  if (!state) return "";
  const key = state.toLowerCase().replace(/\s+/g, '_'); // "Available" -> "available"
  return t(`rvm.state.${key}`);
};
</script>