<template>
  <div class="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-6">
    <div class="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md text-center">

      <h2 class="text-2xl font-semibold mb-6">{{ t('complete_profile.title') }}</h2>

      <div class="flex flex-col items-center mb-6">
        <div class="relative">
          <img 
            :src="avatar || '/images/default-avatar.png'" 
            alt="Profile Avatar" 
            class="w-24 h-24 rounded-full border-4 border-green-100 object-cover shadow-sm"
            @error="handleImageError"
          />
          <span v-if="isGoogleAvatar" class="absolute bottom-0 right-0 bg-blue-500 text-white text-xs px-2 py-1 rounded-full border-2 border-white">
            Google
          </span>
        </div>
        <p class="text-xs text-gray-400 mt-2">{{ t('complete_profile.photo_label') }}</p>
      </div>

      <div class="mb-4 text-left">
        <label class="block text-sm text-gray-600 mb-1">{{ t('complete_profile.nickname_label') }}</label>
        <input 
          v-model="nickname" 
          placeholder="Enter nickname"
          class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none transition" 
        />
        <p v-if="isLegacyFound" class="text-xs text-green-600 mt-1 flex items-center gap-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          {{ t('complete_profile.legacy_found') }}
        </p>
      </div>

      <button @click="saveProfile"
        class="w-full mt-4 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition font-medium shadow-md">
        {{ t('complete_profile.button') }}
      </button>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { registerUserWithAutoGCM } from "../services/autogcm.js";
// 🔴 FIX 1: Import 'getOrCreateUser' correctly
import { supabase, getOrCreateUser } from "../services/supabase.js"; 
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const router = useRouter();
const route = useRoute(); 

const nickname = ref("");
const avatar = ref("");
const isGoogleAvatar = ref(false);
const isLegacyFound = ref(false);

const handleImageError = (e) => {
  e.target.src = "https://lassification.oss-cn-shenzhen.aliyuncs.com/static/mini/imgv3/head.png";
};

onMounted(() => {
  // 1. Check for Legacy Name passed from OTP page
  if (route.query.legacyName && route.query.legacyName !== 'undefined' && route.query.legacyName !== 'User') {
    nickname.value = route.query.legacyName;
    isLegacyFound.value = true;
  }

  // 2. Check for Google Temp Data 
  const tempUser = JSON.parse(localStorage.getItem("tempGoogleUser") || "{}");
  if (tempUser.avatar) {
    avatar.value = tempUser.avatar;
    isGoogleAvatar.value = true;
  }
  if (tempUser.nickname && !nickname.value) {
    nickname.value = tempUser.nickname;
  }
});

const saveProfile = async () => {
  const phone = localStorage.getItem("pendingPhoneVerified");

  // 🔴 FIX 2: Safety Check for Phone
  // Prevents "Syncing User: null" error if session is lost
  if (!phone) {
      alert("Session Error: Missing phone number. Please login again.");
      router.push("/login");
      return;
  }

  if (!nickname.value) return alert("Please enter a nickname.");

  try {
    // 1. Register/Update with AutoGCM API
    const response = await registerUserWithAutoGCM("", phone, nickname.value, avatar.value);

    if (response.code === 200) {
      const sessionData = {
        ...response.data,           
        nikeName: nickname.value,   
        nickname: nickname.value,   
        avatarUrl: avatar.value     
      };

      localStorage.setItem("autogcmUser", JSON.stringify(sessionData));
      
      // 3. Sync to Supabase (Now works because we imported it)
      await getOrCreateUser(phone, nickname.value, avatar.value);

      // 4. Cleanup & Redirect
      localStorage.removeItem("pendingPhoneVerified");
      localStorage.removeItem("tempGoogleUser");
      
      router.push("/registration-complete");
    } else {
      alert("Failed: " + (response.msg || "Unknown Error"));
    }
  } catch (err) {
    console.error(err);
    alert("An error occurred while saving profile.");
  }
};
</script>