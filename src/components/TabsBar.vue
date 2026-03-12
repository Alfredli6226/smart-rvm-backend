<script setup lang="ts">
import { useTabsStore } from '../stores/tabs';
import { useRoute, useRouter } from 'vue-router';
import { X, Home } from 'lucide-vue-next';

const store = useTabsStore();
const route = useRoute();
const router = useRouter();

const isActive = (path: string) => route.path === path;

const closeTab = (path: string) => {
  if (isActive(path)) {
    const idx = store.openTabs.findIndex(t => t.path === path);
    const next = store.openTabs[idx - 1] || store.openTabs[idx + 1];
    router.push(next ? next.path : '/');
  }
  store.removeTab(path);
};
</script>

<template>
  <div class="flex items-end space-x-1 overflow-x-auto bg-gray-100 border-b border-gray-200 px-4 pt-2 h-11 w-full">
    
    <router-link 
      to="/" 
      class="flex items-center justify-center w-10 h-9 rounded-t-lg transition-all border-t border-x mb-[-1px]"
      :class="isActive('/') ? 'bg-white text-blue-600 border-gray-200 z-10' : 'bg-gray-200/50 border-transparent text-gray-500 hover:bg-gray-200'"
    >
      <Home :size="16" />
    </router-link>

    <div 
      v-for="tab in store.openTabs" 
      :key="tab.path"
      @click="router.push(tab.path)"
      class="group relative flex items-center px-4 h-9 text-xs font-semibold rounded-t-lg cursor-pointer transition-all border-t border-x select-none mb-[-1px] min-w-[120px] max-w-[200px]"
      :class="isActive(tab.path) 
        ? 'bg-white text-blue-600 border-gray-200 shadow-sm z-10' 
        : 'bg-gray-200/50 border-transparent text-gray-500 hover:bg-gray-200 hover:text-gray-700'"
    >
      <span class="truncate mr-2">{{ tab.title }}</span>
      
      <button 
        @click.stop="closeTab(tab.path)"
        class="ml-auto p-0.5 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
        :class="{'opacity-100': isActive(tab.path)}"
      >
        <X :size="12" />
      </button>
    </div>
  </div>
</template>