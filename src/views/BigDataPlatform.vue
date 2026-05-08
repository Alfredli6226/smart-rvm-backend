<script setup lang="ts">
import { onMounted, ref, computed, onUnmounted } from 'vue';
import { useBigDataStats } from '../composables/useBigDataStats';
import BigDataMap from '../components/BigDataMap.vue';
import BigDataChart from '../components/BigDataChart.vue';
import { useESGExport } from '../composables/useESGExport';
import SimpleConfirmModal from '../components/SimpleConfirmModal.vue';
import { supabase } from '../services/supabase';
import { 
  Users, Scale, Server, Activity, 
  Truck, Recycle, CheckCircle2, Coins,
  RefreshCw, FileText, MapPin, Bell, X
} from 'lucide-vue-next';

const { 
  loading, statsLoading, 
  fetchInitialData, fetchFilteredStats,
  timeFilter, dateRange, selectedMachineId,
  totalUsers, totalWeight, totalLifetimePoints, totalMachines, summary,
  machineLocations, onlineCount, offlineCount,
  wasteTrends, withdrawalTrends, recentSubmissions, collectionLogs
  
} = useBigDataStats();

const { generateReport } = useESGExport();

// ✅ NEW: State for Modal
const showESGConfirm = ref(false);
const isGeneratingReport = ref(false);

// 1. Triggered by Button Click -> Opens Modal
const promptExportESG = () => {
  showESGConfirm.value = true;
};

// 2. Triggered by Modal Confirm -> Generates Report
const executeESGExport = async () => {
  isGeneratingReport.value = true;

  try {
    const rangeStr = dateRange.value.start 
      ? `${dateRange.value.start} to ${dateRange.value.end || 'Now'}` 
      : 'All Time Records';

    const exportStats = {
      weight: summary.value.deliveryVolume || totalWeight.value,
      users: summary.value.newUsers || totalUsers.value,
      points: summary.value.pointsGiven || totalLifetimePoints.value,
      machines: selectedMachineId.value ? 1 : totalMachines.value,
      collections: collectionLogs.value.length
    };

    const targetName = selectedMachineId.value 
      ? machineLocations.value.find(m => m.device_no === selectedMachineId.value)?.name || selectedMachineId.value
      : "All Digital RVM Network";

    await generateReport(exportStats, rangeStr, targetName);
    
  } catch (e) {
    console.error(e);
  } finally {
    isGeneratingReport.value = false;
    showESGConfirm.value = false;
  }
};

const filteredMapLocations = computed(() => {
  if (selectedMachineId.value) {
    return machineLocations.value.filter(m => m.device_no === selectedMachineId.value);
  }
  return machineLocations.value;
});

// Local state for the refresh button animation
const isRefreshing = ref(false);

// ✅ Manual Refresh Function
const refreshData = async () => {
  if (isRefreshing.value) return; // Prevent double clicks
  
  isRefreshing.value = true;
  // Pass 'true' to prevent the full-page white screen loading
  await fetchInitialData(true); 
  isRefreshing.value = false;
};

onMounted(() => {
  fetchInitialData(); // Initial load (shows full page spinner)
  fetchEfficiencyStats(); // Load efficiency data for map
  
  // ❌ REMOVED: setInterval logic to prevent API blocking
});

const formatNum = (n: number) => {
  return n.toLocaleString(undefined, { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 2 
  });
};

// Efficiency Stats
interface EfficiencyData {
  deviceNo: string;
  name: string;
  lat: number;
  lng: number;
  totalWeight: number;
  totalPoints: number;
  submissionCount: number;
  efficiencyRatio: number;
  performance: 'gold' | 'warning' | 'normal';
}

const efficiencyStats = ref<EfficiencyData[]>([]);
const loadingEfficiency = ref(false);

const fetchEfficiencyStats = async () => {
  loadingEfficiency.value = true;
  try {
    const response = await fetch('/api/machines/efficiency-stats');
    const result = await response.json();
    
    if (result.success && result.machines) {
      efficiencyStats.value = result.machines.map((m: any) => ({
        deviceNo: m.deviceNo,
        name: m.name,
        lat: m.lat,
        lng: m.lng,
        totalWeight: m.totalWeight,
        totalPoints: m.totalPoints,
        submissionCount: m.submissionCount,
        efficiencyRatio: m.efficiencyRatio,
        performance: m.performance
      }));
    }
  } catch (e) {
    console.error('Failed to fetch efficiency stats:', e);
  } finally {
    loadingEfficiency.value = false;
  }
};

// Map control for flyTo
const mapZoom = ref(6);
const mapCenter = ref<[number, number]>([4.2105, 101.9758]);

const handleFlyTo = (lat: number, lng: number) => {
  mapCenter.value = [lat, lng];
  mapZoom.value = 14;
};

// Live notification toast for new submissions
interface SubmissionToast {
  id: string;
  machineName: string;
  weight: number;
  lat: number;
  lng: number;
  timestamp: Date;
}

const submissionToasts = ref<SubmissionToast[]>([]);
let lastSubmissionId = '';

const pollForNewSubmissions = async () => {
  try {
    const { data, error } = await supabase
      .from('submission_reviews')
      .select('id, device_no, api_weight, machines(name, latitude, longitude)')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error || !data?.length) return;
    
    const latest = data[0]!;
    if (latest.id !== lastSubmissionId && lastSubmissionId) {
      // New submission found!
      const machine = latest.machines as any;
      if (machine?.latitude && machine?.longitude) {
        const toast: SubmissionToast = {
          id: latest.id,
          machineName: machine?.name || `RVM-${latest.device_no}`,
          weight: latest.api_weight || 0,
          lat: Number(machine.latitude),
          lng: Number(machine.longitude),
          timestamp: new Date()
        };
        submissionToasts.value.unshift(toast);
        
        // Auto-dismiss after 8 seconds
        setTimeout(() => {
          submissionToasts.value = submissionToasts.value.filter(t => t.id !== toast.id);
        }, 8000);
        
        // Keep max 3 toasts
        if (submissionToasts.value.length > 3) {
          submissionToasts.value.pop();
        }
      }
    }
    lastSubmissionId = latest.id;
  } catch (e) {
    // Silent fail for polling
  }
};

const flyToToast = (toast: SubmissionToast) => {
  handleFlyTo(toast.lat, toast.lng);
  submissionToasts.value = submissionToasts.value.filter(t => t.id !== toast.id);
};

const dismissToast = (id: string) => {
  submissionToasts.value = submissionToasts.value.filter(t => t.id !== id);
};

let pollInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  fetchInitialData(); // Initial load (shows full page spinner)
  
  // Poll for new submissions every 10 seconds
  pollInterval = setInterval(pollForNewSubmissions, 10000);
});

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 overflow-hidden">
    
    <!-- Live Submission Toasts -->
    <div class="fixed top-20 right-4 z-[1000] flex flex-col gap-2">
      <TransitionGroup name="toast">
        <div 
          v-for="toast in submissionToasts" 
          :key="toast.id"
          class="bg-white rounded-lg shadow-xl border border-emerald-200 p-3 min-w-[240px] animate-slide-in"
        >
          <div class="flex items-start gap-2">
            <div class="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
              <Recycle :size="16" class="text-emerald-600" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1">
                <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span class="text-[10px] text-emerald-600 font-bold uppercase">New Submission</span>
              </div>
              <div class="text-sm font-bold text-slate-800 truncate">{{ toast.machineName }}</div>
              <div class="text-xs text-slate-500">{{ toast.weight }}kg received</div>
            </div>
            <button @click="dismissToast(toast.id)" class="text-slate-400 hover:text-slate-600">
              <X :size="14" />
            </button>
          </div>
          <button 
            @click="flyToToast(toast)"
            class="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 rounded transition-colors flex items-center justify-center gap-1"
          >
            <MapPin :size="12" />
            View on Map
          </button>
        </div>
      </TransitionGroup>
    </div>
    
    <header class="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shadow-sm z-20 h-16 shrink-0">
      <div class="flex items-center gap-3">
        <div class="bg-blue-900 text-white p-2 rounded-lg"><Activity :size="20" /></div>
        <div>
          <h1 class="text-lg font-black tracking-tight text-slate-900 leading-tight">RVM INTELLIGENCE</h1>
          <p class="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Big Data Platform</p>
        </div>
      </div>
      
      <div class="flex items-center gap-4">
          <button 
            @click="promptExportESG"
            class="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 border border-emerald-700 text-white rounded-lg hover:bg-emerald-700 shadow-sm transition-all text-xs font-bold uppercase"
            title="Download ESG Sustainability Report"
          >
            <FileText :size="14" />
            ESG Report
          </button>

          <button 
            @click="refreshData"
            :disabled="isRefreshing"
            class="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-all text-xs font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh Data"
          >
            <RefreshCw :size="14" :class="{ 'animate-spin': isRefreshing }" />
            {{ isRefreshing ? 'Updating...' : 'Refresh' }}
          </button>

          <div class="h-6 w-px bg-slate-200 mx-1"></div>

          <div class="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
            <span class="text-xs font-bold text-slate-500 px-2 uppercase flex items-center gap-1">
            <Server :size="12" /> Machine:
            </span>
            <select 
            v-model="selectedMachineId" 
            @change="fetchFilteredStats" 
            class="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 py-0 pr-8 cursor-pointer"
            >
            <option value="">ALL MACHINES</option>
            <option v-for="m in machineLocations" :key="m.device_no" :value="m.device_no">
               {{ m.name || m.device_no }} ({{ m.isOnline ? 'Online' : 'Offline' }})
            </option>
            </select>
         </div>

         <div class="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
            <span class="text-xs font-bold text-slate-500 px-2 uppercase">Period:</span>
            <input type="date" v-model="dateRange.start" @change="fetchFilteredStats" class="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0" />
            <span class="text-slate-400 text-xs">-</span>
            <input type="date" v-model="dateRange.end" @change="fetchFilteredStats" class="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0" />
         </div>
      </div>
    </header>

    <main v-if="loading" class="flex-1 flex items-center justify-center">
       <div class="flex flex-col items-center gap-2">
         <div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
         <span class="text-xs font-bold text-slate-400">INITIALIZING DATA STREAM...</span>
       </div>
    </main>

    <main v-else class="flex-1 overflow-y-auto p-4 custom-scrollbar">
      <div class="grid grid-cols-12 gap-4 pb-4">
        
        <div class="col-span-12 lg:col-span-3 flex flex-col gap-4">
           <div class="grid grid-cols-2 gap-3">
              <div class="bg-blue-600 text-white p-4 rounded-xl shadow-md col-span-2 relative overflow-hidden">
                 <div class="absolute right-0 top-0 p-4 opacity-10"><Scale :size="64"/></div>
                 <div class="flex items-center gap-2 mb-1 opacity-80 text-xs font-bold uppercase">Delivery Volume (All Time)</div>
                 <div class="text-3xl font-black relative z-10">{{ formatNum(totalWeight) }} <span class="text-base font-medium opacity-70">kg</span></div>
              </div>
              <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                 <div class="flex items-center gap-2 mb-1 text-slate-400 text-[10px] font-bold uppercase"><Users :size="14"/> Users</div>
                 <div class="text-xl font-black text-slate-800">{{ formatNum(totalUsers) }}</div>
              </div>
              <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                 <div class="flex items-center gap-2 mb-1 text-slate-400 text-[10px] font-bold uppercase"><Server :size="14"/> Devices</div>
                 <div class="text-xl font-black text-slate-800">{{ formatNum(totalMachines) }}</div>
              </div>
           </div>

           <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col">
              
              <div class="bg-amber-500 text-white p-4 rounded-xl shadow-sm relative overflow-hidden mb-6 shrink-0">
                 <div class="absolute right-0 top-0 p-3 opacity-15"><Coins :size="56"/></div>
                 <div class="flex items-center gap-2 mb-1 opacity-90 text-xs font-bold uppercase">Lifetime Value (All Time)</div>
                 <div class="text-3xl font-black relative z-10">
                    {{ formatNum(totalLifetimePoints) }} 
                    <span class="text-base font-medium opacity-80">pts</span>
                 </div>
              </div>

              <div class="flex justify-between items-center mb-4 shrink-0">
               <h3 class="text-sm font-bold text-slate-800">Performance Summary</h3>
               <div class="flex bg-slate-100 rounded-lg p-0.5">
                  <button 
                      @click="timeFilter = 'all'; fetchFilteredStats()"
                      class="px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all"
                      :class="timeFilter === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'">
                      All
                  </button>
                  
                  <button v-for="t in ['day','week','month']" :key="t" 
                      @click="timeFilter = t; fetchFilteredStats()"
                      class="px-2 py-1 text-[10px] font-bold uppercase rounded-md transition-all"
                      :class="timeFilter === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'"
                  >{{ t }}</button>
               </div>
              </div>
                            
              <div v-if="statsLoading" class="flex-1 flex items-center justify-center min-h-[160px]">
                 <div class="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>

              <div v-else class="grid grid-cols-2 gap-4">
                 <div class="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div class="text-xs text-slate-400">Filtered Vol</div>
                    <div class="text-lg font-black text-slate-700">{{ formatNum(summary.deliveryVolume) }} <span class="text-[10px]">kg</span></div>
                 </div>
                 <div class="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div class="text-xs text-slate-400">Submissions</div>
                    <div class="text-lg font-black text-slate-700">{{ formatNum(summary.submissions) }}</div>
                 </div>
                 <div class="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div class="text-xs text-slate-400">New Users</div>
                    <div class="text-lg font-black text-green-600">+{{ formatNum(summary.newUsers) }}</div>
                 </div>
                 <div class="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div class="text-xs text-slate-400">Pts Issued</div>
                    <div class="text-lg font-black text-amber-600">{{ formatNum(summary.pointsGiven) }}</div>
                 </div>
              </div>
           </div>
        </div>

        <div class="col-span-12 lg:col-span-6 flex flex-col">
           <div class="bg-white rounded-3xl border border-slate-200 shadow-lg h-[500px] lg:h-full relative overflow-hidden">
              <div class="absolute top-4 right-4 z-[400] bg-white/90 backdrop-blur px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                 <div class="text-xs font-bold text-slate-400 uppercase">Live Network</div>
                 <div class="flex items-center gap-3 mt-1">
                    <div class="flex items-center gap-1 text-green-600 font-bold text-sm"><span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> {{ onlineCount }} Online</div>
                    <div class="h-3 w-px bg-slate-300"></div>
                    <div class="flex items-center gap-1 text-slate-400 font-bold text-sm"><span class="w-2 h-2 rounded-full bg-slate-300"></span> {{ offlineCount }} Offline</div>
                 </div>
              </div>
              <BigDataMap 
                :machines="filteredMapLocations" 
                :efficiencyStats="efficiencyStats"
                @flyTo="handleFlyTo"
              />
           </div>
        </div>

        <div class="col-span-12 lg:col-span-3 flex flex-col gap-4">
          <div class="bg-slate-900 text-white p-4 rounded-2xl shadow-lg h-[280px] flex flex-col relative overflow-hidden">
            <div class="flex justify-between items-center mb-3 z-10 bg-slate-900 shrink-0">
               <h3 class="text-sm font-bold flex items-center gap-2"><Recycle :size="14" class="text-green-400"/> Live Recycling</h3>
               <span class="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400">Real-time</span>
            </div>
            
            <div class="flex-1 overflow-y-auto custom-scrollbar relative">
               <div class="space-y-3 w-full pb-2">
                  <div v-for="s in recentSubmissions" :key="s.id" class="flex justify-between items-center text-xs p-2 rounded bg-slate-800/50 border border-slate-700/50">
                  <div class="flex items-center gap-2">
                     <div class="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">👤</div>
                     <div>
                        <div class="font-bold text-slate-200">{{ s.users?.nickname || 'Guest' }}</div>
                        
                        <div class="text-[10px] font-bold text-cyan-400 uppercase tracking-wide">
                           {{ s.waste_type || 'General' }}
                        </div>

                        <div class="text-[10px] text-slate-500">{{ new Date(s.submitted_at || s.created_at).toLocaleTimeString() }}</div>
                     </div>
                  </div>
                  <div class="text-right">
                     <div class="font-bold text-green-400">+{{ s.api_weight }}kg</div>
                     <div class="text-[10px] text-amber-500">{{ s.calculated_value }} pts</div>
                  </div>
                  </div>
                  <div v-if="recentSubmissions.length === 0" class="text-center text-slate-500 py-10 text-xs">No Recent Data</div>
               </div>
            </div>
            </div>

            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm h-[280px] flex flex-col overflow-hidden">
              <div class="flex justify-between items-center mb-3">
                 <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2"><Truck :size="14" class="text-blue-500"/> Collection Logs</h3>
              </div>
              <div class="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                  <div v-for="c in collectionLogs" :key="c.id" class="flex items-start gap-3 text-xs p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                     <div class="mt-0.5"><CheckCircle2 :size="14" class="text-green-500"/></div>
                     <div>
                        <div class="font-bold text-slate-700">{{ c.device_no }}</div>
                        <div class="text-slate-500">Cleared by {{ c.cleaner_name || 'Staff' }}</div>
                     </div>
                     <div class="ml-auto text-right">
                        <div class="text-[10px] font-mono text-slate-400">{{ new Date(c.created_at).toLocaleDateString() }}</div>
                     </div>
                  </div>
                  <div v-if="collectionLogs.length === 0" class="text-center text-slate-400 py-10 text-xs">No collections in this period</div>
              </div>
           </div>
        </div>

        <div class="col-span-12 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm h-[450px] flex flex-col">
           <h3 class="text-sm font-bold text-slate-800 mb-4">Waste & Collection Trends</h3>
           <div class="flex-1 w-full min-h-0 relative">
             <BigDataChart 
               v-if="!statsLoading && wasteTrends.length > 0"
               :data="wasteTrends" 
               xKey="date" 
               :series="[
                 { key: 'delivery_weight', color: '#2563eb', label: 'Delivery (kg)' },
                 { key: 'collection_weight', color: '#10b981', label: 'Removed (kg)' }
               ]"
             >
               <template #tooltip="{ item }">
               <div class="grid grid-cols-2 gap-x-4 gap-y-2 min-w-[140px]">
                     <div>
                     <div class="text-[10px] text-slate-400 uppercase">Delivery Wgt</div>
                     <div class="font-bold text-blue-600">{{ formatNum(item.delivery_weight) }}kg</div>
                     </div>
                     <div>
                     <div class="text-[10px] text-slate-400 uppercase">Removed Wgt</div>
                     <div class="font-bold text-emerald-600">{{ formatNum(item.collection_weight) }}kg</div>
                     </div>
                     <div>
                     <div class="text-[10px] text-slate-400 uppercase">Deliveries</div>
                     <div class="font-bold text-slate-700">{{ item.delivery_count }}</div>
                     </div>
                     <div>
                     <div class="text-[10px] text-slate-400 uppercase">Collections</div>
                     <div class="font-bold text-slate-700">{{ item.collection_count }}</div>
                     </div>
               </div>
               </template>
             </BigDataChart>
             <div v-else class="absolute inset-0 flex items-center justify-center text-slate-300 text-xs uppercase font-bold">
                {{ selectedMachineId ? 'Withdrawal data is not machine-specific' : 'No Data for this period' }}
                </div>
           </div>
        </div>

        <div class="col-span-12 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm h-[450px] flex flex-col">
           <h3 class="text-sm font-bold text-slate-800 mb-4">Withdrawal Analytics</h3>
           <div class="flex-1 w-full min-h-0 relative">
             <BigDataChart 
               v-if="!statsLoading && withdrawalTrends.length > 0"
               :data="withdrawalTrends" 
               xKey="date" 
               :series="[
                 { key: 'request_amount', color: '#f59e0b', label: 'Requested' },
                 { key: 'approved_amount', color: '#6366f1', label: 'Approved' }
               ]"
             >
               <template #tooltip="{ item }">
               <div class="space-y-2 min-w-[150px]">
                     <div class="flex justify-between items-center">
                     <span class="text-slate-400 uppercase text-[10px]">Requested</span>
                     <span class="font-bold text-amber-500">{{ formatNum(item.request_amount) }} pts</span>
                     </div>
                     <div class="flex justify-between items-center">
                     <span class="text-slate-400 uppercase text-[10px]">Approved</span>
                     <span class="font-bold text-indigo-500">{{ formatNum(item.approved_amount) }} pts</span>
                     </div>
                     <div class="flex justify-between items-center border-t border-slate-100 pt-1">
                     <span class="text-slate-400 uppercase text-[10px]">Applicants</span>
                     <span class="font-bold text-slate-700">{{ item.applicants }}</span>
                     </div>
               </div>
               </template>
             </BigDataChart>
             <div v-else class="absolute inset-0 flex items-center justify-center text-slate-300 text-xs uppercase font-bold">No Data for this period</div>
           </div>
        </div>

      </div>
    </main>
    <SimpleConfirmModal
      :isOpen="showESGConfirm"
      title="Generate ESG Report"
      message="This will generate a formal Sustainability Report (Word Document) based on the currently filtered data. The report includes Environmental Impact, Material Breakdown, and Social Governance metrics."
      :isProcessing="isGeneratingReport"
      @close="showESGConfirm = false"
      @confirm="executeESGExport"
    />
  </div>
</template>

<style scoped>
.mask-gradient {
  mask-image: linear-gradient(to bottom, transparent, black 5%, black 95%, transparent);
}

@keyframes scroll-vertical {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); } 
}

.animate-scroll-vertical {
  /* animation: scroll-vertical 20s linear infinite; */
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* Toast Animations */
@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out forwards;
}

.toast-enter-active {
  animation: slide-in 0.3s ease-out;
}

.toast-leave-active {
  animation: slide-in 0.3s ease-out reverse;
}
</style>