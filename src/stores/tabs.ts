// src/stores/tabs.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { RouteLocationNormalized } from 'vue-router';

export const useTabsStore = defineStore('tabs', () => {
  // State: List of open tabs
  const openTabs = ref<Array<{ name: string; path: string; title: string }>>([]);

  // Action: Add a tab (called whenever route changes)
  const addTab = (route: RouteLocationNormalized) => {
    // Ignore login or hidden pages
    if (route.path === '/login' || route.meta?.hidden) return;

    const exists = openTabs.value.find(t => t.path === route.path);
    
    if (!exists) {
      // Use route meta title, or name, or fallback to path
      const title = (route.meta?.title as string) || (route.name as string) || 'Page';
      
      openTabs.value.push({
        name: route.name as string,
        path: route.path,
        title: title
      });
    }
  };

  // Action: Close a tab
  const removeTab = (path: string) => {
    const index = openTabs.value.findIndex(t => t.path === path);
    if (index !== -1) {
      openTabs.value.splice(index, 1);
    }
  };

  return { openTabs, addTab, removeTab };
});