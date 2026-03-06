<template>
  <div class="min-h-screen bg-gray-50 pb-20">
    
    <div class="bg-green-600 text-white pt-6 px-6 pb-12 rounded-b-3xl shadow-lg relative">
      
      <button @click="router.back()" class="absolute top-6 left-4 p-2 bg-green-700 rounded-full hover:bg-green-800 transition z-10">
        <ArrowLeft class="w-5 h-5" />
      </button>

      <div class="text-center px-10">
        <h1 class="text-2xl font-bold">{{ t('dashboard.title') }}</h1>
        <p class="text-green-100 text-sm">{{ t('dashboard.subtitle') }}</p>
      </div>
    </div>

    <div class="px-6 -mt-8 grid grid-cols-2 gap-4 relative z-10">
      <div class="bg-white p-4 rounded-2xl shadow-md text-center">
        <div class="bg-blue-100 w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2">
          <Scale class="w-5 h-5 text-blue-600" />
        </div>
        <p class="text-2xl font-bold text-gray-800">{{ stats.totalWeight }}</p>
        <p class="text-xs text-gray-500">{{ t('dashboard.kg_recycled') }}</p>
      </div>

      <div class="bg-white p-4 rounded-2xl shadow-md text-center">
        <div class="bg-yellow-100 w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2">
          <Coins class="w-5 h-5 text-yellow-600" />
        </div>
        <p class="text-2xl font-bold text-gray-800">{{ stats.totalPoints }}</p>
        <p class="text-xs text-gray-500">{{ t('dashboard.points_earned') }}</p>
      </div>
    </div>

    <div class="px-6 mt-6">
      <h3 class="text-lg font-semibold text-gray-800 mb-4">{{ t('dashboard.recent_activity') }}</h3>
      
      <div v-if="isLoading" class="space-y-3">
        <div v-for="n in 3" :key="n" class="h-20 bg-gray-200 rounded-xl animate-pulse"></div>
      </div>

      <div v-else-if="history.length === 0" class="text-center py-10 text-gray-500">
        <p>{{ t('dashboard.no_records') }}</p>
        <p class="text-sm mt-2">{{ t('dashboard.start_prompt') }}</p>
      </div>

      <div v-else class="space-y-4">
        <div v-for="item in history" :key="item.id" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="bg-green-50 p-2 rounded-lg">
              <Recycle class="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p class="font-semibold text-gray-800">{{ translateWaste(item.rubbishName) }}</p>

              <p class="text-xs text-gray-400">{{ formatDate(item.createTime) }}</p>
              <p class="text-xs text-gray-400">{{ item.deviceName }}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="font-bold text-green-600">+{{ item.integral }} pts</p>
            <p class="text-xs text-gray-500">{{ item.weight }} kg</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { ArrowLeft, Scale, Coins, Recycle } from "lucide-vue-next";
import { useUserDashboard } from "../composables/useUserDashboard.js";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const router = useRouter();
const { stats, history, isLoading, formatDate } = useUserDashboard();

const translateWaste = (name) => {
  if (!name) return t('waste.default');

  // 1. Convert to lowercase
  // 2. Replace non-alphanumeric characters (like ' / ') with a single underscore
  // 3. Trim leading/trailing underscores
  const key = name.toLowerCase()
                  .replace(/[^a-z0-9]+/g, '_') 
                  .replace(/^_+|_+$/g, '');

  // Try to translate using the generated key (e.g., 'waste.plastik_aluminium')
  const translated = t(`waste.${key}`);

  // If translation exists (doesn't return the key itself), use it. Otherwise, fallback to original name.
  return translated !== `waste.${key}` ? translated : name;
};
</script>