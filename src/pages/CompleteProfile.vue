<template>
  <div class="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-6">
    <div class="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md text-center">

      <h2 class="text-2xl font-semibold mb-6">Complete Your Profile</h2>

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
        <p class="text-xs text-gray-400 mt-2">Photo from your Account</p>
      </div>

      <div class="mb-4 text-left">
        <label class="block text-sm text-gray-600 mb-1">Nickname</label>
        <input 
          v-model="nickname" 
          placeholder="Enter nickname"
          class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none transition" 
        />
        <p v-if="isLegacyFound" class="text-xs text-green-600 mt-1 flex items-center gap-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          Found existing name from old system
        </p>
      </div>

      <button @click="saveProfile"
        class="w-full mt-4 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition font-medium shadow-md">
        Save & Continue
      </button>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { registerUserWithAutoGCM } from "../services/autogcm.js";
import { supabase } from "../services/supabase.js"; // Import Supabase to save name

const router = useRouter();
const route = useRoute(); // To access query params

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

  // 2. Check for Google Temp Data (Optional, if you have Google Login)
  const tempUser = JSON.parse(localStorage.getItem("tempGoogleUser") || "{}");
  if (tempUser.avatar) {
    avatar.value = tempUser.avatar;
    isGoogleAvatar.value = true;
  }
  // Only override nickname from Google if we didn't find a legacy one
  if (tempUser.nickname && !nickname.value) {
    nickname.value = tempUser.nickname;
  }
});

const saveProfile = async () => {
  const phone = localStorage.getItem("pendingPhoneVerified");
  if (!nickname.value) return alert("Please enter a nickname.");

  try {
    // 1. Register/Update with AutoGCM API
    const response = await registerUserWithAutoGCM("", phone, nickname.value, avatar.value);

    if (response.code === 200) {
      // 🔴 OLD CODE (Causing the bug):
      // localStorage.setItem("autogcmUser", JSON.stringify(response.data));

      // 🟢 NEW CODE (Fix):
      // Manually ensure the specific fields your app needs are set correctly
      const sessionData = {
        ...response.data,           // Keep all data from API
        nikeName: nickname.value,   // FORCE the legacy field name your app uses
        nickname: nickname.value,   // Set the correct field name too
        avatarUrl: avatar.value     // Ensure avatar is set
      };

      localStorage.setItem("autogcmUser", JSON.stringify(sessionData));
      
      // 3. Sync to Supabase (Uses Secure RPC)
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