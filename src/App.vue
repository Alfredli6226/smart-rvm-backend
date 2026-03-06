<template>
  <div class="min-h-screen bg-white text-gray-900 relative">
    <!-- 🌐 Global Language Selector -->
    <LanguageSelector />

    <!-- 🧭 Page Content -->
    <router-view />
  </div>
</template>

<script setup>
import LanguageSelector from "./components/LanguageSelector.vue";
</script>

<style>
/* Optional global fade transition for route changes */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
