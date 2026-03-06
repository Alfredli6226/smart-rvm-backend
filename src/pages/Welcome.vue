<template>
  <div class="w-full min-h-screen flex flex-col justify-between bg-gradient-to-b from-green-100 to-white text-gray-800">
    <!-- 🌐 Language Selector -->
    <LanguageSelector />

    <!-- 🟢 Logo and Tagline -->
    <main class="flex flex-col items-center justify-center flex-grow px-6 text-center md:px-20 lg:px-40">

      <img
        src="/icons/logo.png"
        alt="App Logo"
        class="w-64 h-64 mb-6 md:w-80 md:h-80 animate-fadeIn"
      />
      <h1 class="text-3xl md:text-4xl font-bold text-green-700">{{ t("title") }}</h1>
      <p class="text-gray-600 mt-3 text-base md:text-lg md:max-w-2xl lg:max-w-3xl">
        {{ t("tagline") }}
      </p>

      <!-- 🚀 Button -->
      <button
        @click="goToLogin"
        class="mt-8 bg-green-600 text-white px-10 py-3 rounded-full text-lg font-medium shadow hover:bg-green-700 transition transform hover:scale-105"
      >
        {{ t("get_started_button") }}
      </button>
    </main>

    <!-- ⚙️ Footer -->
    <footer class="text-gray-400 text-sm text-center py-4">
      © 2025 {{ t("footer") }}
    </footer>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import LanguageSelector from "../components/LanguageSelector.vue";

const router = useRouter();
const { t } = useI18n();

const goToLogin = () => {
  router.push("/login");
};
</script>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fadeIn {
  animation: fadeIn 1.2s ease-in-out;
}
</style>
