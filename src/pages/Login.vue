<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-white px-6">
    <img src="/icons/logo.png" alt="Logo" class="w-56 h-56 mb-4" />
    <h2 class="text-2xl font-bold text-green-700 mb-2">Welcome Back</h2>
    <p class="text-gray-500 mb-6 text-center">Login to continue recycling smarter.</p>

    <button class="gsi-material-button" @click="handleGoogleLogin" :disabled="isLoading">
      <div class="gsi-material-button-content-wrapper">
        <div class="gsi-material-button-icon">
          <svg v-if="isLoading" class="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <img v-else src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="w-5 h-5" />
        </div>
        <span class="gsi-material-button-contents">
          {{ isLoading ? 'Signing in...' : 'Sign in with Google' }}
        </span>
      </div>
    </button>

    <p class="mt-6 text-sm text-gray-500">By signing in, you agree to our Terms and Privacy Policy.</p>
    <p v-if="errorMessage" class="mt-4 text-sm text-red-500 font-bold">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import app from "../firebase/firebaseConfig"; 

// Services
import { syncUser, runOnboarding } from "../services/autogcm.js";
import { supabase, getOrCreateUser } from "../services/supabase.js"; // ✅ Import supabase client

const router = useRouter();
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const isLoading = ref(false);
const errorMessage = ref("");

const handleGoogleLogin = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    // 1. Firebase Google Sign-In
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const email = user.email;

    // 2. CHECK SUPABASE (SECURE RPC): Is this email already linked?
    // We use .rpc() because RLS prevents direct table access for anon users
    const { data: dbUser, error } = await supabase
      .rpc('get_user_by_email', { check_email: email });

    if (error) {
        console.error("RPC Error:", error);
        // Don't throw here, let it fall through to "New User" logic if strictly needed, 
        // but usually RPC errors are critical.
    }

    if (dbUser && dbUser.phone) {
      // USER FOUND: SMART LOGIN (SKIP OTP)
      console.log("🔹 Smart Login: Email found, logging in as", dbUser.phone);
      
      // Sync with RVM System (AutoGCM) to get session token
      const res = await syncUser(
          dbUser.phone, 
          dbUser.nickname || "",  // Pass existing nickname
          dbUser.avatar_url || "" // Pass existing avatar
      );
      
      if (res.code === 200 && res.data) {
        // Save Session
        //localStorage.setItem("autogcmUser", JSON.stringify(res.data));
        
      const sessionData = {
            ...res.data, // Keep token/id from API
            nikeName: dbUser.nickname || res.data.nikeName || "User", // Trust DB first
            avatarUrl: dbUser.avatar_url || res.data.avatarUrl || ""  // Trust DB first
        };

        localStorage.setItem("autogcmUser", JSON.stringify(sessionData));
        
        // Ensure Supabase stats are synced
        await runOnboarding(dbUser.phone);

        router.push("/home-page");
        return; // Stop here
      }
    }

    // 3. NEW USER / NOT LINKED: Proceed to OTP Flow
    console.log("🔸 New or Unlinked Account: Proceeding to Phone Verification");
    
    const googleUser = {
      nickname: user.displayName || "User",
      avatar: user.photoURL || "",
      email: user.email // Store email to bind it later
    };
    localStorage.setItem("tempGoogleUser", JSON.stringify(googleUser));

    // Check if we have a legacy phone stored locally, otherwise ask for input
    const existingUser = JSON.parse(localStorage.getItem("autogcmUser") || "{}");
    if (existingUser.phone) {
       router.push("/verify-phone"); // Or auto-send OTP if you prefer
    } else {
       router.push("/verify-phone");
    }

  } catch (error) {
    console.error("❌ Login Error:", error);
    // Ignore "PGRST116" error (JSON object requested, multiple (or no) rows returned) - means user not found
    if (error.code !== "PGRST116") { 
        errorMessage.value = "Login failed: " + error.message;
    } else {
        // If not found, just proceed (this block might not be reached depending on Supabase version, usually .single() returns error if empty)
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.gsi-material-button {
  background-color: white;
  border: 1px solid #747775;
  border-radius: 4px;
  box-sizing: border-box;
  color: #1f1f1f;
  cursor: pointer;
  font-family: 'Roboto', arial, sans-serif;
  font-size: 14px;
  height: 40px;
  padding: 0 12px;
  transition: background-color .218s, border-color .218s;
  user-select: none;
  min-width: 200px;
}

.gsi-material-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.gsi-material-button-content-wrapper {
  align-items: center;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  height: 100%;
}

.gsi-material-button-icon {
  height: 20px;
  margin-right: 12px;
  min-width: 20px;
  width: 20px;
}

.gsi-material-button-contents {
  flex-grow: 1;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>