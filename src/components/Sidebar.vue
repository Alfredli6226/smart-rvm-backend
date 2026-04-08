<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
import { computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useNotifications, notificationCount, issueCount } from '../composables/useNotifications';
import { LayoutDashboard, Wallet, Users, MonitorSmartphone, LogOut, Shield, ClipboardCheck, Trash2, Settings, Globe, AlertCircle, Bell, FileText, Megaphone } from 'lucide-vue-next';

const route = useRoute();
const auth = useAuthStore();
useNotifications(); // Initialize polling for notifications
const isActive = (path: string) => route.path === path;
const handleLogout = async () => {
  try {
    await auth.logout();
  } catch (err) {
    console.error("Logout failed", err);
  }
};

const settingsPath = computed(() => {
  // If Platform Owner -> Go to Master Config
  if (auth.role === 'SUPER_ADMIN' && !auth.merchantId) {
    return '/super-admin/config';
  }
  // Else -> Go to Standard Merchant Settings
  return '/settings';
});

</script>

<template>
  <aside class="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col fixed left-0 top-0 bottom-0 z-10">
    <div class="h-16 flex items-center px-8 border-b border-gray-100">
      <div class="text-xl font-bold text-blue-600 flex items-center gap-2">
        <MonitorSmartphone />
        <span>RVM Admin</span>
      </div>
    </div>

    <nav class="flex-1 p-4 space-y-2 overflow-y-auto">
      <RouterLink to="/" 
        class="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <LayoutDashboard :size="20" />
        Dashboard
      </RouterLink>

      <RouterLink to="/submissions" 
        class="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/submissions') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <ClipboardCheck :size="20" />
        Submissions
      </RouterLink>

      <RouterLink to="/withdrawals" 
        class="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/withdrawals') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <Wallet :size="20" />
        Withdrawals
      </RouterLink>

      <RouterLink to="/users" 
        class="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/users') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <Users :size="20" />
        Users
      </RouterLink>

      <RouterLink to="/machines" 
        class="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/machines') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <MonitorSmartphone :size="20" />
        Machines
      </RouterLink>

      <RouterLink to="/cleaning-logs" 
        class="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/cleaning-logs') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <Trash2 :size="20" />
        Waste Logs
      </RouterLink>

      <RouterLink to="/reports" 
        class="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/reports') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <FileText :size="20" />
        Reports
      </RouterLink>

      <!-- Notifications - visible to Agents and Collectors (not SUPER_ADMIN) -->
      <RouterLink to="/notifications" 
        v-if="auth.role !== 'SUPER_ADMIN'"
        class="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors relative"
        :class="isActive('/notifications') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <Bell :size="20" />
        <span>Notifications</span>
        <span 
          v-if="notificationCount > 0" 
          class="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full"
        >
          {{ notificationCount > 99 ? '99+' : notificationCount }}
        </span>
      </RouterLink>

      <RouterLink to="/admins" 
        class="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/admins') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
        >
        <Shield :size="20" /> 
        Admin Access
      </RouterLink>

      <div v-if="auth.role === 'SUPER_ADMIN' && !auth.merchantId" class="pt-6 mt-2 border-t border-gray-100">
        <p class="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Platform Owner</p>
        
        <RouterLink to="/super-admin/merchants" 
          class="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors"
          :class="isActive('/super-admin/merchants') ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
        >
          <Globe :size="20" />
          Manage Clients
        </RouterLink>

        <RouterLink to="/platform/advertising" 
          class="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors"
          :class="isActive('/platform/advertising') ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
        >
          <Megaphone :size="20" />
          Digital Advertising
        </RouterLink>

        <RouterLink to="/super-admin/issues" 
          class="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors relative"
          :class="isActive('/super-admin/issues') ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
        >
          <AlertCircle :size="20" />
          <span>Issue Reports</span>
          <span
            v-if="issueCount > 0"
            class="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full"
          >
            {{ issueCount > 99 ? '99+' : issueCount }}
          </span>
        </RouterLink>
      </div>
    </nav>

    <div class="p-4 border-t border-gray-100 space-y-2">
      <RouterLink 
          :to="settingsPath" 
          class="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors"
          :class="isActive(settingsPath) ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
        >
          <Settings :size="20" />
          Settings
        </RouterLink>

      <button 
        @click="handleLogout"
        class="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg w-full transition-colors cursor-pointer"
      >
        <LogOut :size="20" />
        Logout
      </button>
    </div>
  </aside>
</template>