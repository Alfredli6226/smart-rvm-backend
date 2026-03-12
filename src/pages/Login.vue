<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-white px-6">
    <img src="/icons/logo.png" alt="Logo" class="w-56 h-56 mb-4" />
    
    <h2 class="text-2xl font-bold text-green-700 mb-2">{{ t('login.welcome') }}</h2>
    <p class="text-gray-500 mb-6 text-center">{{ t('login.subtitle') }}</p>

    <button 
      class="relative flex items-center justify-center bg-white rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 py-3 px-8 gap-3 group w-full max-w-[280px]"
      @click="handleGoogleLogin" 
      :disabled="isLoading"
    >
      <div v-if="isLoading" class="absolute inset-0 bg-white/80 flex items-center justify-center rounded-full z-10">
        <div class="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div class="w-5 h-5 flex-shrink-0">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="display: block;">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
          <path fill="none" d="M0 0h48v48H0z"></path>
        </svg>
      </div>
      
      <span class="text-gray-700 font-medium tracking-wide group-hover:text-gray-900 transition-colors">
        {{ t('login.google_btn') }}
      </span>
    </button>

    <p class="mt-8 text-xs text-gray-400 max-w-xs text-center leading-relaxed">{{ t('login.terms') }}</p>
    
    <p v-if="errorMessage" class="mt-4 text-sm text-red-500 font-bold bg-red-50 px-4 py-2 rounded-lg">
      {{ errorMessage }}
    </p>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import app from "../firebase/firebaseConfig"; 
import { useI18n } from "vue-i18n";

// Services
import { syncUser, runOnboarding } from "../services/autogcm.js";
import { supabase } from "../services/supabase.js"; 

const { t } = useI18n();
const router = useRouter();
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const isLoading = ref(false);
const errorMessage = ref("");

// Helper to check if a name is "generic" (User, New User, Phone Number)
const isGenericName = (name, phone) => {
  if (!name) return true;
  const lower = name.toLowerCase();
  return (
    lower === "user" || 
    lower === "new user" || 
    lower === "rvm user" ||
    lower === "null" ||
    name === phone
  );
};

const handleGoogleLogin = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    // 1. Firebase Google Sign-In
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const email = user.email;

    // 2. CHECK SUPABASE
    // Ensure get_user_by_email returns 'vendor_user_no'
    const { data: dbUser, error } = await supabase
      .rpc('get_user_by_email', { check_email: email });

    if (error) console.error("RPC Error:", error);

    if (dbUser && dbUser.phone) {
      console.log("🔹 Smart Login: Email found, logging in as", dbUser.phone);
      
      const isAlreadyOnboarded = !!dbUser.vendor_user_no;
      const currentLocalName = dbUser.nickname || "";
      
      // Determine if the *current* local name is generic
      const localNameIsGeneric = isGenericName(currentLocalName, dbUser.phone);

      // Handle Nickname Safety for Sync (Don't overwrite with "User")
      const safeName = localNameIsGeneric ? undefined : currentLocalName;

      // 1. Sync User (Fast - gets latest data from API)
      const res = await syncUser(
          dbUser.phone, 
          safeName,
          dbUser.avatar_url 
      );
      
      if (res.code === 200 && res.data) {
        const sessionData = {
            ...res.data, 
            nikeName: dbUser.nickname || res.data.nikeName || "User", 
            avatarUrl: dbUser.avatar_url || res.data.avatarUrl || ""  
        };

        localStorage.setItem("autogcmUser", JSON.stringify(sessionData));

        // ⚡️ REDIRECT DECISION LOGIC ⚡️
        
        // CASE A: User is fully onboarded AND has a valid name locally.
        // We can skip everything and go home.
        if (isAlreadyOnboarded && !localNameIsGeneric) {
            console.log("⏩ User onboarded & Verified. Going Home.");
            runOnboarding(dbUser.phone); // Background refresh
            router.push("/home-page");
            return;
        }

        // CASE B: User is new OR has a generic name.
        // We MUST run the onboarding now to get the latest data.
        console.log("⏳ Profile check needed. Syncing...");
        
        // Critical: Save phone for CompleteProfile page
        localStorage.setItem("pendingPhoneVerified", dbUser.phone); 

        // Wait for full sync
        await runOnboarding(dbUser.phone); 

        // Re-evaluate after sync: Did the API return a valid name?
        // Note: res.data is the fresh data from the API call we just made.
        const freshApiName = res.data.nikeName || res.data.name || "";
        const apiNameIsGeneric = isGenericName(freshApiName, dbUser.phone);

        // If the API name is ALSO generic, force them to set it.
        // If the API name is good (e.g. "Ariff" from old system), we can trust it (assuming onboard saved it).
        // But to be safe for "First Time" experience, if they were generic locally, 
        // we usually want them to confirm their profile unless it's a perfect match.
        
        if (apiNameIsGeneric) {
             console.log("🚨 Generic Name detected. Redirecting to Complete Profile.");
             router.push({ 
                path: "/complete-profile", 
                query: { legacyName: freshApiName } 
            });
        } else {
            // API has a good name ("Ariff"). 
            // Since we just ran onboarding, that name is now saved to DB.
            console.log("✅ Legacy Name found (" + freshApiName + "). Going Home.");
            router.push("/home-page");
        }
        return; 
      }
    }

    // 3. NEW USER (No email match)
    console.log("🔸 New or Unlinked Account: Proceeding to Phone Verification");
    
    const googleUser = {
      nickname: user.displayName || "User",
      avatar: user.photoURL || "",
      email: user.email 
    };
    localStorage.setItem("tempGoogleUser", JSON.stringify(googleUser));

    router.push("/verify-phone");

  } catch (error) {
    console.error("❌ Login Error:", error);
    if (error.code !== "PGRST116") { 
        errorMessage.value = "Login failed: " + error.message;
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
/* No custom CSS needed anymore - everything is handled by Tailwind */
</style>