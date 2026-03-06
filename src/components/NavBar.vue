<template>
  <nav class="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 flex justify-around py-2 shadow-md">
    <button @click="goTo('/home-page')" class="flex flex-col items-center text-gray-600 hover:text-green-600">
      <HomeIcon class="w-8 h-8 text-green-600" />
      <span class="text-xs">{{ t('nav.home') }}</span>
    </button>

    <button class="flex items-center justify-center bg-green-600 text-white rounded-full w-14 h-14 -mt-8 shadow-lg">
      <CameraIcon class="w-8 h-8 text-white-600" />
    </button>

    <button @click="goTo('/profile')" class="flex flex-col items-center text-gray-600 hover:text-green-600">
      <UserIcon class="w-8 h-8 text-green-600" />
      <span class="text-xs">{{ t('nav.profile') }}</span>
    </button>
  </nav>
</template>

<script setup>
import { useRouter } from "vue-router";
import { CameraIcon, HomeIcon, UserIcon } from "lucide-vue-next";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const router = useRouter();
const goTo = (path) => router.push(path);
</script>
