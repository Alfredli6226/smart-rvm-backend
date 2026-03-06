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
import { getOrCreateUser } from "../services/supabase.js"; 
import { useI18n } from "vue-i18n";
import axios from "axios";

const { t } = useI18n();
const router = useRouter();
const otp = ref(["", "", "", "", "", ""]);
const isLoading = ref(false);
const errorMessage = ref("");
const statusMessage = ref(""); 

onMounted(() => {
  // Check if we have a phone number pending (Stored in PhoneVerification.vue)
  if (!localStorage.getItem("pendingPhone")) {
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

// 🇨🇳 UPDATED: Converts Malaysian numbers to VALID Chinese formats (13x, 18x, etc.)
const convertToChineseFormat = (phone) => {
  // Case 1: Standard Malaysia 10 digits (e.g., 0167403654)
  // Logic: Remove '0' (leaving 9 digits), add '13' (total 11 digits)
  // Result: 13167403654 (Valid Chinese Mobile Format)
  if (phone.length === 10 && phone.startsWith('0')) {
    return '13' + phone.substring(1);
  }

  // Case 2: Standard Malaysia 11 digits (e.g., 01112345678)
  // Logic: Replace '011' with '131' (Valid China Unicom Prefix)
  // Result: 13112345678 (Valid Chinese Mobile Format)
  if (phone.length === 11 && phone.startsWith('011')) {
    return '131' + phone.substring(3);
  }

  // Fallback: If it's another 11-digit number starting with 0
  // Replace '0' with '1' (Result starts with 1, 11 digits total)
  // Note: 10... might fail, so we try to ensure it starts with 13/15/18 if possible
  if (phone.length === 11 && phone.startsWith('0')) {
    return '13' + phone.substring(2); // Forces it into a 13x format
  }

  return phone; 
};

const verifyOTP = async () => {
  const code = otp.value.join("");
  if (code.length !== 6) return;
  
  isLoading.value = true;
  errorMessage.value = "";
  statusMessage.value = t('otp.status_verifying'); 

  try {
    const waapiPhone = localStorage.getItem("pendingPhone"); // Format: 60123456789

    // 1. Verify with YOUR Backend (WaAPI logic)
    // ----------------------------------------------------------------
    try {
        const verifyRes = await axios.post('/api/auth-otp', {
            action: 'verify',
            phone: waapiPhone,
            code: code
        });
        
        if (!verifyRes.data.success) {
            throw new Error(verifyRes.data.msg || "Invalid OTP");
        }
    } catch (apiErr) {
        throw new Error(apiErr.response?.data?.msg || "OTP Verification Failed");
    }

    // 2. Prepare Phone Number for AutoGCM
    // ----------------------------------------------------------------
    // waapiPhone is '60123456789'. We need '0123456789' for the standard check.
    let standardPhone = waapiPhone;
    if (waapiPhone.startsWith('60')) {
        standardPhone = '0' + waapiPhone.substring(2);
    }
    
    let response = null;
    let finalUsedPhone = standardPhone; // This is what we will save to Supabase

    // 3. Register/Sync with AutoGCM (Backends)
    // ----------------------------------------------------------------
    try {
        console.log("👉 Attempt 1: Fetching/Registering User (Standard):", standardPhone);
        
        // Pass 'undefined' for name/avatar to FETCH existing data without overwriting
        response = await registerUserWithAutoGCM(null, standardPhone, undefined, undefined);
    
    } catch (err) {
        console.warn("⚠️ Attempt 1 Failed (Standard Format):", err.message);
        response = null; 
    }

    // If Standard failed (likely because user is NEW and needs Chinese format)
    if (!response || response.code !== 200) {
      const chinesePhone = convertToChineseFormat(standardPhone);
      
      // Only retry if the conversion actually changed the number
      if (chinesePhone !== standardPhone) {
        console.log(`🔄 Attempt 2: Retrying with Chinese Format: ${chinesePhone}`);
        statusMessage.value = t('otp.status_retrying'); 
        
        try {
            response = await registerUserWithAutoGCM(null, chinesePhone, undefined, undefined);
            
            // ✅ CRITICAL: Update the phone we use for Supabase to match the Chinese one
            finalUsedPhone = chinesePhone; 

        } catch (err2) {
            console.error("❌ Attempt 2 Failed:", err2.message);
            throw new Error("Registration System Unavailable. Please contact support.");
        }
      }
    }

    if (!response || response.code !== 200) {
      throw new Error(response ? response.msg : "Unknown Registration Error");
    }

    console.log(`✅ Success! Registered/Synced as: ${finalUsedPhone}`);
    localStorage.setItem("autogcmUser", JSON.stringify(response.data));

    statusMessage.value = t('otp.status_binding');

    // 4. BIND TO SUPABASE
    // ----------------------------------------------------------------
    // Retrieve the Google Info (if they started with Google Login)
    const tempGoogleUser = JSON.parse(localStorage.getItem("tempGoogleUser") || "{}");
    const nameToUse = tempGoogleUser.nickname || "New User";
    const avatarToUse = tempGoogleUser.avatar || "";
    const emailToBind = tempGoogleUser.email || null;

    // ✅ CRITICAL: We pass 'finalUsedPhone' here. 
    // If Attempt 1 worked, it's '012...'. If Attempt 2 worked, it's '1012...'
    const supabaseUser = await getOrCreateUser(finalUsedPhone, nameToUse, avatarToUse, emailToBind);
    
    // Clear temp data
    localStorage.removeItem("tempGoogleUser");
    localStorage.removeItem("pendingPhone"); // Clear OTP phone

    // 5. Onboarding & Redirect Logic
    // ----------------------------------------------------------------
    statusMessage.value = t('otp.status_finalizing'); 
    await runOnboarding(finalUsedPhone); 

    // CHECK LOCAL NAME STATUS (Supabase)
    const localName = supabaseUser?.nickname || "";
    const isLocalGeneric = 
        !localName || 
        localName === 'New User' || 
        localName === 'User' || 
        localName === 'RVM User' ||
        localName === finalUsedPhone;

    // CHECK VENDOR NAME STATUS (Machine API)
    const vendorName = response.data?.nikeName || "";
    const isVendorGeneric = 
        !vendorName || 
        vendorName === "User" || 
        vendorName === "RVM User";

    // DECISION LOGIC
    if (response.data.isNewUser === 0 && !isLocalGeneric && !isVendorGeneric) {
      router.push("/home-page");
    } else {
      // Profile is incomplete -> Go to Complete Profile
      localStorage.setItem("pendingPhoneVerified", finalUsedPhone);
      
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