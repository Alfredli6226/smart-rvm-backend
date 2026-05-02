<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useMachineStore } from '../stores/machines';
import { useDashboardStats } from '../composables/useDashboardStats';
import {
  Users, Search, Download, Send, ChevronRight,
  Activity, Clock, MapPin, Phone, Mail,
  Scale, Leaf, Target, ChevronLeft,
  RefreshCw, AlertCircle, X, Filter, Loader,
  Wifi, WifiOff, Eye, ChevronDown, FileSpreadsheet
} from 'lucide-vue-next';
import { useESGExport } from '../composables/useESGExport';

const machineStore = useMachineStore();
const { machines } = storeToRefs(machineStore);
const { totalWeight, totalPoints, fetchStats } = useDashboardStats();

const machineOptions = computed(() => {
  const opts = [{ value: 'all', label: 'All Machines' }];
  for (const m of machines.value) {
    opts.push({ value: m.deviceNo || String(m.id), label: m.name || m.deviceNo || ('Machine ' + m.id) });
  }
  return opts;
});

// ==========================================
// STATE
// ==========================================
const recyclers = ref<any[]>([]);
const loading = ref(true);
const error = ref('');
const search = ref('');
const machineFilter = ref('all');
const page = ref(1);
const limit = 20;
const totalItems = ref(0);
const totalPages = ref(1);
const summaryData = ref({ totalRecycled: 0, activeCount: 0, recentlyActive: 0, totalCarbon: 0 });

// Encouragement modal
const showEncourageModal = ref(false);
const selectedUser = ref<any>(null);
const encourageMessage = ref('Great work! Keep recycling to earn more points and help the environment! 🌍');
const sendingEncourage = ref(false);
const encourageSent = ref(false);

// Polling for live updates
let pollInterval: ReturnType<typeof setInterval> | null = null;
const isLive = ref(true);

// ==========================================
// COMPUTED
// ==========================================
const filteredRecyclers = computed(() => {
  let result = recyclers.value;
  if (machineFilter.value !== 'all') {
    result = result.filter(r => r.deviceNo === machineFilter.value || (r.machineLocation && r.machineLocation.includes(machineFilter.value)));
  }
  if (search.value) {
    const q = search.value.toLowerCase();
    result = result.filter(r =>
      r.userName.toLowerCase().includes(q) ||
      r.phone.includes(q) ||
      (r.machineLocation && r.machineLocation.toLowerCase().includes(q))
    );
  }
  return result;
});

const showingText = computed(() => {
  const total = Math.max(totalItems.value, recyclers.value.length);
  const from = (page.value - 1) * limit + 1;
  const to = Math.min(from + recyclers.value.length - 1, total);
  return `Showing ${from} to ${to} of ${total} active recyclers`;
});

// ==========================================
// FETCH DATA
// ==========================================
async function fetchActiveRecyclers() {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: String(limit),
      search: search.value
    });
    const resp = await fetch(`/api/user-analytics?endpoint=active-recyclers&${params}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (!json.success) throw new Error(json.error || 'API error');

    recyclers.value = json.data || [];
    totalItems.value = json.pagination?.total || json.data?.length || 0;
    totalPages.value = json.pagination?.totalPages || 1;
    summaryData.value = json.summary || { totalRecycled: 0, activeCount: 0, recentlyActive: 0, totalCarbon: 0 };
  } catch (err: any) {
    error.value = 'Failed to load active recyclers data: ' + err.message;
    console.error('Active Recyclers fetch error:', err);
    // No data available
    recyclers.value = [];
    totalItems.value = recyclers.value.length;
    totalPages.value = 0;
  } finally {
    loading.value = false;
  }
}



// ==========================================
// TIME HELPER
// ==========================================
function timeAgo(isoStr: string): string {
  if (!isoStr) return '—';
  const diff = Date.now() - new Date(isoStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} mins ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hours ago`;
  return new Date(isoStr).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ==========================================
// ENCOURAGEMENT MODAL
// ==========================================
function openEncourage(user: any) {
  selectedUser.value = user;
  encourageMessage.value = `Great work ${user.userName}! Keep recycling to earn more points and help the environment! 🌍`;
  encourageSent.value = false;
  showEncourageModal.value = true;
}

async function sendEncouragement() {
  sendingEncourage.value = true;
  try {
    // Simulate sending — in production, this would hit a push notification API
    await new Promise(resolve => setTimeout(resolve, 1000));
    encourageSent.value = true;
  } catch (err) {
    console.error('Failed to send encouragement:', err);
  } finally {
    sendingEncourage.value = false;
  }
}

function closeEncourage() {
  showEncourageModal.value = false;
  selectedUser.value = null;
}

// ==========================================
// EXPORT
// ==========================================
function exportActiveUsers() {
  const data = filteredRecyclers.value;
  if (data.length === 0) { alert('No data to export.'); return; }
  let csv = 'User,Phone,Email,Machine,Recycled(kg),Carbon(kg),Status\n';
  for (const r of data) {
    csv += '"' + r.userName + '","' + r.phone + '","' + r.email + '","' + r.machineLocation + '",' + r.totalRecycled + ',' + (r.carbonSaved || 0) + ',"' + r.status + '"\n';
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'recyclers_report_' + new Date().toISOString().slice(0,10) + '.csv'; a.click();
  URL.revokeObjectURL(url);
}

const { generateReport } = useESGExport();

async function exportESGReport() {
  try {
    const resp = await fetch('/api/user-analytics?endpoint=cert-overview');
    const json = await resp.json();
    if (json.success && json.data) {
      const d = json.data;
      await generateReport({
        weight: d.totalWeight || 0,
        users: d.totalUsers || 0,
        points: d.totalPoints || 0,
        machines: d.machineCount || 0,
        collections: d.totalSubmissions || 0
      }, 'All Time', 'MyGreenPlus');
    } else {
      alert('Could not fetch live data for ESG report. Try again later.');
    }
  } catch(e) {
    console.warn('ESG export failed:', e);
    alert('ESG report generation failed. Please try again.');
  }
}

function generateMachineReport() {
  const selected = machineFilter.value;
  if (selected === 'all') { alert('Select a specific machine first.'); return; }
  const machine = machineOptions.value.find(m => m.value === selected);
  const data = recyclers.value.filter(r => r.deviceNo === selected || (r.machineLocation && r.machineLocation.includes(selected)));
  const totalWt = data.reduce((s, r) => s + r.totalRecycled, 0);
  const totalCO2 = data.reduce((s, r) => s + (r.carbonSaved || 0), 0);
  const now = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let report = '=== RECYCLING REPORT ===\n';
  report += 'Machine: ' + (machine?.label || selected) + '\n';
  report += 'Date: ' + now + '\n';
  report += 'Total Recyclers: ' + data.length + '\n';
  report += 'Total Weight: ' + totalWt.toFixed(1) + ' kg\n';
  report += 'Total CO2 Saved: ' + totalCO2.toFixed(1) + ' kg\n';
  report += 'Trees Equivalent: ' + Math.round(totalCO2 / 20) + '\n';
  report += '\n--- Recyclers ---\n';
  for (const r of data) {
    report += r.userName + ' | ' + r.phone + ' | ' + r.totalRecycled + 'kg | ' + (r.carbonSaved || 0) + 'kg CO2\n';
  }
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'machine_report_' + selected + '_' + now + '.txt'; a.click();
  URL.revokeObjectURL(url);
}

// ==========================================
// PAGINATION
// ==========================================
function prevPage() {
  if (page.value > 1) { page.value--; fetchActiveRecyclers(); }
}
function nextPage() {
  if (page.value < totalPages.value) { page.value++; fetchActiveRecyclers(); }
}

// ==========================================
// LIVE POLLING
// ==========================================
function toggleLive() {
  isLive.value = !isLive.value;
  if (isLive.value) {
    fetchActiveRecyclers();
    pollInterval = setInterval(fetchActiveRecyclers, 30000);
  } else if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// ==========================================
// WATCH SEARCH
// ==========================================
watch(search, () => {
  page.value = 1;
  fetchActiveRecyclers();
});

// ==========================================
// LIFECYCLE
// ==========================================
onMounted(async () => {
  await machineStore.fetchMachines();
  await fetchStats();
  await fetchActiveRecyclers();

  if (isLive.value) {
    pollInterval = setInterval(fetchActiveRecyclers, 30000);
  }
});

onUnmounted(() => {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
});

function progressColor(pct: number): string {
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 75) return 'bg-blue-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-gray-300';
}
</script>

<template>
  <div class="space-y-6 p-3 sm:p-6 bg-gray-50 min-h-screen">
    <!-- Breadcrumb & Title -->
    <div class="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav class="flex items-center gap-1.5 text-xs sm:text-sm text-gray-400 mb-2">
            <a href="/" class="hover:text-blue-600 transition">Dashboard</a>
            <ChevronRight :size="12" class="text-gray-300" />
            <span class="text-gray-600 font-medium">Active Recyclers</span>
          </nav>
          <h1 class="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity :size="22" class="text-emerald-500" />
            Live Recycler Monitor
          </h1>
          <p class="text-xs sm:text-sm text-gray-500 mt-1">Users with verified submissions this month</p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- Live indicator -->
          <button
            @click="toggleLive"
            class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            :style="{
              background: isLive ? '#22c55e20' : '#64748b20',
              border: `1px solid ${isLive ? '#22c55e40' : '#64748b40'}`,
              color: isLive ? '#16a34a' : '#64748b'
            }"
          >
            <span class="relative flex h-2 w-2">
              <span v-if="isLive" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2" :class="isLive ? 'bg-emerald-500' : 'bg-gray-400'"></span>
            </span>
            {{ isLive ? 'LIVE' : 'Paused' }}
          </button>

          <!-- Export -->
          <button
            @click="exportActiveUsers"
            class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all"
            style="border-color: #22c55e; color: #16a34a;"
          >
            <Download :size="14" />
            Export
          </button>
          <button
            @click="exportESGReport"
            class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all"
            style="border-color: #3b82f6; color: #2563eb;"
          >
            <FileSpreadsheet :size="14" />
            ESG Report
          </button>
        </div>
      </div>
    </div>

    <!-- Summary stat strips -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Now</p>
        <p class="text-xl sm:text-2xl font-extrabold text-emerald-600 mt-1">{{ summaryData.activeCount }}</p>
      </div>
      <div class="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recently Active</p>
        <p class="text-xl sm:text-2xl font-extrabold text-blue-600 mt-1">{{ summaryData.recentlyActive }}</p>
      </div>
      <div class="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Month Total</p>
        <p class="text-xl sm:text-2xl font-extrabold text-gray-900 mt-1">{{ summaryData.totalRecycled.toFixed(1) }} <span class="text-sm font-normal text-gray-400">kg</span></p>
      </div>
      <div class="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Carbon Saved</p>
        <p class="text-xl sm:text-2xl font-extrabold mt-1" style="color: #059669;">{{ summaryData.totalCarbon.toFixed(1) }} <span class="text-sm font-normal text-gray-400">kg</span></p>
      </div>
    </div>

    <!-- Search & Filter Bar -->
    <div class="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div class="relative flex-1 w-full">
          <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            v-model="search"
            type="text"
            placeholder="Search by name, phone, or machine location..."
            class="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
          />
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <select v-model="machineFilter" class="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option v-for="opt in machineOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <button @click="generateMachineReport" class="px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition">
            📋 Report
          </button>
          <RefreshCw
            :size="16"
            class="text-gray-400 cursor-pointer hover:text-blue-600 transition"
            :class="{ 'animate-spin': loading }"
            @click="fetchActiveRecyclers"
          />
          <span class="text-xs font-medium text-gray-500">{{ showingText }}</span>
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="error && recyclers.length === 0" class="bg-red-50 rounded-xl p-4 border border-red-200">
      <div class="flex items-center gap-2 text-red-700">
        <AlertCircle :size="18" />
        <span class="text-sm font-semibold">{{ error }}</span>
      </div>
    </div>

    <!-- Table Card -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <!-- Loading -->
      <div v-if="loading && recyclers.length === 0" class="flex items-center justify-center py-20">
        <div class="flex items-center gap-3 text-gray-400">
          <Loader :size="20" class="animate-spin" />
          <span class="font-medium">Loading recyclers...</span>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="recyclers.length === 0" class="py-20 text-center">
        <Users :size="48" class="mx-auto text-gray-300 mb-3" />
        <p class="text-gray-400 font-medium text-lg">No results found</p>
        <p class="text-xs text-gray-300 mt-1">Try adjusting your search or filters</p>
        <button @click="search = ''" class="mt-3 text-sm text-blue-600 font-semibold hover:underline">Clear search</button>
      </div>

      <!-- Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left border-b bg-gray-50" style="border-color: #e5e7eb;">
              <th class="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider w-20">Status</th>
              <th class="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">User</th>
              <th class="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Phone</th>
              <th class="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Machine Location</th>
              <th class="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider text-right">Recycled</th>
              <th class="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider text-right">Goal</th>
              <th class="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider min-w-[120px]">Progress</th>
              <th class="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Last Submission</th>
              <th class="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in recyclers" :key="r.userId"
              class="border-b hover:bg-gray-50 transition"
              :style="{ borderColor: '#f3f4f6' }"
            >
              <!-- Status -->
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <span class="relative flex h-2.5 w-2.5">
                    <span v-if="r.status === 'active_now'" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2.5 w-2.5"
                      :class="r.status === 'active_now' ? 'bg-emerald-500' : r.status === 'recently_active' ? 'bg-gray-400' : 'bg-gray-300'"
                    ></span>
                  </span>
                  <span class="text-xs font-medium whitespace-nowrap"
                    :class="r.status === 'active_now' ? 'text-emerald-600' : 'text-gray-400'"
                  >{{ r.status === 'active_now' ? 'Active Now' : 'Recently Active' }}</span>
                </div>
              </td>

              <!-- User -->
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    :class="[
                      'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500',
                      'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'
                    ][i % 8]"
                  >
                    {{ r.userName ? r.userName.charAt(0).toUpperCase() : '?' }}
                  </div>
                  <div class="min-w-0">
                    <p class="font-semibold text-gray-900 truncate text-sm">{{ r.userName }}</p>
                    <p v-if="r.email" class="text-xs text-gray-400 truncate">{{ r.email }}</p>
                  </div>
                </div>
              </td>

              <!-- Phone -->
              <td class="px-4 py-3">
                <span class="text-xs font-mono text-gray-600">{{ r.phone || '—' }}</span>
              </td>

              <!-- Machine Location -->
              <td class="px-4 py-3">
                <div class="flex items-center gap-1.5 min-w-0">
                  <MapPin :size="12" class="text-gray-400 shrink-0" />
                  <span class="text-xs text-gray-600 truncate max-w-[140px] sm:max-w-[200px]">{{ r.machineLocation }}</span>
                </div>
              </td>

              <!-- Recycled -->
              <td class="px-4 py-3 text-right">
                <span class="font-semibold text-gray-900">{{ r.totalRecycled.toFixed(1) }}</span>
              </td>

              <!-- Goal -->
              <td class="px-4 py-3 text-right">
                <span class="text-xs text-gray-500">{{ r.monthlyGoal }} kg</span>
              </td>

              <!-- Progress -->
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :class="progressColor(r.progress)"
                      :style="{ width: r.progress + '%' }"
                    ></div>
                  </div>
                  <span class="text-xs font-semibold text-gray-600 w-8 text-right">{{ r.progress }}%</span>
                </div>
              </td>

              <!-- Last Submission -->
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center gap-1.5">
                  <Clock :size="12" class="text-gray-400" />
                  <span class="text-xs text-gray-600">{{ timeAgo(r.lastSubmission) }}</span>
                </div>
              </td>

              <!-- Action -->
              <td class="px-4 py-3 text-center">
                <button
                  @click="openEncourage(r)"
                  class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:shadow-sm"
                  style="border-color: #f97316; color: #ea580c;"
                >
                  <Send :size="11" />
                  Encourage
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="recyclers.length > 0" class="flex items-center justify-between px-4 py-3 border-t bg-gray-50"
        style="border-color: #e5e7eb;"
      >
        <span class="text-xs text-gray-500">{{ showingText }}</span>
        <div class="flex items-center gap-2">
          <button
            @click="prevPage"
            :disabled="page <= 1"
            class="p-1.5 rounded-lg transition text-xs"
            :class="page <= 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200'"
          >
            <ChevronLeft :size="16" />
          </button>
          <span class="text-xs font-semibold text-gray-700 px-2">{{ page }} / {{ totalPages }}</span>
          <button
            @click="nextPage"
            :disabled="page >= totalPages"
            class="p-1.5 rounded-lg transition text-xs"
            :class="page >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-200'"
          >
            <ChevronRight :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- 📨 Encouragement Modal -->
    <div v-if="showEncourageModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      @click.self="closeEncourage"
    >
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <!-- Modal Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <Send :size="18" class="text-orange-500" />
            <h3 class="text-base font-bold text-gray-900">Send Encouragement</h3>
          </div>
          <button @click="closeEncourage" class="p-1 rounded-lg hover:bg-gray-100 transition">
            <X :size="18" class="text-gray-400" />
          </button>
        </div>

        <!-- Modal Body -->
        <div v-if="!encourageSent" class="px-6 py-4">
          <div class="flex items-center gap-3 mb-4 p-3 bg-orange-50 rounded-xl border border-orange-100">
            <div class="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold text-sm">
              {{ selectedUser?.userName?.charAt(0) || '?' }}
            </div>
            <div>
              <p class="font-semibold text-gray-900 text-sm">{{ selectedUser?.userName }}</p>
              <p class="text-xs text-gray-500">{{ selectedUser?.phone }}</p>
            </div>
          </div>

          <label class="block text-xs font-semibold text-gray-600 mb-2">Message</label>
          <textarea
            v-model="encourageMessage"
            rows="4"
            class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            placeholder="Write an encouraging message..."
          ></textarea>

          <p class="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <Send :size="12" />
            Will be sent as a push notification
          </p>
        </div>

        <div v-else class="px-6 py-8 text-center">
          <div class="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <Send :size="24" class="text-emerald-600" />
          </div>
          <p class="text-lg font-bold text-gray-900">Encouragement Sent! 🎉</p>
          <p class="text-sm text-gray-500 mt-1">Message delivered to {{ selectedUser?.userName }}</p>
        </div>

        <!-- Modal Footer -->
        <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            v-if="!encourageSent"
            @click="closeEncourage"
            class="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
          >Cancel</button>
          <button
            v-if="!encourageSent"
            @click="sendEncouragement"
            :disabled="sendingEncourage"
            class="px-4 py-2 rounded-xl text-sm font-semibold text-white transition flex items-center gap-2"
            style="background: linear-gradient(135deg, #f97316, #ea580c);"
          >
            <Send :size="14" :class="{ 'animate-pulse': sendingEncourage }" />
            {{ sendingEncourage ? 'Sending...' : 'Send Encouragement' }}
          </button>
          <button
            v-else
            @click="closeEncourage"
            class="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition"
          >Done</button>
        </div>
      </div>
    </div>
  </div>
</template>
