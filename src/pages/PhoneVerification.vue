<template>
  <div class="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-6">
    <div class="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md text-center">
      
      <h2 class="text-2xl font-semibold text-gray-800 mb-2">{{ t('phone.title') }}</h2>
      <p class="text-sm text-gray-500 mb-6">{{ t('phone.subtitle') }}</p>

      <div>
        <label class="block text-sm text-gray-600 mb-1">{{ t('phone.label') }}</label>
        <div class="flex items-center border rounded-lg overflow-hidden">
          <span class="bg-gray-100 px-3 text-gray-700 text-sm">+60</span>
          <input v-model="phone" type="tel" placeholder="12 345 6789"
                 class="flex-1 p-2 outline-none" />
        </div>
      </div>

      <button @click="sendOTP" :disabled="isLoading"
        class="w-full mt-6 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition flex justify-center items-center gap-2">
        <svg v-if="isLoading" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>{{ isLoading ? "Sending..." : t('phone.button_send') }}</span>
      </button>

      <p v-if="errorMessage" class="mt-4 text-sm text-red-500">{{ errorMessage }}</p>

    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import axios from "axios"; 

const { t } = useI18n();
const router = useRouter();
const phone = ref("");
const isLoading = ref(false);
const errorMessage = ref("");

const sendOTP = async () => {
  if (!phone.value) {
    errorMessage.value = "Please enter a phone number";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    // 1. Format for WaAPI (Must start with 60 for Malaysia)
    // Remove non-digits
    const cleanPhone = phone.value.replace(/\D/g, ''); 
    
    // Ensure it starts with 60. 
    // If user typed '012...', cleanPhone is '012...'. We remove leading '0' and add '60'.
    // If user typed '12...', cleanPhone is '12...'. We add '60'.
    let fullPhone = "";
    if (cleanPhone.startsWith('0')) {
        fullPhone = '60' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('60')) {
        fullPhone = cleanPhone;
    } else {
        fullPhone = '60' + cleanPhone;
    }

    console.log("📤 Sending OTP to:", fullPhone);

    // 2. Call Your Backend API
    await axios.post('/api/auth-otp', {
      action: 'send',
      phone: fullPhone
    });

    // 3. Save the WaAPI format phone number to local storage for verification step
    localStorage.setItem("pendingPhone", fullPhone);

    console.log("✅ OTP sent");
    router.push("/enter-otp");

  } catch (err) {
    console.error("❌ OTP error:", err);
    errorMessage.value = err.response?.data?.msg || err.message || "Failed to send OTP";
  } finally {
    isLoading.value = false;
  }
};
</script>