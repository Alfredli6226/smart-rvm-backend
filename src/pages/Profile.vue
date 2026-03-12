<template>
  <div class="flex flex-col items-center min-h-screen bg-gradient-to-b from-green-50 to-white pb-24 relative">
    
    <div class="w-full bg-green-600 text-white py-10 text-center shadow-md">
      <div class="relative w-24 h-24 mx-auto">
        <img 
          :src="user.avatar || '/images/profile.png'" 
          alt="Profile" 
          class="w-full h-full rounded-full border-4 border-white object-cover shadow-lg bg-gray-200" 
          @error="handleImageError" 
        />
      </div>
      <h2 class="text-xl font-semibold mt-3">{{ user.name }}</h2>
      <p class="text-sm text-green-100">{{ user.phone || t('profile.phone_not_set') }}</p>
    </div>

    <div class="w-11/12 max-w-md bg-white rounded-2xl shadow p-6 mt-6 text-gray-700">
      <div class="flex justify-between items-center border-b pb-3 mb-3">
        <span class="font-medium">{{ t('profile.total_recycled') }}</span>
        
        <span v-if="user.totalWeight !== null" class="font-bold text-green-600">{{ user.totalWeight }} kg</span>
        <div v-else class="h-6 w-20 bg-gray-200 animate-pulse rounded"></div>

      </div>

      <div class="flex justify-between items-center">
        <span class="font-medium">{{ t('profile.lifetime_points') }}</span>
        <span>{{ user.points }}</span>
      </div>
    </div>

    <div class="w-11/12 max-w-md bg-white rounded-2xl shadow p-4 mt-4 flex items-center justify-between text-gray-700">
       <div class="flex items-center gap-3">
         <div class="bg-blue-100 p-2 rounded-full text-blue-600">
           <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
           </svg>
         </div>
         <span class="font-medium text-sm">Enable Location</span>
       </div>

       <label class="relative inline-flex items-center cursor-pointer">
         <input type="checkbox" :checked="locationEnabled" @change="toggleLocation" class="sr-only peer">
         <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
       </label>
    </div>

    <button 
      @click="openEditModal"
      class="mt-8 text-green-600 font-semibold hover:underline"
    >
      {{ t('profile.edit_profile') }}
    </button>

    <button
      @click="confirmLogout"
      class="mt-4 w-11/12 max-w-md bg-red-500 text-white py-2 rounded-full font-semibold hover:bg-red-600 transition shadow-md"
    >
      {{ t('profile.logout') }}
    </button>

    <Navbar />

    <BaseModal :isOpen="showLogoutModal" @close="showLogoutModal = false">
      <h3 class="text-lg font-bold text-gray-800 mb-2 text-center">{{ t('profile.logout_title') }}</h3>
      <p class="text-gray-500 mb-6 text-center">{{ t('profile.logout_msg') }}</p>
      <div class="flex gap-3 justify-center">
        <button @click="showLogoutModal = false" class="px-5 py-2 rounded-full bg-gray-200 text-gray-700 font-medium hover:bg-gray-300">{{ t('profile.cancel') }}</button>
        <button @click="performLogout" class="px-5 py-2 rounded-full bg-red-500 text-white font-medium hover:bg-red-600">{{ t('profile.confirm_logout') }}</button>
      </div>
    </BaseModal>

    <BaseModal :isOpen="showEditModal" @close="showEditModal = false">
      <h3 class="text-lg font-bold text-gray-800 mb-4 text-center">{{ t('profile.edit_title') }}</h3>
      
      <div class="mb-4">
        <label class="block text-sm text-gray-600 mb-1">{{ t('profile.nickname') }}</label>
        <input v-model="editForm.name" class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none transition" placeholder="Enter new nickname" />
      </div>

      <div class="mb-6">
        <label class="block text-sm text-gray-600 mb-2">{{ t('profile.select_avatar') }}</label>
        <div class="grid grid-cols-4 gap-2">
          <div 
            v-for="(av, index) in presetAvatars" 
            :key="index"
            @click="editForm.avatar = av"
            class="relative cursor-pointer rounded-full p-1 border-2 transition"
            :class="editForm.avatar === av ? 'border-green-500 ring-2 ring-green-200' : 'border-transparent hover:bg-gray-100'"
          >
            <img :src="av" class="w-10 h-10 rounded-full mx-auto bg-gray-100" />
            <div v-if="editForm.avatar === av" class="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5 w-4 h-4 flex items-center justify-center text-xs">✓</div>
          </div>
        </div>
      </div>

      <div class="flex gap-3">
        <button @click="showEditModal = false" class="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition">
          {{ t('profile.cancel') }}
        </button>
        
        <button 
          @click="saveProfile" 
          class="flex-1 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2" 
          :disabled="isSaving"
        >
          <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
          <span>{{ isSaving ? t('profile.saving') : t('profile.save') }}</span>
        </button>
      </div>
    </BaseModal>

    <BaseModal :isOpen="feedbackModal.isOpen" @close="closeFeedback">
      <div class="text-center">
        <div class="mb-3 mx-auto flex items-center justify-center w-12 h-12 rounded-full" 
             :class="feedbackModal.isError ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-500'">
           <span v-if="feedbackModal.isError" class="text-2xl font-bold">!</span>
           <span v-else class="text-2xl font-bold">✓</span>
        </div>
        <h3 class="text-lg font-bold text-gray-800 mb-2">{{ feedbackModal.title }}</h3>
        <p class="text-gray-500 mb-6">{{ feedbackModal.message }}</p>
        <button @click="closeFeedback" class="w-full py-2 rounded-lg font-medium transition text-white"
          :class="feedbackModal.isError ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'">
          {{ t('withdraw.modal_ok') }}
        </button>
      </div>
    </BaseModal>

  </div>
</template>

<script setup>
import Navbar from "../components/NavBar.vue";
import BaseModal from "../components/BaseModal.vue"; // Uses your new component
import { useProfileLogic } from "../composables/useProfileLogic.js";
import { Loader2 } from "lucide-vue-next"; // Import Spinner Icon
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const { user, showLogoutModal, showEditModal, isSaving, editForm, presetAvatars, feedbackModal, closeFeedback, handleImageError, confirmLogout, performLogout, openEditModal, saveProfile, locationEnabled, 
   toggleLocation } = useProfileLogic();
</script>