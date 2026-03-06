<template>
  <header
    class="fixed top-0 left-0 w-full bg-white shadow-md flex items-center gap-4 px-6 py-3 z-50"
  >
    <img
      :src="user.avatar || '/images/profile.png'"
      alt="Profile"
      class="w-12 h-12 rounded-full border border-green-300 object-cover"
      @error="$event.target.src = '/images/profile.png'"
    />

    <div class="flex flex-col">
      <div class="flex items-center gap-1">
        <h2 class="text-lg font-bold text-green-700">{{ t('home.hello') }}, {{ user.name }}</h2>
      </div>
      <p class="text-gray-500 text-sm">{{ t('home.ready') }}</p>
    </div>
  </header>
</template>

<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();
defineProps({
  user: {
    type: Object,
    required: true,
    // Defaults are handled by parent (useHomeLogic), but we keep a safe fallback structure
    default: () => ({ name: "", avatar: "" }),
  },
});
</script>