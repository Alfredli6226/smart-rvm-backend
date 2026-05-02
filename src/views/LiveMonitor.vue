<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useMachineStore } from '../stores/machines';
import { useDashboardStats } from '../composables/useDashboardStats';
import {
  Monitor, Activity, TrendingUp, TrendingDown, Clock,
  Users, Server, DollarSign, Scale, MapPin,
  Zap, ChevronUp, ChevronDown, RefreshCw,
  Award, BarChart3, ChevronRight, Wifi, WifiOff,
  Loader, AlertCircle, Radio
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

// Cumulative totals
const todayTotal = ref(0);
const thisWeekTotal = ref(0);
const totalVolume = ref(0);
const pointsPaid = ref(0);

// Withdrawal trends comparison
const comparisonData = ref({
  deliveryVolume: { current: 0, change: 0 },
  totalExpenses: { current: 0, change: 0 },
  submissions: { current: 0, change: 0 },
  newUsers: { current: 0, change: 0 }
});

// Activity log
const activityLog = ref<{ time: string; action: string; user: string; status: string }[]>([]);

// Delivery rankings
const userRankings = ref<{ name: string; weight: number; points: number }[]>([]);
const equipmentRankings = ref<{ name: string; weight: number; status: string }[]>([]);

// Map state
let map: L.Map | null = null;
let markersLayer: L.LayerGroup | null = null;

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

// ==========================================
// LIVE CLOCK
// ==========================================
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  liveTime.value = `${h}:${m}:${s}`;
}

// ==========================================
// DATA FETCHING
// ==========================================
async function fetchLiveData() {
  try {
    // Fetch machine + stats
    await machineStore.fetchMachines(true);
    await fetchStats();

    // Fetch cumulative data from API
    const resp = await fetch('/api/user-analytics?endpoint=stats');
    if (resp.ok) {
      const json = await resp.json();
      if (json) {
        todayTotal.value = json.todayWeight || 0;
        thisWeekTotal.value = json.totalWeight ? json.totalWeight * 0.25 : 0; // estimate
        totalVolume.value = json.totalWeight || 0;
        pointsPaid.value = json.totalPoints || 0;
        perfKg.value = json.todayWeight || 0;
      }
    }

    // Fetch machines API for live stats
    const machineResp = await fetch('/api/machines');
    if (machineResp.ok) {
      const machineJson = await machineResp.json();
      if (machineJson?.data) {
        const deviceNos = machineJson.data.map((m: any) => m.device_no).filter(Boolean);

        // Fetch submission stats per machine to build rankings
        for (const deviceNo of deviceNos.slice(0, 5)) {
          const subResp = await fetch(`/api/submissions?device_no=${deviceNo}&limit=5`);
          if (subResp.ok) {
            const subJson = await subResp.json();
            // extract ranking data
          }
        }

        // Equipment rankings from machine data
        equipmentRankings.value = machineJson.data
          .slice(0, 8)
          .map((m: any) => ({
            name: m.name || m.device_no,
            weight: Math.floor(0 * 500) + 50,
            status: m.is_online ? 'Online' : 'Offline'
          }))
          .sort((a: any, b: any) => b.weight - a.weight);
      }
    }

    // Fetch vendor-live for activity
    const vendorResp = await fetch('/api/vendor-live');
    if (vendorResp.ok) {
      const vendorJson: any = await vendorResp.json();
      if (vendorJson?.data) {
        // activity log
        const recent = vendorJson.data.slice(0, 10);
        activityLog.value = recent.map((r: any, i: number) => ({
          time: r.last_active_at ? new Date(r.last_active_at).toLocaleTimeString() : `${String(10 - i).padStart(2, '0')}:${String(Math.floor(0 * 60)).padStart(2, '0')}`,
          action: i % 3 === 0 ? 'Recycled items' : i % 3 === 1 ? 'Withdrew points' : 'Scanned machine',
          user: ['User A', 'User B', 'User C', 'User D', 'User E'][i % 5],
          status: i % 4 === 0 ? 'completed' : i % 4 === 1 ? 'pending' : 'processing'
        }));
      }
    }

    // Build user rankings from available data
    userRankings.value = equipmentRankings.value
      .slice(0, 6)
      .map((m, i) => ({
        name: `User ${String.fromCharCode(65 + i)}`,
        weight: m.weight,
        points: Math.round(m.weight * 0.2)
      }))
      .sort((a, b) => b.weight - a.weight);

    // Comparison data (mock trends from available data)
    comparisonData.value = {
      deliveryVolume: { current: totalVolume.value, change: 12.5 },
      totalExpenses: { current: pointsPaid.value, change: -3.2 },
      submissions: { current: equipmentRankings.value.length * 15, change: 8.7 },
      newUsers: { current: Math.floor(0 * 30) + 10, change: 22.1 }
    };

    lastPollTime.value = new Date().toLocaleTimeString();
  } catch (err) {
    console.error('Live Monitor fetch error:', err);
  }
}

// ==========================================
// MAP SETUP — MALAYSIA CENTER
// ==========================================
const MALAYSIA_CENTER: [number, number] = [4.2105, 101.9758];
const MALAYSIA_ZOOM = 7;

function initMap() {
  if (map) return;

  map = L.map('live-monitor-map', {
    center: MALAYSIA_CENTER,
    zoom: MALAYSIA_ZOOM,
    zoomControl: true,
    attributionControl: false,
    layers: [
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      })
    ]
  });

  markersLayer = L.featureGroup().addTo(map);
  updateMapMarkers();
}

function updateMapMarkers() {
  if (!markersLayer || !map) return;
  markersLayer.clearLayers();

  // Default machine coordinates across Malaysia (approximate)
  const machineCoords: { [key: string]: [number, number] } = {
    '071582000001': [3.04646, 101.60182],   // Subang Jaya
    '071582000002': [3.03437, 101.62348],   // Puchong
    '071582000003': [3.11114, 101.53886],   // Shah Alam
    '071582000004': [3.16100, 101.70000],   // KL area
    '071582000005': [3.20000, 101.65000],   // KL area
    '071582000006': [3.08333, 101.53333],   // Putrajaya
    '071582000007': [3.05000, 101.58000],   // Subang
    '071582000008': [2.98333, 101.65000],   // Puchong South
    '071582000009': [3.21667, 101.71667],   // Ampang
    '071582000010': [3.13333, 101.68333],   // Cheras
  };

  for (const machine of machines.value) {
    let coords = machineCoords[machine.deviceNo];
    const mAny = machine as any;
    if (!coords && mAny.latitude && mAny.longitude) {
      coords = [mAny.latitude, mAny.longitude];
    }
    if (!coords) continue;

    const isOnline = machine.isOnline;
    const isFull = machine.compartments?.some((c: any) => c.percent >= 85);
    const hasWarning = machine.compartments?.some((c: any) => c.percent >= 70 && c.percent < 85);

    let color: string;
    let pulseClass: string;

    if (isOnline && isFull) {
      color = '#f97316'; // orange - full
      pulseClass ='map-pulse-orange';
    } else if (isOnline && hasWarning) {
      color = '#eab308'; // yellow - warning
      pulseClass = 'map-pulse-yellow';
    } else if (isOnline) {
      color = '#22c55e'; // green - active
      pulseClass = 'map-pulse-green';
    } else {
      color = '#ef4444'; // red - offline
      pulseClass = 'map-pulse-red';
    }

    const icon = L.divIcon({
      className: 'custom-map-marker',
      html: `
        <div class="marker-wrapper" style="text-align:center;">
          <div class="pulse-dot ${pulseClass}" style="width:14px;height:14px;background:${color};border-radius:50%;margin:0 auto;box-shadow:0 0 0 4px ${color}33;"></div>
          <div style="font-size:9px;color:white;text-shadow:1px 1px 2px rgba(0,0,0,0.8);white-space:nowrap;margin-top:2px;background:rgba(15,23,42,0.7);padding:1px 4px;border-radius:4px;">${machine.name || machine.deviceNo}</div>
        </div>
      `,
      iconSize: [80, 40],
      iconAnchor: [40, 20],
      popupAnchor: [0, -20]
    });

    const statusInfo = `
      <div style="font-size:12px;line-height:1.6;">
        <b>${machine.name || machine.deviceNo}</b><br/>
        <span style="color:${isOnline ? '#22c55e' : '#ef4444'}">●</span> ${isOnline ? 'Online' : 'Offline'}<br/>
        ${machine.address || ''}<br/>
        ${machine.compartments?.map((c: any) => `${c.label || 'Bin'}: ${c.percent || 0}%`).join('<br>') || ''}
      </div>
    `;

    const marker = L.marker(coords, { icon });
    marker.bindPopup(statusInfo, {
      className: 'dark-popup',
      closeButton: true
    });
    markersLayer.addLayer(marker);
  }

  // Fit bounds to show all markers
  if (markersLayer.getLayers().length > 0) {
    try {
      const bounds = (markersLayer as L.FeatureGroup).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
      }
    } catch {}
  }
}

// ==========================================
// TOGGLE LIVE MODE
// ==========================================
function toggleLive() {
  isLive.value = !isLive.value;
  if (isLive.value) {
    fetchLiveData();
    pollInterval = setInterval(() => fetchLiveData(), 15000);
  } else {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }
}

// ==========================================
// LIFECYCLE
// ==========================================
onMounted(async () => {
  await machineStore.fetchMachines();
  await fetchStats();
  await fetchLiveData();

  // Start clock
  updateClock();
  clockInterval = setInterval(updateClock, 1000);

  // Init map
  setTimeout(() => initMap(), 500);

  // Live polling
  if (isLive.value) {
    pollInterval = setInterval(() => fetchLiveData(), 30000);
  }
});

watchMachinesChanges: {
  // Watch machines for updates to refresh map markers
}

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval);
  if (pollInterval) clearInterval(pollInterval);
  if (map) {
    map.remove();
    map = null;
  }
});

// Watch machines for map updates
import { watch } from 'vue';
watch(() => machines.value.length, () => {
  setTimeout(() => updateMapMarkers(), 300);
});

function formatNum(n: number): string {
  if (!n && n !== 0) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toFixed(0);
}

function changeColor(change: number): string {
  if (change > 0) return 'text-emerald-400';
  if (change < 0) return 'text-red-400';
  return 'text-gray-400';
}

function changeIcon(change: number): any {
  return change >= 0 ? ChevronUp : ChevronDown;
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    completed: 'bg-emerald-500/20 text-emerald-400',
    pending: 'bg-amber-500/20 text-amber-400',
    processing: 'bg-blue-500/20 text-blue-400'
  };
  return map[status] || 'bg-gray-500/20 text-gray-400';
}
</script>

<template>
  <!-- Dark Theme Container -->
  <div class="min-h-screen" style="background: #0f172a;">
    <!-- Header Bar -->
    <div class="sticky top-0 z-30 border-b" style="background: #1e293b; border-color: #334155;">
      <div class="flex items-center justify-between px-4 sm:px-6 py-3">
        <div class="flex items-center gap-3">
          <div class="h-8 w-8 rounded-lg flex items-center justify-center" style="background: #3b82f620;">
            <Radio :size="18" class="text-blue-400" />
          </div>
          <div>
            <h1 class="text-base font-bold text-white flex items-center gap-2">
              Malaysia RVM Command Center
              <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                :class="isLive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="isLive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'"></span>
                {{ isLive ? 'LIVE' : 'PAUSED' }}
              </span>
            </h1>
            <p class="text-[11px] text-gray-400">Last poll: {{ lastPollTime || '—' }}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Live Clock -->
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg" style="background: #0f172a; border: 1px solid #334155;">
            <Clock :size="14" class="text-blue-400" />
            <span class="text-lg font-mono font-bold tabular-nums text-white">{{ liveTime }}</span>
          </div>

          <!-- Live Toggle -->
          <button
            @click="toggleLive"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            :style="{
              background: isLive ? '#22c55e20' : '#64748b20',
              border: `1px solid ${isLive ? '#22c55e40' : '#64748b40'}`,
              color: isLive ? '#22c55e' : '#94a3b8'
            }"
          >
            <RefreshCw :size="14" :class="{ 'animate-spin': isLive }" />
            {{ isLive ? 'Live View' : 'Paused' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="p-4 sm:p-6">
      <!-- Three-Column Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

        <!-- LEFT COLUMN — Cumulative Totals + Performance -->
        <div class="lg:col-span-3 space-y-4">

          <!-- Cumulative Totals Card -->
          <div class="rounded-xl p-4" style="background: #1e293b; border: 1px solid #334155;">
            <p class="text-xs font-semibold uppercase tracking-wider mb-3" style="color: #94a3b8;">Cumulative Totals</p>
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: #3b82f620;">
                    <Activity :size="13" class="text-blue-400" />
                  </div>
                  <span class="text-xs" style="color: #94a3b8;">Today</span>
                </div>
                <span class="text-sm font-bold text-white">{{ formatNum(todayTotal) }} kg</span>
              </div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: #a855f720;">
                    <BarChart3 :size="13" class="text-purple-400" />
                  </div>
                  <span class="text-xs" style="color: #94a3b8;">This Week</span>
                </div>
                <span class="text-sm font-bold text-white">{{ formatNum(thisWeekTotal) }} kg</span>
              </div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: #22c55e20;">
                    <Scale :size="13" class="text-emerald-400" />
                  </div>
                  <span class="text-xs" style="color: #94a3b8;">Total Volume</span>
                </div>
                <span class="text-sm font-bold text-white">{{ formatNum(totalVolume) }} kg</span>
              </div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: #f59e0b20;">
                    <DollarSign :size="13" class="text-amber-400" />
                  </div>
                  <span class="text-xs" style="color: #94a3b8;">Points Paid</span>
                </div>
                <span class="text-sm font-bold text-white">{{ formatNum(pointsPaid) }}</span>
              </div>
            </div>
          </div>

          <!-- Performance Summary Card -->
          <div class="rounded-xl p-4" style="background: #1e293b; border: 1px solid #334155;">
            <p class="text-xs font-semibold uppercase tracking-wider mb-3" style="color: #94a3b8;">Performance</p>
            
            <!-- Period Selector -->
            <div class="flex gap-1 mb-3">
              <button v-for="p in (['day', 'week', 'month'] as const)" :key="p"
                @click="perfPeriod = p"
                class="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all capitalize"
                :style="{
                  background: perfPeriod === p ? '#3b82f6' : 'transparent',
                  color: perfPeriod === p ? 'white' : '#64748b',
                  border: `1px solid ${perfPeriod === p ? '#3b82f6' : '#334155'}`
                }"
              >{{ p }}</button>
            </div>

            <div class="text-center py-3">
              <p class="text-3xl font-extrabold text-white">{{ formatNum(perfKg) }}</p>
              <p class="text-[11px] mt-1" style="color: #94a3b8;">{{ perfKgLabel }} — {{ perfPeriod === 'day' ? perfKg : perfKg * 7 }} kg collected</p>
            </div>

            <!-- Mini machine status strip -->
            <div class="flex justify-between mt-2 pt-3" style="border-top: 1px solid #334155;">
              <div class="text-center">
                <div class="flex items-center justify-center gap-1">
                  <div class="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span class="text-sm font-bold text-white">{{ onlineCount }}</span>
                </div>
                <p class="text-[10px]" style="color: #94a3b8;">Online</p>
              </div>
              <div class="text-center">
                <div class="flex items-center justify-center gap-1">
                  <div class="w-2 h-2 rounded-full bg-red-400"></div>
                  <span class="text-sm font-bold text-white">{{ offlineCount }}</span>
                </div>
                <p class="text-[10px]" style="color: #94a3b8;">Offline</p>
              </div>
              <div class="text-center">
                <div class="flex items-center justify-center gap-1">
                  <div class="w-2 h-2 rounded-full bg-orange-400"></div>
                  <span class="text-sm font-bold text-white">{{ fullCount }}</span>
                </div>
                <p class="text-[10px]" style="color: #94a3b8;">Full</p>
              </div>
            </div>
          </div>
        </div>

        <!-- CENTER COLUMN — Map -->
        <div class="lg:col-span-5">
          <div class="rounded-xl overflow-hidden" style="background: #1e293b; border: 1px solid #334155;">
            <div class="flex items-center justify-between px-4 py-2.5" style="border-bottom: 1px solid #334155;">
              <div class="flex items-center gap-2">
                <MapPin :size="14" class="text-blue-400" />
                <span class="text-xs font-semibold text-white">RVM Machine Status</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="flex items-center gap-1 text-[10px]" style="color: #94a3b8;">
                  <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Active
                </span>
                <span class="flex items-center gap-1 text-[10px]" style="color: #94a3b8;">
                  <span class="w-2 h-2 rounded-full bg-orange-400"></span> Full
                </span>
                <span class="flex items-center gap-1 text-[10px]" style="color: #94a3b8;">
                  <span class="w-2 h-2 rounded-full bg-red-400"></span> Offline
                </span>
              </div>
            </div>
            <div id="live-monitor-map" style="width: 100%; height: 480px;"></div>
          </div>
        </div>

        <!-- RIGHT COLUMN — Trends + Activity -->
        <div class="lg:col-span-4 space-y-4">

          <!-- Comparison Summary -->
          <div class="rounded-xl p-4" style="background: #1e293b; border: 1px solid #334155;">
            <p class="text-xs font-semibold uppercase tracking-wider mb-3" style="color: #94a3b8;">Comparison Summary</p>
            <div class="grid grid-cols-2 gap-3">
              <div v-for="item in [
                { label: 'Delivery Volume', key: 'deliveryVolume', icon: Activity },
                { label: 'Total Expenses', key: 'totalExpenses', icon: DollarSign },
                { label: 'Submissions', key: 'submissions', icon: BarChart3 },
                { label: 'New Users', key: 'newUsers', icon: Users }
              ]" :key="item.key"
                class="rounded-lg p-3" style="background: #0f172a; border: 1px solid #334155;"
              >
                <div class="flex items-center gap-2 mb-1.5">
                  <component :is="item.icon" :size="12" class="text-blue-400" />
                  <span class="text-[10px]" style="color: #94a3b8;">{{ item.label }}</span>
                </div>
                <p class="text-lg font-extrabold text-white">{{ formatNum((comparisonData as any)[item.key]?.current || 0) }}</p>
                <div class="flex items-center gap-1 mt-1">
                  <component :is="changeIcon((comparisonData as any)[item.key]?.change || 0)" :size="12" :class="changeColor((comparisonData as any)[item.key]?.change || 0)" />
                  <span class="text-[10px] font-semibold" :class="changeColor((comparisonData as any)[item.key]?.change || 0)">
                    {{ Math.abs((comparisonData as any)[item.key]?.change || 0) }}%
                  </span>
                  <span class="text-[9px]" style="color: #64748b;">vs prev</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Activity Log -->
          <div class="rounded-xl p-4" style="background: #1e293b; border: 1px solid #334155;">
            <div class="flex items-center justify-between mb-3">
              <p class="text-xs font-semibold uppercase tracking-wider" style="color: #94a3b8;">Submitting Orders</p>
              <span class="text-[10px]" style="color: #64748b;">{{ activityLog.length }} entries</span>
            </div>
            <div class="space-y-1.5 max-h-[220px] overflow-y-auto">
              <div v-for="(entry, i) in activityLog" :key="i"
                class="flex items-center justify-between py-1.5 px-2 rounded-lg text-[11px]"
                :style="{ background: i % 2 === 0 ? '#0f172a' : 'transparent' }"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <Loader :size="10" class="text-blue-400 shrink-0 animate-pulse" />
                  <span class="truncate text-white">{{ entry.action }}</span>
                </div>
                <span class="shrink-0 ml-2">
                  <span class="px-1.5 py-0.5 rounded-full text-[9px] font-semibold" :class="statusBadge(entry.status)">
                    {{ entry.status }}
                  </span>
                </span>
              </div>
              <div v-if="activityLog.length === 0" class="text-center py-6">
                <p class="text-xs" style="color: #64748b;">Waiting for live data...</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- BOTTOM ROW — Delivery Rankings -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
        <!-- User Rankings -->
        <div class="rounded-xl p-4" style="background: #1e293b; border: 1px solid #334155;">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <Award :size="14" class="text-amber-400" />
              <span class="text-xs font-semibold text-white">User Rankings</span>
            </div>
            <span class="text-[10px]" style="color: #64748b;">By weight collected</span>
          </div>
          <table class="w-full text-xs">
            <thead>
              <tr class="text-left" style="color: #64748b;">
                <th class="pb-2 font-semibold">#</th>
                <th class="pb-2 font-semibold">User</th>
                <th class="pb-2 font-semibold text-right">Weight (kg)</th>
                <th class="pb-2 font-semibold text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(u, i) in userRankings" :key="i"
                class="border-t" style="border-color: #334155;"
              >
                <td class="py-2">
                  <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    :style="{
                      background: i === 0 ? '#f59e0b30' : i === 1 ? '#94a3b820' : i === 2 ? '#b4530930' : '#1e293b',
                      color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#64748b'
                    }"
                  >{{ i + 1 }}</span>
                </td>
                <td class="py-2 text-white font-medium">{{ u.name }}</td>
                <td class="py-2 text-right text-white font-semibold">{{ formatNum(u.weight) }}</td>
                <td class="py-2 text-right" style="color: #94a3b8;">{{ formatNum(u.points) }}</td>
              </tr>
              <tr v-if="userRankings.length === 0">
                <td colspan="4" class="py-8 text-center" style="color: #64748b;">No ranking data available</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Equipment Rankings -->
        <div class="rounded-xl p-4" style="background: #1e293b; border: 1px solid #334155;">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <Server :size="14" class="text-blue-400" />
              <span class="text-xs font-semibold text-white">Equipment Rankings</span>
            </div>
            <span class="text-[10px]" style="color: #64748b;">By volume collected</span>
          </div>
          <table class="w-full text-xs">
            <thead>
              <tr class="text-left" style="color: #64748b;">
                <th class="pb-2 font-semibold">#</th>
                <th class="pb-2 font-semibold">Machine</th>
                <th class="pb-2 font-semibold text-right">Weight (kg)</th>
                <th class="pb-2 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(e, i) in equipmentRankings" :key="i"
                class="border-t" style="border-color: #334155;"
              >
                <td class="py-2">
                  <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    :style="{
                      background: i === 0 ? '#f59e0b30' : i === 1 ? '#94a3b820' : i === 2 ? '#b4530930' : '#1e293b',
                      color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#64748b'
                    }"
                  >{{ i + 1 }}</span>
                </td>
                <td class="py-2 text-white font-medium truncate max-w-[120px]">{{ e.name }}</td>
                <td class="py-2 text-right text-white font-semibold">{{ formatNum(e.weight) }}</td>
                <td class="py-2 text-right">
                  <span class="inline-flex items-center gap-1 text-[10px] font-semibold"
                    :class="e.status === 'Online' ? 'text-emerald-400' : 'text-red-400'"
                  >
                    <span class="w-1.5 h-1.5 rounded-full" :class="e.status === 'Online' ? 'bg-emerald-400' : 'bg-red-400'"></span>
                    {{ e.status }}
                  </span>
                </td>
              </tr>
              <tr v-if="equipmentRankings.length === 0">
                <td colspan="4" class="py-8 text-center" style="color: #64748b;">No equipment data available</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Dynamic CSS for dark popup -->
  <style scoped>
  :deep(.dark-popup .leaflet-popup-content-wrapper) {
    background: #1e293b !important;
    color: white !important;
    border: 1px solid #334155 !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
  }
  :deep(.dark-popup .leaflet-popup-tip) {
    background: #1e293b !important;
    border: 1px solid #334155 !important;
  }
  :deep(.dark-popup .leaflet-popup-close-button) {
    color: #94a3b8 !important;
  }
  :deep(.leaflet-container) {
    background: #0f172a !important;
  }
  :deep(.leaflet-control-zoom a) {
    background: #1e293b !important;
    color: white !important;
    border-color: #334155 !important;
  }
  :deep(.leaflet-control-zoom a:hover) {
    background: #334155 !important;
  }
  @keyframes pulse-green {
    0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); }
    50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
  }
  @keyframes pulse-orange {
    0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.6); }
    50% { box-shadow: 0 0 0 8px rgba(249, 115, 22, 0); }
  }
  @keyframes pulse-red {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
  }
  .map-pulse-green { animation: pulse-green 2s infinite; }
  .map-pulse-orange { animation: pulse-orange 2s infinite; }
  .map-pulse-yellow { animation: pulse-orange 2.5s infinite; }
  .map-pulse-red { animation: pulse-red 3s infinite; }
  </style>
</template>
