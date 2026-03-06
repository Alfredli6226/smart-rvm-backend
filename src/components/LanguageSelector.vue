<template>
  <div class="fixed top-4 right-4 z-[100]">
    <div
      class="flex items-center space-x-2 border border-gray-300 rounded-full bg-white shadow-md px-3 py-1 cursor-pointer hover:ring-2 hover:ring-green-400 transition"
      @click="toggleDropdown"
    >
      <img
        :src="getFlag(locale)"
        alt="flag"
        class="w-5 h-5 rounded-full border border-gray-200"
      />
      <span class="text-sm font-medium capitalize">{{ locale.toUpperCase() }}</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 text-gray-500"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
          clip-rule="evenodd"
        />
      </svg>
    </div>

    <!-- Dropdown -->
    <div
      v-if="open"
      class="absolute right-0 mt-2 bg-white shadow-lg rounded-lg border border-gray-200 w-32"
    >
      <div
        v-for="(lang, code) in languages"
        :key="code"
        class="flex items-center space-x-2 px-3 py-2 hover:bg-green-50 cursor-pointer"
        @click="setLanguage(code)"
      >
        <img
          :src="getFlag(code)"
          alt="flag"
          class="w-5 h-5 rounded-full border border-gray-200"
        />
        <span class="text-sm">{{ lang }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const { locale } = useI18n();
const open = ref(false);

const languages = {
  en: "English",
  ms: "Bahasa",
  zh: "中文",
};

const toggleDropdown = () => {
  open.value = !open.value;
};

const setLanguage = (code) => {
  locale.value = code;
  localStorage.setItem("lang", code);
  open.value = false;
};

// 🏳️ Flag image helper (from flagcdn.com)
const getFlag = (code) => {
  const flags = {
    en: "https://flagcdn.com/w20/gb.png",
    ms: "https://flagcdn.com/w20/my.png",
    zh: "https://flagcdn.com/w20/cn.png",
  };
  return flags[code];
};

// Load saved language on mount
locale.value = localStorage.getItem("lang") || "en";

watch(locale, (val) => {
  localStorage.setItem("lang", val);
});
</script>
