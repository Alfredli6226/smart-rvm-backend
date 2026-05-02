<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
import { computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useNotifications, notificationCount, issueCount } from '../composables/useNotifications';
import { 
  LayoutDashboard, MonitorSmartphone, Activity, BarChart3, 
  ClipboardCheck, Wallet, Users, ShoppingBag, Trash2, FileText, Truck,
  MessageCircle, Bell, ShieldCheck, Trophy, Shield, Percent, Globe, Megaphone, AlertCircle,
  Settings, LogOut, X
} from 'lucide-vue-next';

defineProps<{ mobileOpen?: boolean }>();
const emit = defineEmits(['close']);
const route = useRoute();
const auth = useAuthStore();
useNotifications();
const isActive = (path: string) => route.path === path;
const handleLogout = async () => { try { await auth.logout(); } catch {} };

const settingsPath = computed(() => {
  if (auth.role === 'SUPER_ADMIN' && !auth.merchantId) return '/super-admin/config';
  return '/settings';
});
</script>

<template>
  <div v-if="mobileOpen" class="fixed inset-0 bg-black/50 z-20 lg:hidden" @click="emit('close')"></div>
  
  <aside :class="[
    'w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col fixed left-0 top-0 bottom-0 z-30 transition-transform duration-300 lg:translate-x-0 lg:z-10',
    mobileOpen ? 'translate-x-0' : '-translate-x-full'
  ]">
    <button @click="emit('close')" class="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 lg:hidden">
      <X :size="20" class="text-gray-500" />
    </button>
    <div class="h-16 flex items-center px-8 border-b border-gray-100">
      <div class="text-xl font-bold text-blue-600 flex items-center gap-2">
        <MonitorSmartphone />
        <span>RVM Admin</span>
      </div>
    </div>

    <nav class="flex-1 p-4 space-y-2 overflow-y-auto">

      <!-- ===== 1. DASHBOARD ===== -->
      <p class="px-4 pt-2 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wider">Dashboard</p>
      <RouterLink to="/" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/') && route.path === '/' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <LayoutDashboard :size="18" />
        Overview
      </RouterLink>

      <RouterLink to="/live-ops" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/live-ops') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <Activity :size="18" />
        Live Ops
      </RouterLink>

      <RouterLink to="/active-recyclers" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/active-recyclers') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <BarChart3 :size="18" />
        Analytics
      </RouterLink>

      <!-- ===== 2. OPERATIONS ===== -->
      <p class="px-4 pt-5 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wider">Operations</p>

      <RouterLink to="/submissions" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/submissions') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <ClipboardCheck :size="18" />
        Drop-offs
      </RouterLink>

      <RouterLink to="/withdrawals" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/withdrawals') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <Wallet :size="18" />
        Cash Out
      </RouterLink>

      <RouterLink to="/users" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/users') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <Users :size="18" />
        Users
      </RouterLink>

      <RouterLink to="/machines" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/machines') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <MonitorSmartphone :size="18" />
        Machines
      </RouterLink>

      <RouterLink to="/orders" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/orders') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <ShoppingBag :size="18" />
        Shop Orders
      </RouterLink>

      <RouterLink to="/cleaning-logs" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/cleaning-logs') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <Trash2 :size="18" />
        Waste Logs
      </RouterLink>

      <RouterLink to="/reports" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/reports') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <FileText :size="18" />
        Reports
      </RouterLink>

      <RouterLink to="/bulk-collection" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/bulk-collection') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <Truck :size="18" />
        Bulk Collection
      </RouterLink>

      <!-- ===== 3. ADMIN ===== -->
      <p class="px-4 pt-5 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wider">Admin</p>

      <RouterLink to="/customer-service" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/customer-service') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <MessageCircle :size="18" />
        Customer Support
      </RouterLink>

      <RouterLink to="/notifications" 
        v-if="auth.role !== 'SUPER_ADMIN'"
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors relative"
        :class="isActive('/notifications') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <Bell :size="18" />
        <span>Notifications</span>
        <span v-if="notificationCount > 0" class="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full">
          {{ notificationCount > 99 ? '99+' : notificationCount }}
        </span>
      </RouterLink>

      <RouterLink to="/ai-verification" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/ai-verification') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <ShieldCheck :size="18" />
        AI Verification
      </RouterLink>

      <RouterLink to="/admin-leaderboard" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/admin-leaderboard') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <Trophy :size="18" class="text-amber-500" />
        Leaderboard
      </RouterLink>

      <RouterLink to="/agencies" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive('/agencies') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <Shield :size="18" />
        Agencies
      </RouterLink>

      <!-- ===== 4. PLATFORM OWNER (Super Admin only) ===== -->
      <div v-if="auth.role === 'SUPER_ADMIN' && !auth.merchantId" class="pt-5 mt-2 border-t border-gray-100">
        <p class="px-4 pb-1 text-xs font-bold text-purple-500 uppercase tracking-wider">Platform Owner</p>

        <RouterLink to="/agencies/commission" 
          class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
          :class="isActive('/agencies/commission') ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
        >
          <Percent :size="18" />
          Commission
        </RouterLink>

        <RouterLink to="/super-admin/merchants" 
          class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
          :class="isActive('/super-admin/merchants') ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
        >
          <Globe :size="18" />
          Manage Clients
        </RouterLink>

        <RouterLink to="/platform/advertising" 
          class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
          :class="isActive('/platform/advertising') ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
        >
          <Megaphone :size="18" />
          Advertising
        </RouterLink>

        <RouterLink to="/super-admin/issues" 
          class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors relative"
          :class="isActive('/super-admin/issues') ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
        >
          <AlertCircle :size="18" />
          <span>Issues</span>
          <span v-if="issueCount > 0" class="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full">
            {{ issueCount > 99 ? '99+' : issueCount }}
          </span>
        </RouterLink>
      </div>
    </nav>

    <div class="p-4 border-t border-gray-100 space-y-2">
      <RouterLink :to="settingsPath" 
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
        :class="isActive(settingsPath) ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
      >
        <Settings :size="18" />
        Settings
      </RouterLink>
      <button @click="handleLogout"
        class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg w-full transition-colors cursor-pointer"
      >
        <LogOut :size="18" />
        Logout
      </button>
    </div>
  </aside>
</template>