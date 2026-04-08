<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { supabase } from '../services/supabase';
import { notificationCount, useNotifications } from '../composables/useNotifications';
import { 
  Bell, CheckCircle, AlertCircle, Info, 
  Clock, Trash2, Check, RefreshCw, Filter
} from 'lucide-vue-next';

const auth = useAuthStore();
useNotifications();
const loading = ref(false);
const notifications = ref<any[]>([]);
const statusFilter = ref('');
let refreshInterval: ReturnType<typeof setInterval> | null = null;

// Check if user is Agent or Collector
const isAgent = computed(() => auth.role === 'AGENT');
const isCollector = computed(() => auth.role === 'COLLECTOR');
const isAgentOrCollector = computed(() => isAgent.value || isCollector.value);

const unreadCount = computed(() => {
  return filteredNotifications.value.filter(n => !n.is_read).length;
});

// Filter notifications based on status filter (for agents/collectors)
const filteredNotifications = computed(() => {
  if (!statusFilter.value) return notifications.value;
  return notifications.value.filter(n => {
    if (statusFilter.value === 'ISSUE_REPORTED') {
      return n.reference_type === 'issue_reported';
    } else if (statusFilter.value === 'IN_PROGRESS') {
      return n.reference_type === 'issue_in_progress';
    } else if (statusFilter.value === 'RESOLVED') {
      return n.reference_type === 'issue_resolved';
    }
    return true;
  });
});

const fetchNotifications = async () => {
  if (!auth.user?.email) return;
  
  loading.value = true;
  try {
    console.log('Fetching notifications for:', auth.user.email);
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_email', auth.user.email)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    notifications.value = data || [];
    console.log('Loaded notifications:', notifications.value.length);
  } catch (err) {
    console.error('Error fetching notifications:', err);
  } finally {
    loading.value = false;
  }
};

const markAsRead = async (id: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      console.error('Error marking as read:', error);
      return;
    }
    
    // Update local state
    const notification = notifications.value.find(n => n.id === id);
    if (notification) {
      notification.is_read = true;
      notification.read_at = new Date().toISOString();
    }
    
    // Update sidebar badge count
    notificationCount.value = Math.max(0, notificationCount.value - 1);
  } catch (err) {
    console.error('Error marking as read:', err);
  }
};

const markAllAsRead = async () => {
  if (!auth.user?.email) return;
  
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_email', auth.user.email)
      .eq('is_read', false);
    
    if (error) {
      console.error('Error marking all as read:', error);
      return;
    }
    
    // Update local state
    notifications.value.forEach(n => {
      n.is_read = true;
      n.read_at = new Date().toISOString();
    });
    
    // Update sidebar badge count
    notificationCount.value = 0;
  } catch (err) {
    console.error('Error marking all as read:', err);
  }
};

const deleteNotification = async (id: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting notification:', error);
      return;
    }
    
    // Remove from local state
    notifications.value = notifications.value.filter(n => n.id !== id);
  } catch (err) {
    console.error('Error deleting notification:', err);
  }
};

const getTypeIcon = (notification: any) => {
  // First check reference_type for issue-specific notifications
  if (notification.reference_type === 'issue_in_progress') {
    return Clock;
  }
  if (notification.reference_type === 'issue_resolved') {
    return CheckCircle;
  }
  if (notification.reference_type === 'issue_reported') {
    return AlertCircle;
  }
  
  // Fall back to type-based icons
  switch (notification.type) {
    case 'SUCCESS':
      return CheckCircle;
    case 'ERROR':
      return AlertCircle;
    case 'WARNING':
      return AlertCircle;
    default:
      return Info;
  }
};

const getTypeColor = (notification: any) => {
  // First check reference_type for issue-specific notifications
  if (notification.reference_type === 'issue_in_progress') {
    return 'bg-amber-100 text-amber-600';
  }
  if (notification.reference_type === 'issue_resolved') {
    return 'bg-green-100 text-green-600';
  }
  if (notification.reference_type === 'issue_reported') {
    return 'bg-red-100 text-red-600';
  }
  
  // Fall back to type-based colors
  switch (notification.type) {
    case 'SUCCESS':
      return 'bg-green-100 text-green-600';
    case 'ERROR':
      return 'bg-red-100 text-red-600';
    case 'WARNING':
      return 'bg-amber-100 text-amber-600';
    default:
      return 'bg-blue-100 text-blue-600';
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

onMounted(() => {
  fetchNotifications();
  // Auto-refresh every 10 seconds
  refreshInterval = setInterval(() => {
    fetchNotifications();
  }, 10000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <!-- Header -->
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Notifications</h1>
        <p class="text-gray-500 mt-1">Stay updated on your reported issues and system alerts</p>
      </div>
      
      <div class="flex items-center gap-3">
        <button 
          v-if="unreadCount > 0"
          @click="markAllAsRead"
          class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Check :size="18"/>
          Mark all as read
        </button>
        
        <button 
          @click="fetchNotifications"
          class="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
        >
          <RefreshCw :size="18" :class="{ 'animate-spin': loading }"/>
          Refresh
        </button>
      </div>
    </div>

    <!-- Filter for Agents/Collectors -->
    <div v-if="isAgentOrCollector" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
      <div class="flex flex-wrap gap-4 items-center">
        <div class="flex items-center gap-2">
          <Filter :size="18" class="text-gray-400"/>
          <span class="text-sm font-semibold text-gray-700">Filter by Status:</span>
        </div>
        <select 
          v-model="statusFilter"
          class="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Notifications</option>
          <option value="ISSUE_REPORTED">Reported</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
            <Bell :size="20"/>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ filteredNotifications.length }}</p>
            <p class="text-sm text-gray-500">{{ statusFilter ? 'Filtered' : 'Total' }} Notifications</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
            <AlertCircle :size="20"/>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ unreadCount }}</p>
            <p class="text-sm text-gray-500">Unread</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Notifications List -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div v-if="loading" class="p-8 text-center">
        <RefreshCw class="animate-spin mx-auto text-blue-600" :size="32"/>
        <p class="mt-2 text-gray-500">Loading...</p>
      </div>
      
      <div v-else-if="filteredNotifications.length === 0" class="p-8 text-center">
        <Bell :size="48" class="mx-auto text-gray-300 mb-4"/>
        <p class="text-gray-500">No notifications{{ statusFilter ? ' for selected filter' : '' }} yet</p>
        <p class="text-xs text-gray-400 mt-2">You'll receive notifications when your reported issues are resolved</p>
      </div>
      
      <div v-else class="divide-y divide-gray-100">
        <div 
          v-for="notification in filteredNotifications" 
          :key="notification.id"
          class="p-4 hover:bg-gray-50 transition flex items-start gap-4"
          :class="{ 'bg-blue-50/50': !notification.is_read }"
        >
          <!-- Icon -->
          <div 
            class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            :class="getTypeColor(notification)"
          >
            <component :is="getTypeIcon(notification)" :size="20"/>
          </div>
          
          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h3 
                  class="font-semibold text-gray-900"
                  :class="{ 'font-bold': !notification.is_read }"
                >
                  {{ notification.title }}
                </h3>
                <p class="text-gray-600 text-sm mt-0.5">{{ notification.message }}</p>
                <div class="flex items-center gap-3 mt-2">
                  <span class="text-xs text-gray-400 flex items-center gap-1">
                    <Clock :size="12"/>
                    {{ formatDate(notification.created_at) }}
                  </span>
                  <span 
                    v-if="notification.is_read" 
                    class="text-xs text-green-600 flex items-center gap-1"
                  >
                    <Check :size="12"/>
                    Read
                  </span>
                </div>
              </div>
              
              <!-- Actions -->
              <div class="flex items-center gap-1 flex-shrink-0">
                <button 
                  v-if="!notification.is_read"
                  @click="markAsRead(notification.id)"
                  class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="Mark as read"
                >
                  <Check :size="16"/>
                </button>
                <button 
                  @click="deleteNotification(notification.id)"
                  class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Delete"
                >
                  <Trash2 :size="16" />
                </button>
              </div>
            </div>
          </div>
          
          <!-- Unread indicator -->
          <div 
            v-if="!notification.is_read" 
            class="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>
