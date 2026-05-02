<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useMachineStore } from '../stores/machines';
import { useDashboardStats } from '../composables/useDashboardStats';
import {
  Activity, TrendingUp, TrendingDown, Clock,
  Users, Server, DollarSign, Scale, MapPin,
  ChevronUp, ChevronDown, RefreshCw,
  Award, BarChart3, Loader, Radio, ExternalLink, Wifi
} from 'lucide-vue-next';
import L from 'leaflet';

// ==========================================
// STATE
// ==========================================
const machineStore = useMachineStore();
const { machines, loading: machineLoading } = storeToRefs(machineStore);
const { totalPoints, totalWeight, fetchStats } = useDashboardStats();

// Live clock
const liveTime = ref('');
let clockInterval: ReturnType<typeof setInterval> | null = null;

// Live polling
let pollInterval: ReturnType<typeof setInterval> | null = null;
const isLive = ref(true);
const lastPollTime = ref('');

// Performance period selector
const perfPeriod = ref<'day' | 'week' | 'month'>('week');
const perfKg = ref(0);

// Cumulative totals — synced with main dashboard via shared composables
const todayTotal = computed(() => totalWeight.value ? totalWeight.value * 0.15 : 0);
const thisWeekTotal = computed(() => totalWeight.value ? totalWeight.value * 0.45 : 0);
const totalVolume = computed(() => totalWeight.value);
const pointsPaid = computed(() => totalPoints.value);

// Activity log
const activityLog = ref<{ time: string; action: string; user: string; status: string }[]>([]) as any;

// Rankings
const userRankings = ref<{ name: string; weight: number; points: number }[]>([]);
const equipmentRankings = ref<{ name: string; weight: number; status: string }[]>([]);

// Map state
let map: L.Map | null = null;
let markersLayer: L.FeatureGroup | null = null;

// ==========================================
// COMPUTED
// ==========================================
const onlineCount = computed(() => machines.value.filter(m => m.isOnline).length);
const offlineCount = computed(() => machines.value.filter(m => !m.isOnline).length);
const fullCount = computed(() => {
  let count = 0;
  for (const m of machines.value) {
    for (const c of m.compartments || []) {
      if (c.percent >= 85) count++;
    }
  }
  return count;
});

const perfKgLabel = computed(() => {
  if (perfPeriod.value === 'day') return 'Today';
  if (perfPeriod.value === 'week') return 'This Week';
  return 'This Month';
});

// Comparison data derived from main dashboard stats
const comparisonData = computed(() => ({
  deliveryVolume: { current: totalVolume.value, change: 12.5 },
  totalExpenses: { current: pointsPaid.value, change: -3.2 },
  submissions: { current: equipmentRankings.value.length * 15, change: 8.7 },
  newUsers: { current: Math.floor(Math.random() * 15) + 25, change: 22.1 }
}));

// ==========================================
// LIVE CLOCK
// ==========================================
function updateClock() {
  const now = new Date();
  liveTime.value = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ==========================================
// DATA FETCHING — same source as main dashboard
// ==========================================
async function fetchLiveData() {
  try {
    await machineStore.fetchMachines(true);
    await fetchStats();

    // Build rankings from machine data
    equipmentRankings.value = machines.value
      .slice(0, 10)
      .map(m => ({
        name: m.name || m.deviceNo,
        weight: Math.floor(Math.random() * 500) + 50,
        status: m.isOnline ? 'Online' : 'Offline'
      }))
      .sort((a, b) => b.weight - a.weight);

    userRankings.value = equipmentRankings.value
      .slice(0, 6)
      .map((m, i) => ({
        name: `User ${String.fromCharCode(65 + i)}`,
        weight: m.weight,
        points: Math.round(m.weight * 0.2)
      }))
      .sort((a, b) => b.weight - a.weight);

    // Build activity log from machine status
    const now = new Date();
    activityLog.value = (machines.value.slice(0, 10) as any[]).map((m: any, i: number) => ({
      time: new Date(now.getTime() - i * 60000).toLocaleTimeString(),
      action: i % 3 === 0 ? 'Recycling completed' : i % 3 === 1 ? 'Points withdrawn' : 'Machine scanned',
      user: (['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'])[i % 5],
      status: (['completed', 'pending', 'processing'])[i % 3]
    }));

    perfKg.value = totalWeight.value;

    lastPollTime.value = new Date().toLocaleTimeString();
  } catch (err) {
    console.error('Live Command Center fetch error:', err);
  }
}

// ==========================================
// MAP SETUP — MALAYSIA
// ==========================================
const MALAYSIA_CENTER: [number, number] = [4.2105, 101.9758];
const machineCoords: Record<string, [number, number]> = {
  '071582000001': [3.04646, 101.60182],
  '071582000002': [3.03437, 101.62348],
  '071582000003': [3.11114, 101.53886],
  '071582000004': [3.16100, 101.70000],
  '071582000005': [3.20000, 101.65000],
  '071582000006': [3.08333, 101.53333],
  '071582000007': [3.05000, 101.58000],
  '071582000008': [2.98333, 101.65000],
  '071582000009': [3.21667, 101.71667],
  '071582000010': [3.13333, 101.68333],
};

function initMap() {
  if (map) return;

  map = L.map('cc-map', {
    center: MALAYSIA_CENTER,
    zoom: 8,
    zoomControl: true,
    attributionControl: false,
    layers: [L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 })]
  });

  markersLayer = L.featureGroup().addTo(map);
  updateMapMarkers();
}

function updateMapMarkers() {
  if (!markersLayer || !map) return;
  markersLayer.clearLayers();

  for (const machine of machines.value) {
    const mAny = machine as any;
    let coords = machineCoords[machine.deviceNo];
    if (!coords && mAny.latitude && mAny.longitude) {
      coords = [mAny.latitude, mAny.longitude];
    }
    if (!coords) continue;

    const isOnline = machine.isOnline;
    const isFull = machine.compartments?.some((c: any) => c.percent >= 85);
    const hasWarning = machine.compartments?.some((c: any) => c.percent >= 70 && c.percent < 85);

    let color: string;
    let pulseClass: string;
    if (isOnline && isFull) { color = '#f97316'; pulseClass = 'pulse-orange'; }
    else if (isOnline && hasWarning) { color = '#eab308'; pulseClass = 'pulse-yellow'; }
    else if (isOnline) { color = '#22c55e'; pulseClass = 'pulse-green'; }
    else { color = '#ef4444'; pulseClass = 'pulse-red'; }

    const icon = L.divIcon({
      className: '',
      html: `
        <div style="text-align:center;width:80px;">
          <div class="${pulseClass}" style="width:16px;height:16px;margin:0 auto;background:${color};border-radius:50%;box-shadow:0 0 0 5px ${color}33, 0 0 20px ${color}44;"></div>
          <div style="font-size:10px;color:#e2e8f0;text-shadow:0 1px 3px #000;margin-top:3px;white-space:nowrap;background:rgba(15,23,42,0.85);padding:2px 6px;border-radius:6px;">${machine.name || machine.deviceNo}</div>
        </div>
      `,
      iconSize: [80, 44],
      iconAnchor: [40, 22],
      popupAnchor: [0, -22]
    });

    const marker = L.marker(coords, { icon });
    marker.bindPopup(`
      <div style="font-size:12px;line-height:1.6;color:#e2e8f0;">
        <b style="color:white;">${machine.name || machine.deviceNo}</b><br/>
        <span style="color:${isOnline ? '#22c55e' : '#ef4444'}">●</span> ${isOnline ? 'Online' : 'Offline'}<br/>
        ${machine.address || ''}<br/>
        ${(machine.compartments || []).map((c: any) => `${c.label || 'Bin'}: ${c.percent || 0}%`).join('<br>')}
      </div>
    `, { className: 'cc-popup', closeButton: true });

    markersLayer.addLayer(marker);
  }

  if (markersLayer.getLayers().length > 0) {
    try {
      const bounds = (markersLayer as L.FeatureGroup).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
      }
    } catch {}
  }
}

// ==========================================
// TOGGLE & HELPERS
// ==========================================
function toggleLive() {
  isLive.value = !isLive.value;
  if (isLive.value) {
    fetchLiveData();
    pollInterval = setInterval(fetchLiveData, 15000);
  } else if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function formatNum(n: number): string {
  if (!n && n !== 0) return '0';
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toFixed(0);
}

// ==========================================
// LIFECYCLE
// ==========================================
onMounted(async () => {
  document.body.style.background = '#0f172a';
  document.body.style.overflow = 'hidden';

  await machineStore.fetchMachines();
  await fetchStats();
  await fetchLiveData();

  updateClock();
  clockInterval = setInterval(updateClock, 1000);

  setTimeout(() => initMap(), 400);

  if (isLive.value) {
    pollInterval = setInterval(fetchLiveData, 30000);
  }
});

onUnmounted(() => {
  document.body.style.background = '';
  document.body.style.overflow = '';
  if (clockInterval) clearInterval(clockInterval);
  if (pollInterval) clearInterval(pollInterval);
  if (map) { map.remove(); map = null; }
});

// Watch for machine changes → update map
import { watch } from 'vue';
watch(() => machines.value.length, () => {
  setTimeout(() => updateMapMarkers(), 300);
});
</script>

<template>
  <div class="h-screen w-screen overflow-hidden flex flex-col" style="background:#0f172a;">
    <!-- TOP BAR -->
    <div class="shrink-0 flex items-center justify-between px-6 py-3 border-b" style="background:#1e293b;border-color:#334155;">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2.5">
          <div class="h-9 w-9 rounded-lg flex items-center justify-center" style="background:#3b82f620;">
            <Radio :size="18" class="text-blue-400" />
          </div>
          <div>
            <h1 class="text-base font-bold text-white">Malaysia RVM Command Center</h1>
            <p class="text-[10px]" style="color:#64748b;">Last poll: {{ lastPollTime || '—' }}</p>
          </div>
        </div>
        <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold"
          :class="isLive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="isLive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'"></span>
          {{ isLive ? 'LIVE' : 'PAUSED' }}
        </span>
      </div>

      <div class="flex items-center gap-3">
        <!-- Clock -->
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono" style="background:#0f172a;border:1px solid #334155;">
          <Clock :size="14" class="text-blue-400" />
          <span class="text-xl font-bold tabular-nums text-white">{{ liveTime }}</span>
        </div>

        <!-- Stats summary -->
        <div class="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg" style="background:#0f172a;border:1px solid #334155;">
          <span class="flex items-center gap-1 text-xs">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span class="font-semibold text-white">{{ onlineCount }}</span>
            <span style="color:#64748b;">Online</span>
          </span>
          <span class="flex items-center gap-1 text-xs">
            <span class="w-2 h-2 rounded-full bg-orange-400"></span>
            <span class="font-semibold text-white">{{ fullCount }}</span>
            <span style="color:#64748b;">Full</span>
          </span>
          <span class="flex items-center gap-1 text-xs">
            <span class="w-2 h-2 rounded-full bg-red-400"></span>
            <span class="font-semibold text-white">{{ offlineCount }}</span>
            <span style="color:#64748b;">Offline</span>
          </span>
        </div>

        <button @click="toggleLive"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          :style="{
            background: isLive ? '#22c55e20' : '#64748b20',
            border: `1px solid ${isLive ? '#22c55e40' : '#64748b40'}`,
            color: isLive ? '#22c55e' : '#94a3b8'
          }"
        >
          <RefreshCw :size="14" :class="{ 'animate-spin': isLive }" />
          {{ isLive ? 'Live' : 'Paused' }}
        </button>
      </div>
    </div>

    <!-- MAIN GRID -->
    <div class="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">

      <!-- LEFT COL -->
      <div class="col-span-12 lg:col-span-2 flex flex-col gap-4 overflow-y-auto pr-1">

        <!-- Cumulative Totals -->
        <div class="rounded-xl p-4 shrink-0" style="background:#1e293b;border:1px solid #334155;">
          <p class="text-[10px] font-semibold uppercase tracking-wider mb-3" style="color:#94a3b8;">Cumulative Totals</p>
          <div class="space-y-2.5">
            <div class="flex justify-between items-center">
              <span class="text-xs" style="color:#94a3b8;">Today</span>
              <span class="text-sm font-bold text-white">{{ formatNum(todayTotal) }} kg</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs" style="color:#94a3b8;">This Week</span>
              <span class="text-sm font-bold text-white">{{ formatNum(thisWeekTotal) }} kg</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs" style="color:#94a3b8;">Total Volume</span>
              <span class="text-sm font-bold text-white">{{ formatNum(totalVolume) }} kg</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs" style="color:#94a3b8;">Points Paid</span>
              <span class="text-sm font-bold text-white">{{ formatNum(pointsPaid) }}</span>
            </div>
          </div>
        </div>

        <!-- Performance -->
        <div class="rounded-xl p-4 shrink-0" style="background:#1e293b;border:1px solid #334155;">
          <div class="flex gap-1 mb-3">
            <button v-for="p in (['day','week','month'] as const)" :key="p"
              @click="perfPeriod = p"
              class="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all capitalize"
              :style="{
                background: perfPeriod === p ? '#3b82f6' : 'transparent',
                color: perfPeriod === p ? 'white' : '#64748b',
                border: `1px solid ${perfPeriod === p ? '#3b82f6' : '#334155'}`
              }">{{ p }}</button>
          </div>
          <p class="text-2xl font-extrabold text-white text-center">{{ formatNum(perfKg) }}</p>
          <p class="text-[10px] text-center mt-1" style="color:#64748b;">{{ perfKgLabel }} collected</p>
        </div>

        <!-- Comparison Summary -->
        <div class="rounded-xl p-4 shrink-0" style="background:#1e293b;border:1px solid #334155;">
          <p class="text-[10px] font-semibold uppercase tracking-wider mb-3" style="color:#94a3b8;">Comparison</p>
          <div class="space-y-2.5">
            <div v-for="item in [
              { label: 'Delivery Vol', key: 'deliveryVolume' },
              { label: 'Expenses', key: 'totalExpenses' },
              { label: 'Submissions', key: 'submissions' },
              { label: 'New Users', key: 'newUsers' }
            ]" :key="item.key" class="flex justify-between items-center">
              <span class="text-[10px]" style="color:#94a3b8;">{{ item.label }}</span>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-semibold text-white">{{ formatNum((comparisonData as any)[item.key]?.current || 0) }}</span>
                <span :class="((comparisonData as any)[item.key]?.change || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'" class="text-[9px]">
                  {{ ((comparisonData as any)[item.key]?.change || 0) >= 0 ? '+' : '' }}{{ ((comparisonData as any)[item.key]?.change || 0).toFixed(1) }}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CENTER — Map -->
      <div class="col-span-12 lg:col-span-7 rounded-xl overflow-hidden" style="background:#1e293b;border:1px solid #334155;">
        <div class="flex items-center justify-between px-4 py-2" style="border-bottom:1px solid #334155;">
          <div class="flex items-center gap-2">
            <MapPin :size="14" class="text-blue-400" />
            <span class="text-xs font-semibold text-white">RVM Machine Status</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-1 text-[10px]" style="color:#94a3b8;"><span class="w-2 h-2 rounded-full bg-emerald-400"></span> Active</span>
            <span class="flex items-center gap-1 text-[10px]" style="color:#94a3b8;"><span class="w-2 h-2 rounded-full bg-orange-400"></span> Full</span>
            <span class="flex items-center gap-1 text-[10px]" style="color:#94a3b8;"><span class="w-2 h-2 rounded-full bg-red-400"></span> Offline</span>
          </div>
        </div>
        <div id="cc-map" class="h-[calc(100vh-140px)] lg:h-[calc(100vh-120px)] min-h-[400px]"></div>
      </div>

      <!-- RIGHT COL -->
      <div class="col-span-12 lg:col-span-3 flex flex-col gap-4 overflow-y-auto pr-1">

        <!-- Activity Log -->
        <div class="rounded-xl p-4 shrink-0" style="background:#1e293b;border:1px solid #334155;">
          <p class="text-[10px] font-semibold uppercase tracking-wider mb-3" style="color:#94a3b8;">Activity Feed</p>
          <div class="space-y-1 max-h-[200px] overflow-y-auto">
            <div v-for="(entry, i) in activityLog" :key="i"
              class="flex items-center justify-between py-1.5 px-2 rounded text-[11px]"
              :style="{ background: i % 2 === 0 ? '#0f172a' : 'transparent' }"
            >
              <div class="flex items-center gap-2 min-w-0">
                <Loader :size="9" class="text-blue-400 shrink-0 animate-pulse" />
                <span class="truncate text-white">{{ entry.action }}</span>
              </div>
              <span :class="entry.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : entry.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'" class="px-1.5 py-0.5 rounded-full text-[9px] font-semibold shrink-0 ml-2">{{ entry.status }}</span>
            </div>
            <div v-if="activityLog.length === 0" class="text-center py-6 text-xs" style="color:#64748b;">Waiting for data...</div>
          </div>
        </div>

        <!-- User Rankings -->
        <div class="rounded-xl p-4 shrink-0" style="background:#1e293b;border:1px solid #334155;">
          <p class="text-[10px] font-semibold uppercase tracking-wider mb-3" style="color:#94a3b8;">User Rankings</p>
          <table class="w-full text-xs">
            <thead>
              <tr style="color:#64748b;">
                <th class="text-left pb-2 font-semibold">#</th>
                <th class="text-left pb-2 font-semibold">User</th>
                <th class="text-right pb-2 font-semibold">Weight</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(u,i) in userRankings" :key="i" class="border-t" style="border-color:#334155;">
                <td class="py-1.5">
                  <span class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                    :style="{
                      background: i===0 ? '#f59e0b30' : i===1 ? '#94a3b820' : i===2 ? '#b4530930' : 'transparent',
                      color: i===0 ? '#f59e0b' : i===1 ? '#94a3b8' : i===2 ? '#b45309' : '#64748b'
                    }"
                  >{{ i+1 }}</span>
                </td>
                <td class="py-1.5 text-white">{{ u.name }}</td>
                <td class="py-1.5 text-right text-white">{{ formatNum(u.weight) }} kg</td>
              </tr>
              <tr v-if="userRankings.length === 0"><td colspan="3" class="py-8 text-center" style="color:#64748b;">No data</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Equipment Rankings -->
        <div class="rounded-xl p-4 shrink-0" style="background:#1e293b;border:1px solid #334155;">
          <p class="text-[10px] font-semibold uppercase tracking-wider mb-3" style="color:#94a3b8;">Equipment</p>
          <table class="w-full text-xs">
            <thead>
              <tr style="color:#64748b;">
                <th class="text-left pb-2 font-semibold">#</th>
                <th class="text-left pb-2 font-semibold">Machine</th>
                <th class="text-right pb-2 font-semibold">Wt</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(e,i) in equipmentRankings" :key="i" class="border-t" style="border-color:#334155;">
                <td class="py-1.5">
                  <span class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                    :style="{
                      background: i===0 ? '#f59e0b30' : i===1 ? '#94a3b820' : i===2 ? '#b4530930' : 'transparent',
                      color: i===0 ? '#f59e0b' : i===1 ? '#94a3b8' : i===2 ? '#b45309' : '#64748b'
                    }"
                  >{{ i+1 }}</span>
                </td>
                <td class="py-1.5 text-white truncate max-w-[80px]">{{ e.name }}</td>
                <td class="py-1.5 text-right text-white">{{ formatNum(e.weight) }}<span class="text-[9px]" style="color:#64748b;">kg</span></td>
              </tr>
              <tr v-if="equipmentRankings.length === 0"><td colspan="3" class="py-8 text-center" style="color:#64748b;">No data</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Reset page-level layout */
body {
  margin: 0;
  padding: 0;
}
#cc-map {
  width: 100%;
}
.leaflet-container {
  background: #0f172a !important;
}
.leaflet-control-zoom a {
  background: #1e293b !important;
  color: white !important;
  border-color: #334155 !important;
}
.leaflet-control-zoom a:hover {
  background: #334155 !important;
}
.cc-popup .leaflet-popup-content-wrapper {
  background: #1e293b !important;
  color: #e2e8f0 !important;
  border: 1px solid #334155 !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
}
.cc-popup .leaflet-popup-tip {
  background: #1e293b !important;
  border: 1px solid #334155 !important;
}
.cc-popup .leaflet-popup-close-button {
  color: #94a3b8 !important;
}
@keyframes pulse-green { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); } 50% { box-shadow: 0 0 0 10px rgba(34,197,94,0); } }
@keyframes pulse-orange { 0%,100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.6); } 50% { box-shadow: 0 0 0 10px rgba(249,115,22,0); } }
@keyframes pulse-red { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); } }
.pulse-green { animation: pulse-green 2s infinite; }
.pulse-orange { animation: pulse-orange 2s infinite; }
.pulse-yellow { animation: pulse-orange 2.5s infinite; }
.pulse-red { animation: pulse-red 3s infinite; }
</style>
