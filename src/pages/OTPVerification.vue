<template>
  <div class="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-6">
    <div class="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md text-center">
      
      <h2 class="text-2xl font-semibold text-gray-800 mb-2">{{ t('otp.title') }}</h2>
      <p class="text-sm text-gray-500 mb-6">{{ t('otp.subtitle') }}</p> 

      <div class="flex justify-center gap-2 mb-6">
        <input 
          v-for="(digit, index) in otp" 
          :key="index"
          v-model="otp[index]"
          type="text" 
          maxlength="1"
          class="w-12 h-12 text-center border rounded-lg text-xl font-bold focus:border-green-500 outline-none transition"
          @input="moveToNext(index, $event)"
          @keydown.backspace="moveToPrev(index, $event)"
        />
      </div>

      <button @click="verifyOTP" :disabled="isLoading"
        class="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 flex justify-center items-center gap-2">
        
        <svg v-if="isLoading" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>

        <span>{{ isLoading ? statusMessage : t('otp.button_verify') }}</span>
      </button>

      <button @click="router.push('/verify-phone')" class="mt-4 text-sm text-green-600 hover:underline">
        {{ t('otp.button_back') }}
      </button>

      <p v-if="errorMessage" class="mt-4 text-sm text-red-500">{{ errorMessage }}</p>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { registerUserWithAutoGCM, runOnboarding } from "../services/autogcm.js";
import { supabase, getOrCreateUser } from "../services/supabase.js"; 
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const router = useRouter();
const otp = ref(["", "", "", "", "", ""]);
const isLoading = ref(false);
const errorMessage = ref("");
const statusMessage = ref(""); 

onMounted(() => {
  if (!window.confirmationResult) {
    router.push("/verify-phone");
  }
});

const moveToNext = (index, event) => {
  const value = event.target.value;
  if (value && index < 5) event.target.nextElementSibling?.focus();
};

const moveToPrev = (index, event) => {
  if (!otp.value[index] && index > 0) event.target.previousElementSibling?.focus();
};

const convertToChineseFormat = (phone) => {
  if (phone.length === 10 && phone.startsWith('0')) return '1' + phone;
  if (phone.length === 11 && phone.startsWith('0')) return '1' + phone.substring(1);
  return phone; 
};

const verifyOTP = async () => {
  const code = otp.value.join("");
  if (code.length !== 6) return;
  
  isLoading.value = true;
  errorMessage.value = "";
  statusMessage.value = t('otp.status_verifying'); 

  try {
    if (!window.confirmationResult) {
      throw new Error("Session expired. Please try again.");
    }

    // 1. Verify with Firebase
    const result = await window.confirmationResult.confirm(code);
    const firebaseUser = result.user;

    // 2. Format the Real Malaysian Number
    let rawPhone = firebaseUser.phoneNumber; 
    let finalPhone = rawPhone.replace('+60', '0');

    let response = null;
    let usedPhoneForAutoGCM = finalPhone;

    // 3. Register with AutoGCM (Backends)
    try {
        console.log("👉 Attempt 1: Fetching/Registering User:", finalPhone);
        // ✅ CRITICAL FIX: Pass 'undefined' for name/avatar.
        // This ensures the backend FETCHES existing data instead of overwriting it with "".
        response = await registerUserWithAutoGCM(null, finalPhone, undefined, undefined);
    } catch (err) {
        console.warn("⚠️ Attempt 1 Failed:", err.message);
        response = null; 
    }

    if (!response || response.code !== 200) {
      const chinesePhone = convertToChineseFormat(finalPhone);
      if (chinesePhone !== finalPhone) {
        console.log(`🔄 Attempt 2: Retrying with Chinese Format: ${chinesePhone}`);
        statusMessage.value = t('otp.status_retrying'); 
        try {
            // ✅ CRITICAL FIX: Also use undefined here for safety
            response = await registerUserWithAutoGCM(null, chinesePhone, undefined, undefined);
            usedPhoneForAutoGCM = chinesePhone;
        } catch (err2) {
            console.error("❌ Attempt 2 Failed:", err2.message);
            throw new Error("Registration System Unavailable. Please contact support.");
        }
      }
    }

    if (!response || response.code !== 200) {
      throw new Error(response ? response.msg : "Unknown Registration Error");
    }

    console.log(`✅ Success! Registered as: ${usedPhoneForAutoGCM}`);
    localStorage.setItem("autogcmUser", JSON.stringify(response.data));

    statusMessage.value = t('otp.status_binding');

    // 4. BIND GOOGLE ACCOUNT TO SUPABASE
    // Retrieve the Google Info we saved in Login.vue
    const tempGoogleUser = JSON.parse(localStorage.getItem("tempGoogleUser") || "{}");
    const nameToUse = tempGoogleUser.nickname || "New User";
    const avatarToUse = tempGoogleUser.avatar || "";
    const emailToBind = tempGoogleUser.email || null;

    // Pass emailToBind as the 4th argument
    const supabaseUser = await getOrCreateUser(finalPhone, nameToUse, avatarToUse, emailToBind);
    
    if (emailToBind) {
        console.log("🔗 Email sent to binding logic:", emailToBind);
    }
    
    // Clear temp data
    localStorage.removeItem("tempGoogleUser");

    // 5. Onboarding & Redirect Logic
    statusMessage.value = t('otp.status_finalizing'); 
    await runOnboarding(finalPhone); 

    // ✅ SMART REDIRECT LOGIC
    // Condition 1: Not a new user in machine system (isNewUser === 0)
    // Condition 2: Has a valid profile in our Supabase DB (not 'New User')
    const hasValidLocalName = supabaseUser?.nickname && supabaseUser.nickname !== 'New User' && supabaseUser.nickname !== 'User';

    if (response.data.isNewUser === 0 && hasValidLocalName) {
      // Returning user with fully set up account -> Go Home
      router.push("/home-page");
    } else {
      // New User OR Returning User with missing profile -> Go to Complete Profile
      localStorage.setItem("pendingPhoneVerified", finalPhone);
      
      // Pass the name we safely fetched from the machine API
      const legacyName = response.data?.nikeName || response.data?.name || '';
      
      router.push({ 
        path: "/complete-profile", 
        query: { legacyName: legacyName } 
      });
    }

  } catch (error) {
      console.error(error);
      errorMessage.value = error.message; 
  } finally {
      isLoading.value = false;
      statusMessage.value = "";
  }
};
</script>