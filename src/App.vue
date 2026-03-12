<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import { useAuthStore } from './stores/auth';

const auth = useAuthStore();

// Restore session on refresh - always initialize to ensure role is properly set
onMounted(() => {
  auth.initializeAuth();
});
</script>

<template>
  <RouterView />
</template>