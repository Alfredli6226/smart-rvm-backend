<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'; 
import { useRoute } from 'vue-router';
import { watch } from 'vue';
import { useTabsStore } from '../stores/tabs';
import { useAuthStore } from '../stores/auth';
import { useMachineStore } from '../stores/machines';
import { RefreshCw, HelpCircle, Monitor, Info, Menu } from 'lucide-vue-next'; 
import Sidebar from './Sidebar.vue';
import TabsBar from './TabsBar.vue';

const mobileMenuOpen = ref(false);

const route = useRoute();
const tabsStore = useTabsStore();
const auth = useAuthStore();
const machineStore = useMachineStore();

// Check if current user is a VIEWER
const isViewer = computed(() => auth.role === 'VIEWER');

// Get viewer assignment info
const viewerAssignmentSummary = computed(() => {
  if (!isViewer.value) return null;
  
  const assignments = machineStore.viewerAssignments;
  if (!assignments || assignments.length === 0) return null;
  
  const machineNames = assignments
    .filter(a => a.machines)
    .map(a => a.machines.name)
    .slice(0, 3);
  
  const totalCount = assignments.length;
  const displayText = machineNames.length > 0 
    ? `${machineNames.join(', ')}${totalCount > 3 ? ` +${totalCount - 3} more` : ''}`
    : `${totalCount} machine${totalCount > 1 ? 's' : ''}`;
  
  return {
    count: totalCount,
    text: displayText,
    machines: assignments.filter(a => a.machines)
  };
});

// Refresh Logic State
const refreshKey = ref(0);
const isRefreshing = ref(false);

const handleRefresh = () => {
  isRefreshing.value = true;
  refreshKey.value += 1; 
  setTimeout(() => {
    isRefreshing.value = false;
  }, 1000);
};

// Automatically add tab when route changes
watch(
  () => route.path,
  () => {
    tabsStore.addTab(route);
  },
  { immediate: true }
);

const getPageTitle = () => {
  return (route.meta?.title as string) || route.name?.toString() || 'Dashboard';
};

// 🔥 Fetch viewer assignments on mount
onMounted(async () => {
  // Wait for auth to be ready
  const checkAuth = () => {
    return new Promise<void>((resolve) => {
      if (!auth.loading && auth.role) {
        resolve();
      } else {
        const interval = setInterval(() => {
          if (!auth.loading && auth.role) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      }
    });
  };
  
  await checkAuth();
  
  // Fetch machines (which will also load viewer assignments)
  if (auth.role === 'VIEWER') {
    await machineStore.fetchMachines();
  }
});
</script>

<template>
  <div class="flex min-h-screen bg-gray-50 font-sans overflow-x-hidden">
    
    <div class="fixed inset-y-0 left-0 z-30 w-64 bg-white transition-all duration-300">
      <Sidebar :mobileOpen="mobileMenuOpen" @close="mobileMenuOpen = false" />
    </div>

    <!-- Mobile menu button -->
    <button @click="mobileMenuOpen = true" class="fixed top-4 left-4 z-20 p-2 rounded-xl bg-white shadow-md border border-gray-200 lg:hidden active:scale-95">
      <Menu :size="22" class="text-gray-700" />
    </button>
    
    <main class="flex-1 flex flex-col min-h-screen lg:ml-64 relative bg-gray-50">
      
      <header class="bg-white border-b border-gray-200 min-h-[3.5rem] flex items-center justify-between px-4 sm:px-14 lg:px-8 shadow-sm shrink-0 z-20">
        
        <div class="flex items-center gap-4">
          <h2 class="text-xl font-semibold text-gray-800 tracking-tight">
            {{ getPageTitle() }}
          </h2>

          <button 
            @click="handleRefresh" 
            class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all active:scale-95"
            title="Refresh Data"
          >
            <RefreshCw :size="18" :class="{'animate-spin': isRefreshing}" />
          </button>
        </div>
        
        <div class="flex items-center gap-4">
          
          <router-link 
            to="/admin/docs" 
            target="_blank"
            class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all relative group"
            title="Admin Operations Manual"
          >
            <HelpCircle :size="20" />
            <span class="absolute top-full right-0 mt-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Admin SOP
            </span>
          </router-link>

          <div class="h-6 w-px bg-gray-200 mx-2"></div>

          <div class="text-right hidden md:block">
            <div class="text-sm font-medium text-gray-900">
              {{ auth.user?.email || 'Administrator' }}
            </div>
            <div class="text-xs text-gray-500 capitalize">
              {{ auth.role?.replace('_', ' ').toLowerCase() || 'User' }}
            </div>
          </div>
          
          <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border-2 border-white shadow-md uppercase">
            {{ auth.user?.email?.charAt(0) || 'A' }}
          </div>
        </div>
      </header>
      
      <div class="shrink-0 z-10 w-full bg-gray-100">
          <TabsBar />
      </div>

      <!-- 🔥 VIEWER Assignment Notification Banner -->
      <div v-if="isViewer && viewerAssignmentSummary" class="shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-6 py-3">
        <div class="max-w-7xl mx-auto flex items-center gap-3">
          <div class="p-2 bg-blue-100 rounded-lg">
            <Monitor class="text-blue-600" :size="18" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-semibold text-blue-900">
              You are assigned to monitor {{ viewerAssignmentSummary.count }} machine{{ viewerAssignmentSummary.count > 1 ? 's' : '' }}
            </div>
            <div class="text-xs text-blue-700">
              {{ viewerAssignmentSummary.text }}
            </div>
          </div>
          <div class="flex items-center gap-1 text-xs text-blue-500 bg-blue-100 px-2 py-1 rounded-full">
            <Info :size="12" />
            <span>Assigned View</span>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-3 sm:p-6 scroll-smooth">
        <div class="max-w-7xl mx-auto pb-10">
          <router-view v-slot="{ Component }">
            <keep-alive>
              <component :is="Component" :key="route.fullPath + '-' + refreshKey" />
            </keep-alive>
          </router-view>
        </div>
      </div>

    </main>
  </div>
</template>