<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { supabase } from '../services/supabase';
import { 
  AlertCircle, Search, CheckCircle, XCircle, 
  Clock, Trash2, User, Server, RefreshCw, Filter
} from 'lucide-vue-next';

const auth = useAuthStore();
const loading = ref(false);
const records = ref<any[]>([]);
const searchTerm = ref('');
const statusFilter = ref('');

const filteredRecords = computed(() => {
  let result = records.value;
  
  if (statusFilter.value) {
    result = result.filter(r => r.status === statusFilter.value);
  }
  
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase();
    result = result.filter(r => 
      (r.device_no && r.device_no.toLowerCase().includes(term)) ||
      (r.notes && r.notes.toLowerCase().includes(term)) ||
      (r.created_by && r.created_by.toLowerCase().includes(term))
    );
  }
  
  return result;
});

const statusColors: Record<string, string> = {
  'ISSUE_REPORTED': 'bg-red-100 text-red-700',
  'RESOLVED': 'bg-green-100 text-green-700',
  'IN_PROGRESS': 'bg-blue-100 text-blue-700'
};

const fetchIssueReports = async () => {
  loading.value = true;
  try {
    console.log('Fetching issue reports from cleaning_logs...');
    
    // First try to fetch ALL records from cleaning_logs (no filter)
    const { data, error, count } = await supabase
      .from('cleaning_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
    
    console.log('Total records in cleaning_logs:', count);
    console.log('Data:', data);
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    records.value = data || [];
    console.log('Loaded records:', records.value.length);
  } catch (err) {
    console.error('Error fetching issue reports:', err);
    // Try alternative - fetch from cleaning_records instead
    try {
      console.log('Trying cleaning_records table instead...');
      const { data: altData, error: altError } = await supabase
        .from('cleaning_records')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!altError && altData) {
        console.log('Found records in cleaning_records:', altData.length);
        records.value = altData;
      }
    } catch (altErr) {
      console.error('Alternative fetch also failed:', altErr);
    }
  } finally {
    loading.value = false;
  }
};

const updateStatus = async (id: string, newStatus: string) => {
  try {
    console.log('Updating status for:', id, 'to:', newStatus);
    
    // Get the current record before updating
    const { data: recordData, error: fetchError } = await supabase
      .from('cleaning_logs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      console.error('Error fetching record:', fetchError);
    }
    
    const { error } = await supabase
      .from('cleaning_logs')
      .update({ status: newStatus })
      .eq('id', id);
    
    if (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status: ' + error.message);
      return;
    }
    
    console.log('Status updated successfully');
    
    // If status is being set to RESOLVED and there was a creator, send notification
    if (newStatus === 'RESOLVED' && recordData?.created_by) {
      const notificationTitle = 'Issue Resolved';
      const notificationMessage = `Your reported issue for machine ${recordData.device_no || 'N/A'} has been resolved.`;
      
      console.log('Sending notification to:', recordData.created_by);
      
      const { error: notifyError } = await supabase
        .from('notifications')
        .insert({
          user_email: recordData.created_by,
          title: notificationTitle,
          message: notificationMessage,
          type: 'SUCCESS',
          reference_id: id,
          reference_type: 'issue_resolved'
        });
      
      if (notifyError) {
        console.error('Error sending notification:', notifyError);
        alert(`Status updated to RESOLVED. Note: Could not send notification - ${notifyError.message}`);
      } else {
        console.log('Notification sent successfully to:', recordData.created_by);
        alert(`Status updated to RESOLVED. Notification sent to: ${recordData.created_by}`);
      }
    } else {
      alert('Status updated to RESOLVED successfully!');
    }
    
    await fetchIssueReports();
  } catch (err) {
    console.error('Error updating status:', err);
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

onMounted(() => {
  fetchIssueReports();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">Issue Reports</h1>
      <p class="text-gray-500 mt-1">View and manage reported issues from agents and collectors</p>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
      <div class="flex flex-wrap gap-4 items-center">
        <div class="relative flex-1 min-w-[200px]">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" :size="18"/>
          <input 
            v-model="searchTerm"
            type="text" 
            placeholder="Search by machine, description, or user..."
            class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div class="flex items-center gap-2">
          <Filter :size="18" class="text-gray-400"/>
          <select 
            v-model="statusFilter"
            class="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="ISSUE_REPORTED">Reported</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
        
        <button 
          @click="fetchIssueReports"
          class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <RefreshCw :size="18" :class="{ 'animate-spin': loading }"/>
          Refresh
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div 
        @click="statusFilter = ''"
        class="bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md"
        :class="!statusFilter ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-100'"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center">
            <AlertCircle :size="20"/>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ records.length }}</p>
            <p class="text-sm text-gray-500">All Issues</p>
          </div>
        </div>
      </div>
      
      <div 
        @click="statusFilter = 'ISSUE_REPORTED'"
        class="bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md"
        :class="statusFilter === 'ISSUE_REPORTED' ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-100'"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
            <AlertCircle :size="20"/>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ records.filter(r => r.status === 'ISSUE_REPORTED').length }}</p>
            <p class="text-sm text-gray-500">Reported</p>
          </div>
        </div>
      </div>
      
      <div 
        @click="statusFilter = 'IN_PROGRESS'"
        class="bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md"
        :class="statusFilter === 'IN_PROGRESS' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-100'"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
            <Clock :size="20"/>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ records.filter(r => r.status === 'IN_PROGRESS').length }}</p>
            <p class="text-sm text-gray-500">In Progress</p>
          </div>
        </div>
      </div>
      
      <div 
        @click="statusFilter = 'RESOLVED'"
        class="bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md"
        :class="statusFilter === 'RESOLVED' ? 'border-green-500 ring-2 ring-green-100' : 'border-gray-100'"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
            <CheckCircle :size="20"/>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ records.filter(r => r.status === 'RESOLVED').length }}</p>
            <p class="text-sm text-gray-500">Resolved</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div v-if="loading" class="p-8 text-center">
        <RefreshCw class="animate-spin mx-auto text-blue-600" :size="32"/>
        <p class="mt-2 text-gray-500">Loading...</p>
      </div>
      
      <div v-else-if="records.length === 0" class="p-8 text-center">
        <AlertCircle :size="48" class="mx-auto text-gray-300 mb-4"/>
        <p class="text-gray-500">No issue reports found</p>
        <p class="text-xs text-gray-400 mt-2">Total records in DB: {{ records.length }}</p>
        <button @click="fetchIssueReports" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Refresh
        </button>
      </div>
      
      <table v-else class="w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Machine</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Urgency</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Issue Description</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Reported By</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
            <th class="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="record in filteredRecords" :key="record.id" class="hover:bg-gray-50">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Server :size="16"/>
                </div>
                <span class="font-medium text-gray-900">{{ record.device_no || 'Unknown' }}</span>
              </div>
            </td>
            <td class="px-6 py-4">
              <span v-if="record.issue_category" class="px-2 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700">
                {{ record.issue_category }}
              </span>
              <span v-else class="text-gray-400 text-sm">-</span>
            </td>
            <td class="px-6 py-4">
              <span 
                v-if="record.urgency_level"
                class="px-2 py-1 text-xs font-bold rounded-full"
                :class="{
                  'bg-red-100 text-red-700': record.urgency_level === 'Critical',
                  'bg-amber-100 text-amber-700': record.urgency_level === 'Medium',
                  'bg-green-100 text-green-700': record.urgency_level === 'Low'
                }"
              >
                {{ record.urgency_level }}
              </span>
              <span v-else class="text-gray-400 text-sm">-</span>
            </td>
            <td class="px-6 py-4">
              <p class="text-gray-700 max-w-xs truncate">{{ record.notes || 'No description' }}</p>
            </td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-2">
                <User :size="14" class="text-gray-400"/>
                <span class="text-gray-600 text-sm">{{ record.created_by || 'Unknown' }}</span>
              </div>
            </td>
            <td class="px-6 py-4">
              <span 
                class="px-2 py-1 text-xs font-bold rounded-full"
                :class="statusColors[record.status] || 'bg-gray-100 text-gray-700'"
              >
                {{ record.status?.replace('_', ' ') || 'Unknown' }}
              </span>
            </td>
            <td class="px-6 py-4">
              <span class="text-gray-500 text-sm">{{ formatDate(record.created_at) }}</span>
            </td>
            <td class="px-6 py-4 text-right">
              <select 
                :value="record.status" 
                @change="updateStatus(record.id, ($event.target as HTMLSelectElement).value)"
                class="px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer"
                :class="statusColors[record.status] || 'bg-gray-100 text-gray-700'"
              >
                <option value="ISSUE_REPORTED">Reported</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
