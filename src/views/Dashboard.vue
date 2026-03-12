<script setup lang="ts">
import { onMounted, computed, watch, ref } from 'vue';
import { useMachineStore } from '../stores/machines';
import { useDashboardStats } from '../composables/useDashboardStats';
import { storeToRefs } from 'pinia';
import { 
  AlertCircle, Server, Coins, Scale, Activity, 
  Recycle, Brush, CheckCircle2, BarChart3, AlertTriangle,
  WifiOff, Printer, Package, Clock, CheckCircle,
  QrCode, Wrench, ChevronRight, X, Eye, EyeOff,
  ClipboardList, Bell, Trash2, Wifi, Zap, Gauge,
  Target, TrendingUp, Clock3, Calendar, Truck, RefreshCw
} from 'lucide-vue-next';
import StatsCard from '../components/StatsCard.vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { supabase } from '../services/supabase';

// Init
const router = useRouter();
const machineStore = useMachineStore();
const auth = useAuthStore();
const { machines, loading: machineLoading, viewerHasAssignments } = storeToRefs(machineStore);

const { 
  loading: statsLoading, 
  pendingCount, 
  totalPoints, 
  totalWeight, 
  recentWithdrawals,
  recentSubmissions, 
  recentCleaning,   
  fetchStats 
} = useDashboardStats();

// Agent-specific state
const isAgent = computed(() => {
  // Check if route has forceAgentView meta flag
  const route = window.location.pathname;
  if (route.includes('agent-dashboard')) return true;
  // Check for AGENT role (case-insensitive)
  return auth.role?.toUpperCase() === 'AGENT';
});

// VIEWER-specific state (separate from AGENT)
const isViewer = computed(() => {
  return auth.role?.toUpperCase() === 'VIEWER';
});

// Collector-specific state
const isCollector = computed(() => {
  // Check if route has forceCollectorView meta flag
  const route = window.location.pathname;
  if (route.includes('collector-dashboard')) return true;
  // Check for COLLECTOR role (case-insensitive)
  return auth.role?.toUpperCase() === 'COLLECTOR';
});

// Collector-specific data
const collectorTasks = ref<any[]>([]);
const pendingVerifications = ref<any[]>([]);
const collectionStats = ref({ todayWeight: 0, rejectedCount: 0, collectedCount: 0 });
const showQuickActions = ref(false);
const showReportIssueModal = ref(false);
const issueDescription = ref('');
const issueMachineId = ref<number | null>(null);
const submittingIssue = ref(false);

// Issue Report Fields
const issueCategory = ref<string>('');
const issueUrgency = ref<string>('Medium');

// Open issue modal with pre-selected machine
const openIssueModal = (machineId?: number) => {
  issueMachineId.value = machineId || null;
  issueCategory.value = '';
  issueUrgency.value = 'Medium';
  issueDescription.value = '';
  showReportIssueModal.value = true;
};

const issueCategories = computed(() => {
  if (isAgent.value) {
    // Agent categories
    return [
      { value: 'Machine Fault', label: 'Machine Fault' },
      { value: 'Cleaning Required', label: 'Cleaning Required' },
      { value: 'Network Issue', label: 'Network Issue' },
      { value: 'Access Issue', label: 'Access Issue' }
    ];
  } else {
    // Collector categories (original)
    return [
      { value: 'Vandalism', label: 'Vandalism' },
      { value: 'Access Issue', label: 'Access Issue' },
      { value: 'Cleaning Required', label: 'Cleaning Required' },
      { value: 'Hardware Damage', label: 'Hardware Damage' }
    ];
  }
});

const urgencyLevels = [
  { value: 'Low', label: 'Low', color: 'bg-green-100 text-green-700' },
  { value: 'Medium', label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  { value: 'Critical', label: 'Critical', color: 'bg-red-100 text-red-700' }
];

// Collector - Route & Logistics
const nextCollectionPoint = ref<any>(null);
const estimatedRouteTime = ref(0); // minutes
const vehicleStatus = ref('Ready'); // Ready, On Route, Maintenance

// Collector - Operational Health
const lowPaperMachines = ref<any[]>([]);
const truckLoad = ref({ current: 0, max: 500 }); // kg
const offlineMachines = ref<any[]>([]);

// Collector - Verification & Performance
const contaminationRate = ref(0); // percentage
const topLocation = ref({ name: '-', weight: 0 });
const shiftStartTime = ref<Date | null>(null);
const shiftDuration = ref('0:00'); // hours:minutes

// Recent Submissions with User Data
const recentSubmissionsWithUsers = ref<any[]>([]);

// Agent-specific data
const criticalAlerts = ref<any[]>([]);
const verificationQueue = ref<any[]>([]);
const agentLogs = ref<any[]>([]);
const dailyCollection = ref(0);
const dailyTarget = ref(50); // kg target
const materialBreakdown = ref({ pet: 0, aluminum: 0 });
const incentivesIssued = ref(0); // Points issued today

// AGENT Stats: Active Alerts (Bin Full, Printer Jam, Offline)
const activeAlertsCount = computed(() => {
  let count = 0;
  for (const machine of machines.value) {
    // Count offline machines
    if (!machine.isOnline) count++;
    // Count bins that are full (90%+)
    for (const comp of machine.compartments || []) {
      if (comp.percent >= 90) count++;
    }
  }
  return count;
});

// AGENT Stats: Near Capacity (>80% fill level)
const nearCapacityCount = computed(() => {
  let count = 0;
  for (const machine of machines.value) {
    for (const comp of machine.compartments || []) {
      if (comp.percent >= 80) count++;
    }
  }
  return count;
});

const onlineMachinesCount = computed(() => machines.value.filter((m) => m.isOnline).length);

// Helper for status colors
const getStatusColor = (status: string) => {
  const map: any = {
    'PENDING': 'bg-amber-100 text-amber-700',
    'APPROVED': 'bg-green-100 text-green-700',
    'VERIFIED': 'bg-green-100 text-green-700',
    'REJECTED': 'bg-red-100 text-red-700',
    'PAID': 'bg-blue-100 text-blue-700',
    'COMPLETED': 'bg-blue-100 text-blue-700'
  };
  return map[status] || 'bg-gray-100 text-gray-700';
};

// Get critical alerts from machines (Bin Full, Printer Jam, Network Disconnected)
const fetchCriticalAlerts = async () => {
  if (!isAgent.value) return;
  
  const alerts: any[] = [];
  
  for (const machine of machines.value) {
    // Bin Full alert (85%+)
    if (machine.compartments?.some((c: any) => c.percent >= 85)) {
      const fullBin = machine.compartments.find((c: any) => c.percent >= 85);
      alerts.push({
        id: `bin-full-${machine.id}-${fullBin?.label}`,
        type: 'bin_full',
        severity: fullBin?.percent >= 95 ? 'critical' : 'warning',
        machineId: machine.id,
        machineName: machine.name,
        machineAddress: machine.address,
        compartment: fullBin?.label,
        weight: fullBin?.weight,
        percent: fullBin?.percent,
        message: `Bin ${fullBin?.label} is ${fullBin?.percent}% full`,
        time: new Date()
      });
    }
    
    // Near capacity alert (70-84%)
    if (machine.compartments?.some((c: any) => c.percent >= 70 && c.percent < 85)) {
      const nearBin = machine.compartments.find((c: any) => c.percent >= 70 && c.percent < 85);
      alerts.push({
        id: `near-full-${machine.id}-${nearBin?.label}`,
        type: 'bin_near_full',
        severity: 'warning',
        machineId: machine.id,
        machineName: machine.name,
        machineAddress: machine.address,
        compartment: nearBin?.label,
        weight: nearBin?.weight,
        percent: nearBin?.percent,
        message: `Bin ${nearBin?.label} is ${nearBin?.percent}% full - soon need collection`,
        time: new Date()
      });
    }
    
    // Offline alert
    if (!machine.isOnline) {
      alerts.push({
        id: `offline-${machine.id}`,
        type: 'network_disconnected',
        severity: 'critical',
        machineId: machine.id,
        machineName: machine.name,
        machineAddress: machine.address,
        message: 'Machine is offline - no network connection',
        time: new Date()
      });
    }
    
    // Maintenance status
    if (machine.statusText === 'Maintenance' || machine.isManualOffline) {
      alerts.push({
        id: `maintenance-${machine.id}`,
        type: 'maintenance',
        severity: 'warning',
        machineId: machine.id,
        machineName: machine.name,
        machineAddress: machine.address,
        message: machine.statusText || 'Machine is under maintenance',
        time: new Date()
      });
    }
    
    // All compartments full
    if (machine.compartments?.every((c: any) => c.percent >= 90)) {
      alerts.push({
        id: `all-full-${machine.id}`,
        type: 'all_full',
        severity: 'critical',
        machineId: machine.id,
        machineName: machine.name,
        machineAddress: machine.address,
        message: 'All bins are full - immediate collection required',
        time: new Date()
      });
    }
    
    // Printer Jam alert (simulated - would come from machine API)
    if (machine.statusCode === 3 && !machine.statusText.toLowerCase().includes('maintenance')) {
      alerts.push({
        id: `printer-${machine.id}`,
        type: 'printer_jam',
        severity: 'critical',
        machineId: machine.id,
        machineName: machine.name,
        machineAddress: machine.address,
        message: 'Printer jam detected - requires physical intervention',
        time: new Date()
      });
    }
  }
  
  // Sort by severity (critical first) then by time
  const severityOrder: Record<string, number> = { critical: 0, warning: 1 };
  criticalAlerts.value = alerts.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return new Date(b.time).getTime() - new Date(a.time).getTime();
  }).slice(0, 9);
};

// Fetch verification queue (unverified submissions for agent's machines)
const fetchVerificationQueue = async () => {
  if (!isAgent.value) return;
  
  const machineIds = machines.value.map(m => m.id);
  if (machineIds.length === 0) return;
  
  let query = supabase
    .from('submission_reviews')
    .select('*, users(nickname, avatar_url), machines(device_no, name), photo_url')
    .in('device_no', machines.value.map(m => m.deviceNo || m.deviceNo))
    .eq('status', 'PENDING')
    .order('submitted_at', { ascending: false })
    .limit(3);
  
  // Filter by merchant_id if available
  if (auth.merchantId) {
    query = query.eq('merchant_id', auth.merchantId);
  }
  
  const { data } = await query;
  
  if (data) {
    verificationQueue.value = data;
  }
};

// Fetch agent-specific logs
const fetchAgentLogs = async () => {
  if (!isAgent.value) return;
  
  const machineIds = machines.value.map(m => m.deviceNo || m.id);
  if (machineIds.length === 0) return;
  
  let query = supabase
    .from('cleaning_logs')
    .select('*, machines(device_no, name, zone)')
    .in('device_no', machines.value.map(m => m.deviceNo || m.deviceNo))
    .order('created_at', { ascending: false })
    .limit(10);
  
  const { data } = await query;
  
  if (data) {
    agentLogs.value = data;
  }
};

// Fetch daily collection stats
const fetchDailyStats = async () => {
  if (!isAgent.value) return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Get machine IDs for agent's machines
  const machineIds = machines.value.map(m => m.deviceNo || m.id);
  
  let query = supabase
    .from('submission_reviews')
    .select('waste_type, api_weight, calculated_value, calculated_points')
    .gte('submitted_at', today.toISOString())
    .lt('submitted_at', tomorrow.toISOString())
    .eq('status', 'VERIFIED');
  
  // Filter by agent's machines if available
  if (machineIds.length > 0) {
    query = query.in('device_no', machines.value.map(m => m.deviceNo || m.deviceNo));
  }
  
  const { data } = await query;
  
  if (data) {
    dailyCollection.value = data.reduce((sum, s) => sum + (s.api_weight || 0), 0);
    
    // Calculate incentives issued (use points if available, otherwise value)
    const totalPoints = data.reduce((sum, s) => sum + (s.calculated_points || s.calculated_value || 0), 0);
    incentivesIssued.value = Math.round(totalPoints);
    
    // Calculate material breakdown
    const pet = data.filter(s => s.waste_type?.toLowerCase().includes('plastic') || s.waste_type?.toLowerCase().includes('pet')).length;
    const aluminum = data.filter(s => s.waste_type?.toLowerCase().includes('aluminum') || s.waste_type?.toLowerCase().includes('can')).length;
    const total = pet + aluminum || 1;
    
    materialBreakdown.value = {
      pet: Math.round((pet / total) * 100),
      aluminum: Math.round((aluminum / total) * 100)
    };
  }
};

// Submit issue report
const submitIssue = async () => {
  if (!issueDescription.value || !issueMachineId.value || !issueCategory.value) return;
  
  submittingIssue.value = true;
  
  try {
    const machine = machines.value.find(m => m.id === issueMachineId.value);
    
    console.log('Submitting issue for machine:', machine?.deviceNo);
    
    const { data, error } = await supabase.from('cleaning_logs').insert({
      device_no: machine?.deviceNo,
      status: 'ISSUE_REPORTED',
      notes: issueDescription.value,
      created_by: auth.user?.email || auth.user?.id,
      issue_category: issueCategory.value,
      urgency_level: issueUrgency.value
    }).select();
    
    if (error) {
      console.error('Failed to submit issue:', error);
      alert('Failed to submit issue: ' + error.message);
      return;
    }
    
    console.log('Issue submitted successfully:', data);
    
    // Create notification for the reporter
    const reporterEmail = auth.user?.email;
    if (reporterEmail) {
      const machineName = machine?.name || machine?.deviceNo || 'Unknown';
      await supabase.from('notifications').insert({
        user_email: reporterEmail,
        title: 'Issue Reported',
        message: `Your issue for ${machineName} has been submitted and is awaiting review.`,
        is_read: false
      });
    }
    
    showReportIssueModal.value = false;
    issueDescription.value = '';
    issueMachineId.value = null;
    issueCategory.value = '';
    issueUrgency.value = 'Medium';
    alert('Issue reported successfully! You will receive a notification once it is resolved.');
  } catch (error: any) {
    console.error('Failed to submit issue:', error);
    alert('Failed to submit issue: ' + error.message);
  } finally {
    submittingIssue.value = false;
  }
};

// ==========================================
// COLLECTOR-SPECIFIC FUNCTIONS
// ==========================================

// Fetch collector's assigned tasks (machines needing attention)
const fetchCollectorTasks = async () => {
  if (!isCollector.value) return;
  
  const machineIds = machines.value.map(m => m.deviceNo || m.id);
  if (machineIds.length === 0) return;
  
  const tasks: any[] = [];
  
  for (const machine of machines.value) {
    // Priority 1: Full bins (90%+)
    for (const comp of machine.compartments || []) {
      if (comp.percent >= 90) {
        tasks.push({
          id: `full-${machine.id}-${comp.label}`,
          machineId: machine.id,
          machineName: machine.name,
          machineAddress: machine.address,
          type: 'collection',
          priority: 'high',
          message: `Bin ${comp.label} is ${comp.percent}% full - Priority Pickup`,
          compartment: comp,
          time: new Date()
        });
      } else if (comp.percent >= 70) {
        tasks.push({
          id: `moderate-${machine.id}-${comp.label}`,
          machineId: machine.id,
          machineName: machine.name,
          machineAddress: machine.address,
          type: 'collection',
          priority: 'medium',
          message: `Bin ${comp.label} is ${comp.percent}% full`,
          compartment: comp,
          time: new Date()
        });
      }
    }
    
    // Priority 2: Offline machines
    if (!machine.isOnline) {
      tasks.push({
        id: `offline-${machine.id}`,
        machineId: machine.id,
        machineName: machine.name,
        machineAddress: machine.address,
        type: 'maintenance',
        priority: machine.isManualOffline ? 'low' : 'high',
        message: machine.isManualOffline ? 'Machine disabled' : 'Machine offline - requires attention',
        time: new Date()
      });
    }
  }
  
  // Sort by priority: high > medium > low
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  collectorTasks.value = tasks.sort((a, b) => (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0));
};

// Fetch pending verifications for collector
const fetchPendingVerifications = async () => {
  if (!isCollector.value) return;
  
  let query = supabase
    .from('submission_reviews')
    .select('*, users(nickname, avatar_url), machines(device_no, name)')
    .eq('status', 'PENDING')
    .order('submitted_at', { ascending: false })
    .limit(10);
  
  // Filter by collector's machines if available
  if (machines.value.length > 0) {
    query = query.in('device_no', machines.value.map(m => m.deviceNo || m.deviceNo));
  } else if (auth.merchantId) {
    // Fallback to merchant filter
    query = query.eq('merchant_id', auth.merchantId);
  }
  
  const { data } = await query;
  
  if (data) {
    pendingVerifications.value = data;
  }
};

// Fetch collector's daily stats
const fetchCollectorStats = async () => {
  if (!isCollector.value) return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  let query = supabase
    .from('submission_reviews')
    .select('waste_type, api_weight, status, machines(name)')
    .gte('submitted_at', today.toISOString())
    .lt('submitted_at', tomorrow.toISOString());
  
  // Filter by collector's machines if available
  if (machines.value.length > 0) {
    query = query.in('device_no', machines.value.map(m => m.deviceNo || m.deviceNo));
  } else if (auth.merchantId) {
    query = query.eq('merchant_id', auth.merchantId);
  }
  
  const { data } = await query;
  
  if (data) {
    const verified = data.filter((s: any) => s.status === 'VERIFIED');
    const rejected = data.filter((s: any) => s.status === 'REJECTED');
    
    collectionStats.value = {
      todayWeight: verified.reduce((sum: number, s: any) => sum + (s.api_weight || 0), 0),
      rejectedCount: rejected.length,
      collectedCount: verified.length
    };
    
    // Calculate contamination rate
    const total = verified.length + rejected.length;
    contaminationRate.value = total > 0 ? Math.round((rejected.length / total) * 100) : 0;
  }
};

// Offload truck - mark all collected waste as delivered
const offloadTruck = async () => {
  if (!isCollector.value) return;
  
  if (!confirm('Are you sure you want to empty the truck? This will mark all collected waste as delivered to the processing center.')) {
    return;
  }
  
  offloadingTruck.value = true;
  
  try {
    // Get the device numbers for collector's machines
    const deviceNos = machines.value.map(m => m.deviceNo).filter(Boolean);
    
    if (deviceNos.length === 0) {
      alert('No machines assigned to this collector.');
      return;
    }
    
    // Call the offload API
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert('Please log in again.');
      return;
    }
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/offload-truck`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ device_nos: deviceNos })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      alert(result.message || 'Truck emptied successfully!');
      // Reset truck load
      truckLoad.value.current = 0;
      // Refresh stats
      await fetchCollectorStats();
    } else {
      alert(result.error || 'Failed to offload truck.');
    }
  } catch (error: any) {
    console.error('Error offloading truck:', error);
    alert('Failed to offload truck: ' + error.message);
  } finally {
    offloadingTruck.value = false;
  }
};

// Fetch collector route & operational data
const fetchCollectorRouteData = async () => {
  if (!isCollector.value) return;
  
  // Find next collection point (closest to 100% full)
  let maxFill = 0;
  let nextPoint: any = null;
  
  for (const machine of machines.value) {
    for (const comp of machine.compartments || []) {
      if (comp.percent > maxFill && comp.percent < 100) {
        maxFill = comp.percent;
        nextPoint = {
          name: machine.name,
          address: machine.address,
          percent: comp.percent,
          label: comp.label
        };
      }
    }
  }
  nextCollectionPoint.value = nextPoint;
  
  // Calculate estimated route time (5 min per high priority, 3 min per medium)
  const highPriority = collectorTasks.value.filter(t => t.priority === 'high').length;
  const mediumPriority = collectorTasks.value.filter(t => t.priority === 'medium').length;
  estimatedRouteTime.value = (highPriority * 5) + (mediumPriority * 3);
  
  // Find machines with low paper
  lowPaperMachines.value = machines.value.filter((m: any) => m.paperLevel && m.paperLevel < 20);
  
  // Find offline machines with duration
  offlineMachines.value = machines.value
    .filter((m: any) => !m.isOnline)
    .map((m: any) => ({
      ...m,
      offlineHours: m.lastOnline ? Math.round((Date.now() - new Date(m.lastOnline).getTime()) / (1000 * 60 * 60)) : 0
    }))
    .sort((a: any, b: any) => b.offlineHours - a.offlineHours);
  
  // Calculate truck load
  truckLoad.value.current = collectionStats.value.todayWeight;
  
  // Find top contributing location
  const locationWeights: Record<string, number> = {};
  for (const task of collectorTasks.value) {
    const loc = task.machineName;
    locationWeights[loc] = (locationWeights[loc] || 0) + (task.compartment?.percent || 0);
  }
  const topLoc = Object.entries(locationWeights).sort((a, b) => b[1] - a[1])[0];
  if (topLoc) {
    topLocation.value = { name: topLoc[0], weight: Math.round(topLoc[1]) };
  }
};

// Shift timer logic
let shiftTimer: any = null;
const startShiftTimer = () => {
  shiftStartTime.value = new Date();
  shiftTimer = setInterval(() => {
    if (shiftStartTime.value) {
      const diff = Date.now() - shiftStartTime.value.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      shiftDuration.value = `${hours}:${minutes.toString().padStart(2, '0')}`;
    }
  }, 1000);
};

// Fetch recent submissions with user data
const fetchRecentSubmissionsWithUsers = async () => {
  let query = supabase
    .from('submission_reviews')
    .select('*, users(nickname, avatar_url, email), machines(name, device_no)')
    .order('submitted_at', { ascending: false })
    .limit(10);
  
  // Filter by merchant if applicable
  if (auth.merchantId) {
    query = query.eq('merchant_id', auth.merchantId);
  }
  
  const { data } = await query;
  
  if (data) {
    recentSubmissionsWithUsers.value = data;
  }
};

// Approve or reject a submission
const verifySubmission = async (id: string, status: 'VERIFIED' | 'REJECTED') => {
  try {
    await supabase
      .from('submission_reviews')
      .update({ status })
      .eq('id', id);
    
    // Refresh the list
    await fetchPendingVerifications();
    await fetchCollectorStats();
  } catch (error) {
    console.error('Failed to verify submission:', error);
  }
};

// Show/hide verification checklist modal
const showChecklistModal = ref(false);
const pendingVerificationId = ref<string | null>(null);
const checklist = ref({ binEmpty: false, areaClean: false, printerWorking: false });

const openChecklist = (id: string) => {
  pendingVerificationId.value = id;
  checklist.value = { binEmpty: false, areaClean: false, printerWorking: false };
  showChecklistModal.value = true;
};

const submitWithChecklist = async (status: 'VERIFIED' | 'REJECTED') => {
  if (!pendingVerificationId.value) return;
  
  // If approving, require checklist completion
  if (status === 'VERIFIED' && (!checklist.value.binEmpty || !checklist.value.areaClean)) {
    alert('Please complete the checklist: Bin must be empty and area must be clean.');
    return;
  }
  
  await verifySubmission(pendingVerificationId.value, status);
  showChecklistModal.value = false;
};

// Quick action: Toggle machine status
const toggleMachineStatus = async (machineId: number, currentStatus: boolean) => {
  await machineStore.toggleOfflineMode(machineId, currentStatus);
};

// Open QR scanner (placeholder - would integrate with camera)
const openQRScanner = () => {
  alert('QR Scanner: Point camera at machine QR code to identify. This feature requires camera access.');
};

const openBigData = () => {
  const routeData = router.resolve({ name: 'BigDataPlatform' });
  window.open(routeData.href, '_blank');
};

const formatNumber = (num: number) => num.toLocaleString(undefined, { maximumFractionDigits: 1 });

const formatTime = (date: Date) => {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Format last heartbeat time
const formatHeartbeat = (date: string | null) => {
  if (!date) return 'Never';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Get fill level color based on percentage
const getFillLevelColor = (percent: number) => {
  if (percent >= 85) return 'bg-red-500';
  if (percent >= 70) return 'bg-amber-500';
  return 'bg-green-500';
};

// Get alert icon based on type
const getAlertIcon = (type: string) => {
  switch (type) {
    case 'bin_full': return Trash2;
    case 'network_disconnected': return Wifi;
    case 'printer_jam': return Printer;
    case 'maintenance': return Wrench;
    default: return AlertTriangle;
  }
};

const getAlertIconColor = (type: string) => {
  switch (type) {
    case 'bin_full': return 'text-red-600 bg-red-100';
    case 'network_disconnected': return 'text-amber-600 bg-amber-100';
    case 'printer_jam': return 'text-orange-600 bg-orange-100';
    case 'maintenance': return 'text-blue-600 bg-blue-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};

// Daily target progress percentage
const dailyProgressPercent = computed(() => {
  return Math.min(100, Math.round((dailyCollection.value / dailyTarget.value) * 100));
});

// Pie chart data for material breakdown
const petDegrees = computed(() => (materialBreakdown.value.pet / 100) * 360);
const aluminumDegrees = computed(() => (materialBreakdown.value.aluminum / 100) * 360);

onMounted(async () => {
  // Initial fetch
  machineStore.fetchMachines();
  fetchStats();
  
  // Watch for auth to finish loading, then refetch
  watch(() => auth.loading, async (isLoading) => {
    if (!isLoading) {
      console.log("Dashboard: Auth loaded, refetching data...");
      await machineStore.fetchMachines();
      fetchStats();
      
      // Fetch role-specific data
      const role = auth.role?.toUpperCase();
      if (role === 'AGENT' || role === 'VIEWER') {
        await Promise.all([
          fetchCriticalAlerts(),
          fetchVerificationQueue(),
          fetchAgentLogs(),
          fetchDailyStats(),
          fetchRecentSubmissionsWithUsers()
        ]);
      } else if (role === 'COLLECTOR') {
        await Promise.all([
          fetchCollectorTasks(),
          fetchPendingVerifications(),
          fetchCollectorStats(),
          fetchCollectorRouteData(),
          fetchRecentSubmissionsWithUsers()
        ]);
        startShiftTimer();
      }
    }
  });
  
  // Also watch for role to be set
  watch(() => auth.role, async (newRole) => {
    if (newRole) {
      console.log("Dashboard: Role set to " + newRole + ", refetching data...");
      await machineStore.fetchMachines();
      fetchStats();
      
      // Fetch role-specific data
      const role = newRole.toUpperCase();
      if (role === 'AGENT' || role === 'VIEWER') {
        await Promise.all([
          fetchCriticalAlerts(),
          fetchVerificationQueue(),
          fetchAgentLogs(),
          fetchDailyStats(),
          fetchRecentSubmissionsWithUsers()
        ]);
      } else if (role === 'COLLECTOR') {
        await Promise.all([
          fetchCollectorTasks(),
          fetchPendingVerifications(),
          fetchCollectorStats(),
          fetchCollectorRouteData(),
          fetchRecentSubmissionsWithUsers()
        ]);
        startShiftTimer();
      }
    }
  });
  
  // Watch machines for collector route data updates
  watch(() => machines.value, async () => {
    if (isCollector.value && auth.role) {
      await Promise.all([
        fetchCollectorTasks(),
        fetchCollectorRouteData()
      ]);
    }
  }, { deep: true });
});
</script>

<template>
  <div class="space-y-8 p-6 bg-gray-50 min-h-screen">

    <!-- Enhanced Header -->
    <div class="flex justify-between items-center bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
       <div class="flex items-center gap-4">
          <div class="h-14 w-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <Activity :size="28" class="text-white" />
          </div>
          <div>
            <h2 class="text-2xl font-bold text-gray-900 tracking-tight">
              <span v-if="isAgent">Agent Dashboard</span>
              <span v-else-if="isCollector">Collector Dashboard</span>
              <span v-else>Dashboard</span>
            </h2>
            <p class="text-sm text-gray-500 flex items-center gap-2">
              <Calendar :size="14" />
              {{ new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
            </p>
          </div>
       </div>
       <div class="flex items-center gap-3">
         <!-- Status Indicator -->
         <div class="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-100">
           <span class="h-2.5 w-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
           <span class="text-sm font-semibold text-emerald-700">System Online</span>
         </div>
         <!-- Quick Actions for Agents and Collectors -->
         <button 
           v-if="isAgent || isCollector"
           @click="showReportIssueModal = true"
           class="flex items-center gap-2 bg-white text-red-600 px-4 py-2.5 rounded-xl hover:bg-red-50 transition shadow-sm text-sm font-semibold border border-red-100"
         >
           <AlertTriangle :size="16" />
           Report Issue
         </button>
         <button 
           v-if="isAgent"
           @click="openQRScanner"
           class="flex items-center gap-2 bg-white text-blue-600 px-4 py-2.5 rounded-xl hover:bg-blue-50 transition shadow-sm text-sm font-semibold border border-blue-100"
         >
           <QrCode :size="16" />
           Scan QR
         </button>
         <button 
           @click="openBigData"
           class="flex items-center gap-2 bg-gradient-to-r from-slate-800 to-slate-900 text-white px-5 py-2.5 rounded-xl hover:from-slate-700 hover:to-slate-800 transition shadow-lg shadow-slate-200 text-sm font-semibold"
         >
           <BarChart3 :size="16" />
           Analytics
         </button>
       </div>
    </div>
    
    <div v-if="statsLoading && machines.length === 0" class="flex h-64 items-center justify-center">
      <div class="text-gray-400 animate-pulse font-medium">Loading Dashboard...</div>
    </div>

    <div v-else>
      <!-- AGENT Stats Cards -->
      <div v-if="isAgent" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard title="Active Alerts" :value="activeAlertsCount" color="amber" description="Requires Immediate Action">
          <template #icon><AlertTriangle :size="24" /></template>
        </StatsCard>
        <StatsCard title="Near Capacity" :value="nearCapacityCount" color="amber" description=">80% Fill Level">
          <template #icon><Activity :size="24" /></template>
        </StatsCard>
        <StatsCard title="Online Units" :value="machineLoading ? '...' : onlineMachinesCount" color="green" description="Ready for Use">
          <template #icon><Server :size="24" /></template>
        </StatsCard>
        <StatsCard title="Incentives Issued" :value="formatNumber(incentivesIssued)" color="blue" description="Points Distributed Today">
          <template #icon><Coins :size="24" /></template>
        </StatsCard>
      </div>

      <!-- Non-AGENT and Non-COLLECTOR Stats Cards (Admin/Merchant view) -->
      <div v-else-if="!isAgent && !isCollector" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard title="Pending Withdrawals" :value="pendingCount" color="amber" description="Action Required">
          <template #icon><AlertCircle :size="24" /></template>
        </StatsCard>
        <StatsCard title="Online Machines" :value="machineLoading ? '...' : onlineMachinesCount" color="green" description="Active Units">
          <template #icon><Server :size="24" /></template>
        </StatsCard>
        <StatsCard title="Total Points" :value="formatNumber(totalPoints)" color="blue" description="Lifetime Value">
          <template #icon><Coins :size="24" /></template>
        </StatsCard>
        <StatsCard title="Recycled Weight" :value="`${formatNumber(totalWeight)} kg`" color="purple" description="Environmental Impact">
          <template #icon><Scale :size="24" /></template>
        </StatsCard>
      </div>

      <!-- AGENT: Collection & Impact Data -->
      <div v-if="isAgent" class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <!-- Daily Target Progress Ring -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div class="flex items-center gap-2 mb-6">
            <div class="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
              <Target :size="20" class="text-white" />
            </div>
            <div>
              <h3 class="text-lg font-bold text-gray-900">Daily Collection Target</h3>
              <p class="text-xs text-gray-500">Track your daily progress</p>
            </div>
          </div>
          <div class="flex items-center justify-center">
            <div class="relative w-40 h-40">
              <!-- Progress Ring SVG -->
              <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <!-- Background circle -->
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="#e5e7eb"
                  stroke-width="12"
                />
                <!-- Progress circle -->
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  :stroke="dailyProgressPercent >= 100 ? '#22c55e' : '#3b82f6'"
                  stroke-width="12"
                  stroke-linecap="round"
                  :stroke-dasharray="`${dailyProgressPercent * 2.51} 251`"
                  class="transition-all duration-1000"
                />
              </svg>
              <!-- Center text -->
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-3xl font-bold text-gray-900">{{ dailyProgressPercent }}%</span>
                <span class="text-xs text-gray-500">completed</span>
              </div>
            </div>
            <div class="ml-8">
              <p class="text-3xl font-bold text-gray-900">{{ dailyCollection.toFixed(1) }} <span class="text-sm font-normal text-gray-500">kg</span></p>
              <p class="text-sm text-gray-500">collected today</p>
              <div class="mt-4 pt-4 border-t border-gray-100">
                <p class="text-xs text-gray-400">Daily target</p>
                <p class="text-lg font-bold text-gray-700">{{ dailyTarget }} kg</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Material Breakdown Pie Chart -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div class="flex items-center gap-2 mb-6">
            <div class="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <Recycle :size="20" class="text-white" />
            </div>
            <div>
              <h3 class="text-lg font-bold text-gray-900">Material Breakdown</h3>
              <p class="text-xs text-gray-500">Today's collection by type</p>
            </div>
          </div>
          <div class="flex items-center justify-center">
            <div class="relative w-40 h-40">
              <!-- Pie Chart SVG -->
              <svg class="w-full h-full" viewBox="0 0 100 100">
                <!-- PET (Green) -->
                <circle
                  cx="50" cy="50" r="25"
                  fill="transparent"
                  stroke="#22c55e"
                  stroke-width="50"
                  :stroke-dasharray="`${petDegrees} ${100 - petDegrees}`"
                  transform="rotate(-90 50 50)"
                />
                <!-- Aluminum (Blue) -->
                <circle
                  cx="50" cy="50" r="25"
                  fill="transparent"
                  stroke="#3b82f6"
                  stroke-width="50"
                  :stroke-dasharray="`${aluminumDegrees} ${100 - aluminumDegrees}`"
                  :stroke-dashoffset="`-${petDegrees}`"
                  transform="rotate(-90 50 50)"
                />
              </svg>
            </div>
            <div class="ml-8 space-y-4">
              <div class="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                <span class="w-4 h-4 rounded-full bg-green-500 shadow-sm"></span>
                <div>
                  <p class="text-sm font-bold text-gray-700">PET Plastic</p>
                  <p class="text-lg font-bold text-gray-900">{{ materialBreakdown.pet }}%</p>
                </div>
              </div>
              <div class="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                <span class="w-4 h-4 rounded-full bg-blue-500 shadow-sm"></span>
                <div>
                  <p class="text-sm font-bold text-gray-700">Aluminum</p>
                  <p class="text-lg font-bold text-gray-900">{{ materialBreakdown.aluminum }}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <!-- Live Recycling Card (Not for Collector) -->
        <div v-if="!isCollector" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-2">
              <div class="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md shadow-green-200">
                <Recycle :size="16" class="text-white" />
              </div>
              <h3 class="text-base font-bold text-gray-900">Recent Submitters</h3>
            </div>
            <router-link to="/submissions" class="text-xs font-medium text-blue-600 hover:underline">View All</router-link>
          </div>
          <div class="flex-1 space-y-3">
            <div v-for="s in recentSubmissionsWithUsers" :key="s.id" class="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100 group">
              <div class="h-10 w-10 rounded-full bg-gray-200 overflow-hidden shrink-0 group-hover:scale-110 transition-transform">
                <img v-if="s.users?.avatar_url" :src="s.users.avatar_url" class="h-full w-full object-cover" />
                <div v-else class="h-full w-full flex items-center justify-center text-gray-500 text-sm">
                  {{ s.users?.nickname?.charAt(0) || s.users?.email?.charAt(0) || '?' }}
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-gray-900 truncate">{{ s.users?.nickname || s.users?.email || 'Guest' }}</p>
                <p class="text-xs text-gray-500">{{ s.machines?.name || s.device_no || '-' }} • {{ s.api_weight }}kg</p>
              </div>
              <span class="text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase" :class="getStatusColor(s.status)">
                {{ s.status }}
              </span>
            </div>
            <div v-if="recentSubmissionsWithUsers.length === 0" class="text-center py-8 text-gray-400">
              <Recycle :size="32" class="mx-auto mb-2 opacity-50"/>
              <p class="text-sm">No recent recycling</p>
            </div>
          </div>
        </div>

        <!-- Cleaning Logs Card (Not for Collector) -->
        <div v-if="!isCollector" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-2">
              <div class="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-md shadow-purple-200">
                <Brush :size="16" class="text-white" />
              </div>
              <h3 class="text-base font-bold text-gray-900">
                <span v-if="isAgent">My Machine Logs</span>
                <span v-else>Cleaning Logs</span>
              </h3>
            </div>
            <router-link to="/cleaning-logs" class="text-xs font-medium text-blue-600 hover:underline">View All</router-link>
          </div>
          <div class="flex-1 space-y-3">
            <div v-for="c in (isAgent ? agentLogs : recentCleaning)" :key="c.id" class="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100 group">
              <div class="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                 <Wrench v-if="c.status === 'MAINTENANCE_COMPLETE' || c.status === 'ISSUE_REPORTED'" :size="18" />
                 <CheckCircle2 v-else :size="18" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-gray-900 truncate">{{ c.machines?.device_name || c.machines?.name || c.device_no || 'Unknown Machine' }}</p>
                <p class="text-xs text-gray-500">
                  <span v-if="c.status === 'ISSUE_REPORTED'">Issue: {{ c.notes }}</span>
                  <span v-else-if="c.status === 'MAINTENANCE_COMPLETE'">Maintenance completed</span>
                  <span v-else-if="c.status === 'BIN_EMPTIED'">Bin emptied</span>
                  <span v-else>{{ new Date(c.created_at).toLocaleDateString() }}</span>
                </p>
              </div>
              <span 
                class="text-[10px] px-2 py-1 rounded-full font-bold uppercase" 
                :class="getStatusColor(c.status)"
              >
                {{ c.status }}
              </span>
            </div>
            <div v-if="(isAgent ? agentLogs : recentCleaning).length === 0" class="text-center py-6 text-gray-400 text-sm">No logs found</div>
          </div>
        </div>

        <!-- Withdrawals Card (Not for Collector) -->
        <div v-if="!isCollector" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-2">
              <div class="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-200">
                <Coins :size="16" class="text-white" />
              </div>
              <h3 class="text-base font-bold text-gray-900">Withdrawals</h3>
            </div>
            <router-link to="/withdrawals" class="text-xs font-medium text-blue-600 hover:underline">View All</router-link>
          </div>
          <div class="flex-1 space-y-4">
             <div v-for="w in recentWithdrawals" :key="w.id" class="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
              <div class="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                 <img v-if="w.users?.avatar_url" :src="w.users.avatar_url" class="h-full w-full object-cover" />
                 <span v-else class="text-sm">👤</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-gray-900 truncate">{{ w.users?.nickname || 'User' }}</p>
                <p class="text-xs font-bold text-red-400">-{{ w.amount }} pts</p>
              </div>
              <div class="text-right">
                <span class="text-[10px] px-2 py-1 rounded-full font-bold uppercase block w-fit ml-auto" :class="getStatusColor(w.status)">
                  {{ w.status }}
                </span>
                <span class="text-[10px] text-gray-400 mt-1 block">{{ new Date(w.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}</span>
              </div>
            </div>
            <div v-if="recentWithdrawals.length === 0" class="text-center py-6 text-gray-400 text-sm">No activity</div>
          </div>
        </div>

      </div>

      <!-- AGENT DASHBOARD: Active Alerts & Urgent Tasks -->
      <div v-if="isAgent" class="mt-8 space-y-6">
        
        <!-- Critical Alerts Section -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
                <Bell :size="20" class="text-red-600" />
              </div>
              <div>
                <h3 class="text-lg font-bold text-gray-900">Active Alerts & Urgent Tasks</h3>
                <p class="text-xs text-gray-500">Requires immediate attention</p>
              </div>
            </div>
            <span v-if="criticalAlerts.length > 0" class="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
              {{ criticalAlerts.length }} Urgent
            </span>
          </div>
          
          <!-- Critical Alerts List -->
          <div v-if="criticalAlerts.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div 
              v-for="alert in criticalAlerts" 
              :key="alert.id"
              class="p-4 rounded-xl border-2 transition-all hover:shadow-md cursor-pointer group"
              :class="alert.severity === 'critical' ? 'border-red-200 bg-red-50/50 hover:bg-red-50' : 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'"
            >
              <div class="flex items-start gap-3">
                <div class="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" :class="getAlertIconColor(alert.type)">
                  <component :is="getAlertIcon(alert.type)" :size="18" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-gray-900 group-hover:text-red-700 transition-colors">{{ alert.machineName }}</p>
                  <p class="text-xs text-gray-500 mt-0.5">{{ alert.machineAddress }}</p>
                  <p class="text-xs text-gray-600 mt-1 font-medium">{{ alert.message }}</p>
                  <div v-if="alert.weight" class="flex items-center gap-2 mt-2">
                    <span class="text-xs bg-white px-2 py-0.5 rounded border border-gray-200">
                      {{ alert.compartment }}: {{ alert.weight }} kg
                    </span>
                    <span v-if="alert.percent" class="text-xs font-bold" :class="alert.percent >= 90 ? 'text-red-600' : 'text-amber-600'">
                      {{ alert.percent }}%
                    </span>
                  </div>
                  <p class="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                    <Clock3 :size="10" />
                    {{ formatTime(alert.time) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-8 text-gray-400 bg-gray-50 rounded-xl">
            <CheckCircle :size="32" class="mx-auto mb-3 text-green-500"/>
            <p class="font-medium text-gray-600">All systems operational</p>
            <p class="text-xs text-gray-400 mt-1">No critical alerts at this time</p>
          </div>
          
          <!-- Verification Queue -->
          <div class="mt-6 pt-6 border-t border-gray-100">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <Eye :size="18" class="text-blue-600"/>
                <h4 class="text-sm font-bold text-gray-900">Verification Queue</h4>
                <span class="text-xs font-normal text-gray-500">(Last 3 pending)</span>
              </div>
              <router-link to="/submissions" class="text-xs font-medium text-blue-600 hover:underline">View All</router-link>
            </div>
            
            <div v-if="verificationQueue.length > 0" class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div 
                v-for="item in verificationQueue" 
                :key="item.id"
                class="p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div class="flex gap-3">
                  <!-- Photo Preview -->
                  <div class="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                    <img 
                      v-if="item.photo_url" 
                      :src="item.photo_url" 
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      alt="Submission photo"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                      <Recycle :size="20"/>
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-gray-900 truncate">{{ item.users?.nickname || 'Guest' }}</p>
                    <p class="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">{{ item.waste_type }}</p>
                    <p class="text-sm font-bold text-green-600 mt-1">{{ item.api_weight }} kg</p>
                    <p class="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                      <Clock3 :size="10" />
                      {{ new Date(item.submitted_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}
                    </p>
                  </div>
                </div>
                <div class="mt-3 flex gap-2">
                  <button class="flex-1 text-xs py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition shadow-sm shadow-emerald-200">
                    <CheckCircle :size="12" class="inline mr-1"/>
                    Verify
                  </button>
                  <button class="flex-1 text-xs py-2 bg-white text-red-600 border border-red-200 rounded-lg font-semibold hover:bg-red-50 transition">
                    <X :size="12" class="inline mr-1"/>
                    Reject
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-4 text-gray-400 text-sm">No pending verifications</div>
          </div>
        </div>
        
        <!-- Machine Performance Metrics (Live) -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Gauge :size="20" class="text-blue-600" />
              </div>
              <div>
                <h3 class="text-lg font-bold text-gray-900">Machine Performance Metrics</h3>
                <p class="text-xs text-gray-500">Real-time monitoring</p>
              </div>
            </div>
            <div class="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
              <span class="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span class="text-xs font-semibold text-emerald-700">Live</span>
            </div>
          </div>
          
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="text-left text-xs font-bold text-gray-500 uppercase border-b border-gray-200">
                  <th class="pb-3">Machine</th>
                  <th class="pb-3">Status</th>
                  <th class="pb-3">Weight</th>
                  <th class="pb-3">Fill Level</th>
                  <th class="pb-3">Last Heartbeat</th>
                  <th class="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="machine in machines" :key="machine.id" class="hover:bg-gray-50 transition-colors">
                  <td class="py-4">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Server :size="18" class="text-slate-600"/>
                      </div>
                      <div>
                        <p class="text-sm font-bold text-gray-900">{{ machine.name }}</p>
                        <p class="text-[10px] text-gray-500">{{ machine.deviceNo }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="py-4">
                    <span 
                      class="px-3 py-1 text-[10px] font-bold rounded-full uppercase"
                      :class="{
                        'bg-green-100 text-green-700': machine.statusText === 'Online' || machine.statusText === 'In Use',
                        'bg-red-100 text-red-700': machine.statusText === 'Offline' || !machine.isOnline,
                        'bg-amber-100 text-amber-700': machine.statusText.includes('Full') || machine.statusText.includes('Maintenance'),
                        'bg-gray-100 text-gray-700': machine.isManualOffline
                      }"
                    >
                      {{ machine.isManualOffline ? 'Disabled' : machine.statusText }}
                    </span>
                  </td>
                  <td class="py-4">
                    <div class="space-y-1">
                      <div v-for="(comp, idx) in machine.compartments" :key="idx" class="text-xs">
                        <span class="font-medium text-gray-600">{{ comp.weight || '0' }} kg</span>
                      </div>
                    </div>
                  </td>
                  <td class="py-4">
                    <div class="space-y-2">
                      <div v-for="(comp, idx) in machine.compartments" :key="idx" class="flex items-center gap-2">
                        <span class="text-[10px] font-bold text-gray-600 w-16 truncate">{{ comp.label }}</span>
                        <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            class="h-full rounded-full transition-all duration-500"
                            :class="getFillLevelColor(comp.percent)"
                            :style="{ width: `${comp.percent}%` }"
                          ></div>
                        </div>
                        <span class="text-[10px] font-bold text-gray-700 w-10 text-right">{{ comp.percent }}%</span>
                      </div>
                    </div>
                  </td>
                  <td class="py-4">
                    <div class="text-sm">
                      <p class="font-bold text-gray-900">{{ formatHeartbeat(new Date(machineStore.lastUpdated).toISOString()) }}</p>
                      <p class="text-[10px] text-gray-500">Last sync</p>
                    </div>
                  </td>
                  <td class="py-4 text-right">
                    <button 
                      @click="toggleMachineStatus(machine.id, machine.isManualOffline)"
                      class="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors"
                      :class="machine.isManualOffline 
                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                        : 'bg-red-500 hover:bg-red-600 text-white'"
                    >
                      {{ machine.isManualOffline ? 'Enable' : 'Disable' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="machines.length === 0" class="text-center py-8 text-gray-400">
              No machines assigned
            </div>
          </div>
        </div>
      </div>

      <!-- COLLECTOR DASHBOARD -->
      <div v-else-if="isCollector" class="mt-8 space-y-6">
        
        <!-- Main 4 Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- Next Collection Point -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <Target :size="20"/>
              </div>
              <h3 class="text-sm font-bold text-gray-500">Next Collection</h3>
            </div>
            <div v-if="nextCollectionPoint" class="space-y-2">
              <p class="font-bold text-gray-900 text-lg truncate">{{ nextCollectionPoint.name }}</p>
              <p class="text-xs text-gray-500 truncate">{{ nextCollectionPoint.address }}</p>
              <div class="flex items-center gap-2 mt-2">
                <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div class="h-full bg-orange-500 rounded-full" :style="{ width: `${nextCollectionPoint.percent}%` }"></div>
                </div>
                <span class="text-sm font-bold text-orange-600">{{ nextCollectionPoint.percent }}%</span>
              </div>
            </div>
            <div v-else class="py-4">
              <p class="text-green-600 font-medium">All caught up!</p>
            </div>
          </div>
          
          <!-- Estimated Route Time -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                <Clock :size="20"/>
              </div>
              <h3 class="text-sm font-bold text-gray-500">Route Time</h3>
            </div>
            <p class="text-3xl font-bold text-gray-900">{{ estimatedRouteTime }} <span class="text-base font-normal text-gray-500">min</span></p>
            <p class="text-xs text-gray-400 mt-2">{{ collectorTasks.filter(t => t.priority === 'high').length }} high, {{ collectorTasks.filter(t => t.priority === 'medium').length }} medium</p>
          </div>
          
          <!-- Truck Load (Vehicle Capacity) -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <Truck :size="20"/>
              </div>
              <h3 class="text-sm font-bold text-gray-500">Truck Load</h3>
            </div>
            <p class="text-3xl font-bold text-gray-900">{{ truckLoad.current }} <span class="text-base font-normal text-gray-500">/ {{ truckLoad.max }} kg</span></p>
            <div class="mt-3">
              <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div class="h-full rounded-full" :class="truckLoad.current / truckLoad.max > 0.8 ? 'bg-red-500' : 'bg-orange-500'" :style="{ width: `${Math.min(100, (truckLoad.current / truckLoad.max) * 100)}%` }"></div>
              </div>
              <p v-if="truckLoad.current / truckLoad.max > 0.8" class="text-xs text-red-600 font-medium mt-2 flex items-center gap-1">
                <AlertTriangle :size="12"/> Truck nearly full - head to processing center
              </p>
              <p v-else class="text-xs text-gray-400 mt-2">{{ Math.round((1 - truckLoad.current / truckLoad.max) * 100) }}% remaining capacity</p>
            </div>
            
            <!-- Empty Truck Button -->
            <button 
              v-if="truckLoad.current > 0"
              @click="offloadTruck"
              :disabled="offloadingTruck"
              class="mt-4 w-full py-2 px-4 bg-orange-600 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <component :is="offloadingTruck ? RefreshCw : Truck" :size="16" :class="{ 'animate-spin': offloadingTruck }"/>
              {{ offloadingTruck ? 'Offloading...' : 'Empty Truck' }}
            </button>
          </div>
          
          <!-- Today's Collections -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
                <Scale :size="20"/>
              </div>
              <h3 class="text-sm font-bold text-gray-500">Today's Collections</h3>
            </div>
            <p class="text-3xl font-bold text-gray-900">{{ collectionStats.todayWeight.toFixed(1) }} <span class="text-base font-normal text-gray-500">kg</span></p>
            <div class="flex items-center gap-3 mt-2">
              <span class="text-xs text-green-600 font-medium">{{ collectionStats.collectedCount }} verified</span>
              <span class="text-xs text-red-600 font-medium">{{ collectionStats.rejectedCount }} rejected</span>
            </div>
          </div>
        </div>

        <!-- Actionable Machine Status (To-Do List) -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                <ClipboardList :size="18"/>
              </div>
              To-Do List
              <span v-if="collectorTasks.length > 0" class="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                {{ collectorTasks.length }} Tasks
              </span>
            </h3>
            <button @click="router.push('/machines')" class="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ChevronRight :size="16"/>
            </button>
          </div>
          
          <div v-if="collectorTasks.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              v-for="task in collectorTasks" 
              :key="task.id"
              class="p-4 rounded-xl border-2 transition-all hover:shadow-md cursor-pointer"
              :class="{
                'border-red-200 bg-red-50/50': task.priority === 'high' && task.type === 'collection',
                'border-amber-200 bg-amber-50/50': task.priority === 'medium',
                'border-gray-200 bg-gray-50/50': task.priority === 'low'
              }"
            >
              <div class="flex items-start gap-4">
                <div class="mt-1">
                  <span v-if="task.type === 'collection'" class="text-2xl">🗑️</span>
                  <span v-else class="text-2xl">🔧</span>
                </div>
                <div class="flex-1">
                  <div class="flex items-center justify-between mb-1">
                    <p class="font-bold text-gray-900">{{ task.machineName }}</p>
                    <span 
                      class="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase"
                      :class="{
                        'bg-red-100 text-red-700': task.priority === 'high',
                        'bg-amber-100 text-amber-700': task.priority === 'medium',
                        'bg-gray-100 text-gray-700': task.priority === 'low'
                      }"
                    >
                      {{ task.priority }}
                    </span>
                  </div>
                  <p class="text-sm text-gray-600 mb-2">{{ task.message }}</p>
                  <p class="text-xs text-gray-400 mb-3">{{ task.machineAddress }}</p>
                  
                  <!-- Fill Level Bar -->
                  <div v-if="task.compartment" class="mt-2">
                    <div class="flex items-center gap-2">
                      <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          class="h-full rounded-full transition-all"
                          :class="getFillLevelColor(task.compartment.percent)"
                          :style="{ width: `${task.compartment.percent}%` }"
                        ></div>
                      </div>
                      <span class="text-xs font-bold text-gray-600">{{ task.compartment.percent }}%</span>
                    </div>
                  </div>
                  
                  <!-- Report Issue Button -->
                  <button 
                    @click.stop="openIssueModal(task.machineId)"
                    class="mt-3 w-full py-2 px-3 bg-red-100 text-red-600 text-sm font-medium rounded-lg hover:bg-red-200 transition flex items-center justify-center gap-1"
                  >
                    <AlertTriangle :size="14"/>
                    Report Issue
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-12 bg-gray-50 rounded-xl">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 text-green-500 flex items-center justify-center">
              <CheckCircle :size="32"/>
            </div>
            <p class="font-semibold text-gray-900">All caught up!</p>
            <p class="text-sm text-gray-500">No machines need attention right now.</p>
          </div>
        </div>

        <!-- Machine Details for Collector -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                <Server :size="18"/>
              </div>
              Machine Details
              <span class="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-full">
                {{ machines.length }} Units
              </span>
            </h3>
            <button @click="router.push('/machines')" class="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ChevronRight :size="16"/>
            </button>
          </div>
          
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th class="pb-3">Machine</th>
                  <th class="pb-3">Location</th>
                  <th class="pb-3">Status</th>
                  <th class="pb-3">Compartment</th>
                  <th class="pb-3 text-right">Weight</th>
                  <th class="pb-3 text-right">Fill Level</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="machine in machines.slice(0, 10)" :key="machine.id" class="hover:bg-gray-50">
                  <td class="py-3">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-lg flex items-center justify-center"
                        :class="machine.isOnline ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'">
                        <Server :size="16"/>
                      </div>
                      <span class="font-medium text-gray-900">{{ machine.name }}</span>
                    </div>
                  </td>
                  <td class="py-3 text-sm text-gray-600 max-w-xs truncate">{{ machine.address || '-' }}</td>
                  <td class="py-3">
                    <span 
                      class="px-2 py-1 text-xs font-bold rounded-full"
                      :class="machine.isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                    >
                      {{ machine.isOnline ? 'Online' : 'Offline' }}
                    </span>
                  </td>
                  <td class="py-3">
                    <div v-if="machine.compartments && machine.compartments.length > 0" class="flex gap-1">
                      <div v-for="(comp, idx) in machine.compartments" :key="idx" 
                        class="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                        :class="{
                          'bg-red-100 text-red-700': comp.percent >= 90,
                          'bg-orange-100 text-orange-700': comp.percent >= 70 && comp.percent < 90,
                          'bg-green-100 text-green-700': comp.percent < 70
                        }"
                        :title="`${comp.label}: ${comp.percent}%`"
                      >
                        {{ comp.label }}
                      </div>
                    </div>
                    <span v-else class="text-gray-400 text-sm">-</span>
                  </td>
                  <td class="py-3 text-right">
                    <div v-if="machine.compartments && machine.compartments.length > 0" class="space-y-1">
                      <div v-for="(comp, idx) in machine.compartments" :key="idx" class="text-xs font-medium">
                        <span class="text-gray-600">{{ comp.weight || '0' }} kg</span>
                      </div>
                    </div>
                    <span v-else class="text-gray-400">-</span>
                  </td>
                  <td class="py-3 text-right">
                    <div v-if="machine.compartments && machine.compartments.length > 0" class="flex flex-col gap-1 items-end">
                      <div v-for="(comp, idx) in machine.compartments" :key="idx" class="flex items-center gap-2">
                        <div class="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            class="h-full rounded-full"
                            :class="{
                              'bg-red-500': comp.percent >= 90,
                              'bg-orange-500': comp.percent >= 70 && comp.percent < 90,
                              'bg-green-500': comp.percent < 70
                            }"
                            :style="{ width: `${comp.percent}%` }"
                          ></div>
                        </div>
                        <span class="text-xs font-bold w-10 text-right"
                          :class="{
                            'text-red-600': comp.percent >= 90,
                            'text-orange-600': comp.percent >= 70 && comp.percent < 90,
                            'text-gray-600': comp.percent < 70
                          }"
                        >
                          {{ comp.percent }}%
                        </span>
                      </div>
                    </div>
                    <span v-else class="text-gray-400">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="machines.length === 0" class="text-center py-8 text-gray-400">
            <Server :size="32" class="mx-auto mb-2"/>
            <p class="text-sm">No machines assigned</p>
          </div>
        </div>

        <!-- Live Verification Queue -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Eye :size="18"/>
              </div>
              Pending Verifications
              <span v-if="pendingVerifications.length > 0" class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full animate-pulse">
                {{ pendingVerifications.length }} New
              </span>
            </h3>
            <button @click="router.push('/submissions')" class="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ChevronRight :size="16"/>
            </button>
          </div>
          
          <div v-if="pendingVerifications.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
              v-for="item in pendingVerifications" 
              :key="item.id"
              class="p-4 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-white hover:shadow-md transition-all"
            >
              <div class="flex gap-3 mb-3">
                <div class="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden shrink-0">
                  <img v-if="item.photo_url" :src="item.photo_url" class="w-full h-full object-cover" alt="Submission"/>
                  <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                    <Recycle :size="24"/>
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-gray-900 truncate">{{ item.users?.nickname || 'Guest' }}</p>
                  <p class="text-xs text-gray-500 capitalize">{{ item.waste_type }}</p>
                  <p class="text-lg font-bold text-green-600">{{ item.api_weight }} kg</p>
                </div>
              </div>
              <div class="flex gap-2">
                <button 
                  @click="openChecklist(item.id)"
                  class="flex-1 py-2.5 bg-green-500 text-white text-sm font-bold rounded-lg hover:bg-green-600 transition flex items-center justify-center gap-1"
                >
                  <CheckCircle :size="14"/> Verify
                </button>
                <button 
                  @click="verifySubmission(item.id, 'REJECTED')"
                  class="flex-1 py-2.5 bg-white border border-red-200 text-red-600 text-sm font-bold rounded-lg hover:bg-red-50 transition"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-12 bg-gray-50 rounded-xl">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center">
              <CheckCircle :size="32"/>
            </div>
            <p class="font-semibold text-gray-900">All verified!</p>
            <p class="text-sm text-gray-500">No pending verifications at the moment.</p>
          </div>
        </div>

        <!-- Collection Logs -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                <Brush :size="18"/>
              </div>
              Recent Collections
            </h3>
            <router-link to="/cleaning-logs" class="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ChevronRight :size="16"/>
            </router-link>
          </div>
          <div class="space-y-3">
            <div v-for="c in agentLogs.slice(0, 5)" :key="c.id" class="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
              <div class="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                :class="c.status === 'BIN_EMPTIED' || c.status === 'VERIFIED' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'">
                <CheckCircle2 v-if="c.status === 'BIN_EMPTIED' || c.status === 'VERIFIED'" :size="20" />
                <Wrench v-else :size="20" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-gray-900 truncate">{{ c.machines?.name || c.device_no || 'Unknown Machine' }}</p>
                <p class="text-xs text-gray-500">
                  <span v-if="c.status === 'BIN_EMPTIED'" class="text-green-600 font-medium">Bin emptied</span>
                  <span v-else-if="c.status === 'CLEANING_COMPLETE'" class="text-purple-600 font-medium">Cleaning completed</span>
                  <span v-else-if="c.status === 'MAINTENANCE_COMPLETE'" class="text-blue-600 font-medium">Maintenance completed</span>
                  <span v-else-if="c.status === 'ISSUE_REPORTED'" class="text-red-600 font-medium">Issue: {{ c.notes }}</span>
                  <span v-else>{{ c.status }}</span>
                </p>
              </div>
              <span class="text-xs text-gray-400 whitespace-nowrap">{{ new Date(c.created_at).toLocaleDateString() }}</span>
            </div>
            <div v-if="agentLogs.length === 0" class="text-center py-8 text-gray-400">
              <Package :size="32" class="mx-auto mb-2"/>
              <p class="text-sm">No collection records yet</p>
            </div>
          </div>
        </div>

        <!-- Recent Users/Submitters -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <QrCode :size="18"/>
              </div>
              Recent Submitters
            </h3>
            <router-link to="/submissions" class="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ChevronRight :size="16"/>
            </router-link>
          </div>
          <div class="space-y-3">
            <div v-for="sub in recentSubmissionsWithUsers.slice(0, 8)" :key="sub.id" class="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
              <div class="h-10 w-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
                <img v-if="sub.users?.avatar_url" :src="sub.users.avatar_url" class="h-full w-full object-cover" />
                <div v-else class="h-full w-full flex items-center justify-center text-gray-500 text-sm">
                  {{ sub.users?.nickname?.charAt(0) || sub.users?.email?.charAt(0) || '?' }}
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-gray-900 truncate">{{ sub.users?.nickname || sub.users?.email || 'Guest' }}</p>
                <p class="text-xs text-gray-500">{{ sub.machines?.name || sub.device_no || 'Unknown Machine' }}</p>
              </div>
              <div class="text-right">
                <p class="text-sm font-bold text-green-600">{{ sub.api_weight }} kg</p>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold" :class="sub.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : sub.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'">
                  {{ sub.status }}
                </span>
              </div>
            </div>
            <div v-if="recentSubmissionsWithUsers.length === 0" class="text-center py-8 text-gray-400">
              <QrCode :size="32" class="mx-auto mb-2"/>
              <p class="text-sm">No submissions yet</p>
            </div>
          </div>
        </div>
      </div>

      <!-- System Health (for non-agents and non-collectors) -->
      <div v-else-if="!isAgent && !isCollector" class="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <Activity class="text-green-600" :size="20" />
          <h3 class="text-sm font-bold text-gray-900">System Health</h3>
          <span class="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100 flex items-center gap-2">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            All Systems Operational
          </span>
        </div>
        <div class="text-xs text-gray-400">Last synced: {{ new Date().toLocaleTimeString() }}</div>
      </div>

    </div>
  </div>

  <!-- Report Issue Modal -->
  <div v-if="showReportIssueModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
          <AlertTriangle :size="20" class="text-red-600"/>
          Report Issue
        </h3>
        <button @click="showReportIssueModal = false" class="text-gray-400 hover:text-gray-600">
          <X :size="20"/>
        </button>
      </div>
      
      <div class="space-y-4">
        <!-- Machine Selection -->
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-2">Select Machine</label>
          <select 
            v-model="issueMachineId"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option :value="null">Select a machine...</option>
            <option v-for="m in machines" :key="m.id" :value="m.id">{{ m.name }} ({{ m.deviceNo }})</option>
          </select>
        </div>
        
        <!-- Issue Category -->
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-2">Issue Category</label>
          <select 
            v-model="issueCategory"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="">Select category...</option>
            <option v-for="cat in issueCategories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
          </select>
        </div>
        
        <!-- Urgency Level -->
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-2">Urgency Level</label>
          <div class="flex gap-2">
            <button
              v-for="level in urgencyLevels"
              :key="level.value"
              @click="issueUrgency = level.value"
              :class="[
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition',
                issueUrgency === level.value 
                  ? level.color + ' ring-2 ring-offset-2 ring-' + (level.value === 'Critical' ? 'red' : level.value === 'Medium' ? 'amber' : 'green') + '-400' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              ]"
            >
              {{ level.label }}
            </button>
          </div>
        </div>
        
        <!-- Issue Description -->
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-2">Issue Description</label>
          <textarea 
            v-model="issueDescription"
            rows="4"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="Describe the issue in detail..."
          ></textarea>
        </div>
        
        <button 
          @click="submitIssue"
          :disabled="!issueMachineId || !issueCategory || !issueDescription || submittingIssue"
          class="w-full py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {{ submittingIssue ? 'Submitting...' : 'Submit Issue Report' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Verification Checklist Modal (for Collectors) -->
  <div v-if="showChecklistModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
          <CheckCircle :size="20" class="text-green-600"/>
          Verification Checklist
        </h3>
        <button @click="showChecklistModal = false" class="text-gray-400 hover:text-gray-600">
          <X :size="20"/>
        </button>
      </div>
      
      <p class="text-sm text-gray-600 mb-4">Please confirm the following before verifying:</p>
      
      <div class="space-y-3">
        <label class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
          <input type="checkbox" v-model="checklist.binEmpty" class="w-5 h-5 text-green-600 rounded"/>
          <span class="text-sm font-bold text-gray-700">Bin is empty after collection</span>
        </label>
        
        <label class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
          <input type="checkbox" v-model="checklist.areaClean" class="w-5 h-5 text-green-600 rounded"/>
          <span class="text-sm font-bold text-gray-700">Surrounding area is clean</span>
        </label>
        
        <label class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
          <input type="checkbox" v-model="checklist.printerWorking" class="w-5 h-5 text-green-600 rounded"/>
          <span class="text-sm font-bold text-gray-700">Printer is working (if applicable)</span>
        </label>
      </div>
      
      <div class="flex gap-3 mt-6">
        <button 
          @click="showChecklistModal = false"
          class="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition"
        >
          Cancel
        </button>
        <button 
          @click="submitWithChecklist('REJECTED')"
          class="flex-1 py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition"
        >
          Reject
        </button>
        <button 
          @click="submitWithChecklist('VERIFIED')"
          class="flex-1 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition"
        >
          Approve
        </button>
      </div>
    </div>
  </div>
</template>