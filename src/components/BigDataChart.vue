<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  data: any[];
  xKey: string;
  series: { key: string; color: string; label: string }[];
}>();

const container = ref<HTMLElement | null>(null);
const hoverIndex = ref<number | null>(null);
const containerWidth = ref(800);

const padding = { top: 20, right: 30, bottom: 30, left: 40 }; 
const height = 350; 

// Responsive Width Observer
const updateWidth = () => {
  if (container.value) {
    containerWidth.value = container.value.clientWidth;
  }
};

onMounted(() => {
  updateWidth();
  window.addEventListener('resize', updateWidth);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateWidth);
});

// Format Y-Axis numbers (e.g. 1.2k, 500)
const formatY = (val: number) => {
  if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
  return Math.round(val).toString();
};

// Format X-Axis dates (MM-DD)
const formatX = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const processedData = computed(() => {
  if (!props.data || props.data.length === 0) return { lines: [], maxY: 10, xTicks: [] };
  
  const width = containerWidth.value;

  // Calculate Max Y
  const allValues = props.series.flatMap(s => props.data.map(d => Number(d[s.key]) || 0));
  const maxY = Math.max(...allValues, 10) * 1.1; // Add 10% headroom
  
  // Generate Lines
  const lines = props.series.map(s => {
    const coords = props.data.map((d, i) => {
      const count = props.data.length;
      const xRatio = count > 1 ? i / (count - 1) : 0.5;
      const x = padding.left + xRatio * (width - padding.left - padding.right);
      
      const val = Number(d[s.key]) || 0;
      const y = (height - padding.bottom) - (val / maxY) * (height - padding.top - padding.bottom);
      
      return { x, y, val, data: d };
    });
    
    return {
      key: s.key,
      color: s.color,
      pointsStr: coords.map(p => `${p.x},${p.y}`).join(' '),
      coords
    };
  });

  // Calculate X-Axis Ticks (Limit to 6 ticks to prevent crowding)
  const xTicks = props.data.map((d, i) => {
      const count = props.data.length;
      const xRatio = count > 1 ? i / (count - 1) : 0.5;
      const x = padding.left + xRatio * (width - padding.left - padding.right);
      return { x, label: formatX(d[props.xKey]), original: d };
  }).filter((_, i, arr) => {
     if (arr.length <= 6) return true;
     const step = Math.floor(arr.length / 5);
     return i % step === 0 || i === arr.length - 1;
  });

  return { lines, maxY, xTicks };
});

// ✅ NEW: Dynamic Tooltip Positioning
const tooltipStyle = computed(() => {
  if (hoverIndex.value === null || !processedData.value.lines.length) return {};
  
  // Get the X coordinate of the current hover point
  const point = processedData.value.lines[0]?.coords[hoverIndex.value];
  if (!point) return {};

  const x = point.x;
  const w = containerWidth.value;
  
  // Define a "Safety Zone" (approx tooltip width)
  // If closer than this to the edge, we shift alignment.
  const safetyZone = 160; 

  let transform = 'translateX(-50%)'; // Default: Center

  if (x < safetyZone) {
     // Too close to LEFT edge -> Align Left (shifted slightly right)
     transform = 'translateX(-10px)'; 
  } else if (x > w - safetyZone) {
     // Too close to RIGHT edge -> Align Right (shifted slightly left)
     transform = 'translateX(calc(-100% + 10px))';
  }

  return {
    left: `${x}px`,
    top: '0px', // Sticks to top of chart area
    transform
  };
});

const onMouseMove = (e: MouseEvent) => {
  if (!container.value || !props.data.length) return;
  const rect = container.value.getBoundingClientRect();
  const relX = e.clientX - rect.left;
  
  const chartWidth = rect.width; 
  const count = props.data.length;
  const ratio = (relX / chartWidth);
  let idx = Math.round(ratio * (count - 1));
  
  if (idx < 0) idx = 0;
  if (idx >= count) idx = count - 1;
  
  hoverIndex.value = idx;
};

const onMouseLeave = () => {
  hoverIndex.value = null;
};
</script>

<template>
  <div 
    class="w-full h-full flex flex-col relative group" 
    ref="container"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div class="flex-1 min-h-0 w-full relative">
      
      <div v-if="!data || data.length === 0" class="absolute inset-0 flex items-center justify-center text-slate-300 text-xs font-bold uppercase tracking-widest">
        No Data Available
      </div>

      <svg v-else :viewBox="`0 0 ${containerWidth} ${height}`" class="w-full h-full overflow-visible">
        
        <g class="text-[10px] fill-slate-400 font-mono select-none">
           <line :x1="padding.left" :y1="padding.top" :x2="containerWidth - padding.right" :y2="padding.top" stroke="#f1f5f9" stroke-dasharray="4"/>
           <text :x="padding.left - 5" :y="padding.top + 4" text-anchor="end">{{ formatY(processedData.maxY) }}</text>

           <line :x1="padding.left" :y1="height/2" :x2="containerWidth - padding.right" :y2="height/2" stroke="#f1f5f9" stroke-dasharray="4"/>
           <text :x="padding.left - 5" :y="height/2 + 4" text-anchor="end">{{ formatY(processedData.maxY / 2) }}</text>

           <line :x1="padding.left" :y1="height - padding.bottom" :x2="containerWidth - padding.right" :y2="height - padding.bottom" stroke="#cbd5e1"/>
           <text :x="padding.left - 5" :y="height - padding.bottom + 4" text-anchor="end">0</text>
        </g>

        <g class="text-[10px] fill-slate-400 font-mono select-none">
          <text 
            v-for="tick in processedData.xTicks" :key="tick.x"
            :x="tick.x" 
            :y="height - 5" 
            text-anchor="middle"
          >
            {{ tick.label }}
          </text>
        </g>

        <g v-for="s in processedData.lines" :key="s.key">
          <polyline
            :points="s.pointsStr"
            fill="none"
            :stroke="s.color"
            stroke-width="2" 
            stroke-linecap="round"
            stroke-linejoin="round"
            class="drop-shadow-sm transition-all duration-300"
            :class="{'opacity-30': hoverIndex !== null}"
          />
        </g>

        <line 
           v-if="hoverIndex !== null && processedData.lines.length > 0"
           :x1="processedData.lines[0]?.coords[hoverIndex]?.x ?? 0"
           :y1="padding.top"
           :x2="processedData.lines[0]?.coords[hoverIndex]?.x ?? 0"
           :y2="height - padding.bottom"
           stroke="#94a3b8"
           stroke-width="1"
           stroke-dasharray="4"
        />

        <g v-if="hoverIndex !== null">
            <circle 
              v-for="s in processedData.lines" :key="s.key"
              :cx="s.coords[hoverIndex]?.x ?? 0" 
              :cy="s.coords[hoverIndex]?.y ?? 0" 
              r="4" 
              fill="white" 
              :stroke="s.color" 
              stroke-width="2" 
            />
        </g>
      </svg>
      
      <div 
        v-if="hoverIndex !== null && data[hoverIndex] && processedData.lines.length > 0"
        class="absolute z-50 bg-white/95 backdrop-blur shadow-xl border border-slate-200 rounded-lg p-3 text-xs pointer-events-none transition-all duration-75"
        :style="tooltipStyle"
      >
         <div class="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1 whitespace-nowrap">
            {{ data[hoverIndex][xKey] }}
         </div>
         
         <slot name="tooltip" :item="data[hoverIndex]"></slot>

         <div v-if="!$slots.tooltip" class="flex flex-col gap-1">
            <div v-for="s in series" :key="s.key" class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full" :style="{background: s.color}"></span>
                <span class="text-slate-500">{{ s.label }}:</span>
                <span class="font-bold">{{ data[hoverIndex][s.key] }}</span>
            </div>
         </div>
      </div>

    </div>
    
    <div class="flex flex-wrap gap-4 mt-2 justify-center shrink-0">
      <div v-for="s in series" :key="s.key" class="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase">
        <span class="w-2 h-2 rounded-full" :style="{ background: s.color }"></span>
        {{ s.label }}
      </div>
    </div>
  </div>
</template>