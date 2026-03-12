<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import 'leaflet/dist/leaflet.css';
import { LMap, LTileLayer, LCircleMarker, LPopup } from '@vue-leaflet/vue-leaflet';
import L from 'leaflet';

const props = defineProps<{ machines: any[] }>();
const zoom = ref(6);
const center = ref<[number, number]>([4.2105, 101.9758]); 

const clusteredMachines = computed(() => {
  const groups: Record<string, any[]> = {};

  props.machines.forEach(m => {
      const lat = m.latitude ? Number(m.latitude).toFixed(4) : '0';
      const lng = m.longitude ? Number(m.longitude).toFixed(4) : '0';
      
      if (lat === '0' || lng === '0') return;

      const key = `${lat},${lng}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
  });

  return Object.values(groups).map(group => {
      const isOnline = group.some(m => 
          m.is_active === true || 
          m.is_online === true || 
          m.isOnline === true || 
          String(m.status).toUpperCase() === 'ONLINE'
      );

      return {
          id: group[0].id, 
          lat: Number(group[0].latitude),
          lng: Number(group[0].longitude),
          machines: group,
          isOnline
      };
  });
});

onMounted(() => {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
    iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
    shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
  });
});
</script>

<template>
  <div class="h-full w-full relative z-0">
    <l-map v-model:zoom="zoom" :center="center" :use-global-leaflet="false">
      <l-tile-layer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        layer-type="base"
        name="Clean Map"
        attribution="&copy; OpenStreetMap"
      ></l-tile-layer>

      <l-circle-marker
        v-for="cluster in clusteredMachines"
        :key="cluster.id"
        :lat-lng="[cluster.lat, cluster.lng]" 
        :radius="6 + (cluster.machines.length * 1.5)" 
        :color="cluster.isOnline ? '#16a34a' : '#ef4444'"
        :fill-color="cluster.isOnline ? '#22c55e' : '#f87171'"
        :fill-opacity="0.8"
        :weight="2"
      >
        <l-popup>
          <div class="max-h-64 overflow-y-auto custom-scrollbar">
            <div class="text-[10px] uppercase font-bold text-slate-400 mb-2 border-b pb-1">
              {{ cluster.machines.length }} Device{{ cluster.machines.length > 1 ? 's' : '' }} Here
            </div>

            <div 
                v-for="m in cluster.machines" 
                :key="m.device_no" 
                class="mb-3 last:mb-0 border-b border-gray-100 last:border-0 pb-2 last:pb-0"
            >
                <strong class="block text-slate-800 text-sm mb-0.5">
                   {{ m.name || m.location_name || `RVM-${m.device_no}` }}
                </strong>
                
                <span class="text-slate-500 block text-xs mb-1 font-mono">ID: {{ m.device_no }}</span>
                
                <div class="text-xs font-bold flex items-center gap-1" 
                    :class="(m.is_active || m.is_online || m.isOnline) ? 'text-green-600' : 'text-red-500'">
                    <span class="w-1.5 h-1.5 rounded-full" 
                        :class="(m.is_active || m.is_online || m.isOnline) ? 'bg-green-500' : 'bg-red-500'">
                    </span>
                    {{ (m.is_active || m.is_online || m.isOnline) ? 'ONLINE' : 'OFFLINE' }}
                </div>
            </div>
          </div>
        </l-popup>
      </l-circle-marker>
    </l-map>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 3px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
</style>