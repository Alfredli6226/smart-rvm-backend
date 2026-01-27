<template>
  <div class="flex flex-col min-h-screen bg-gradient-to-b from-green-50 to-white pb-24">
    <UserGreeting :user="user" />
    <section class="px-6 mt-20"></section>

    <section class="relative w-full max-w-md mx-auto mt-4">
      <Swiper
        :modules="[Autoplay, Pagination]"
        :autoplay="{ delay: 2500, disableOnInteraction: false }"
        :pagination="{ clickable: true }"
        loop
        class="rounded-2xl overflow-hidden shadow-lg"
      >
        <SwiperSlide v-for="(img, i) in sliderImages" :key="i" class="h-44 md:h-56 w-full">
          <img :src="img" alt="Banner" class="w-full h-full object-cover" />
        </SwiperSlide>
      </Swiper>
    </section>

    <section class="flex justify-center mt-6">
      <div 
        class="bg-white shadow rounded-2xl p-4 w-11/12 max-w-md text-gray-700 grid grid-cols-2 gap-4 text-center items-stretch"
      >
        <div 
          @click="$router.push('/dashboard')"
          class="flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform hover:bg-gray-50 rounded-xl py-4 h-full"
        >
          <div class="flex flex-col items-center">
            <p v-if="user.totalWeight !== null" class="font-bold text-xl text-green-700">
              {{ user.totalWeight }}kg
            </p>
            <div v-else class="h-7 w-20 bg-gray-200 animate-pulse rounded mb-1"></div>
            
            <p class="text-xs text-gray-500 mt-1 uppercase tracking-wide">{{ t('home.total_weight') }}</p>
        </div>
        </div>
        
        <div 
           @click="$router.push('/withdraw')"
           class="flex flex-col items-center justify-between cursor-pointer active:scale-95 transition-transform hover:bg-gray-50 rounded-xl py-4 h-full"
        >
           <div class="flex flex-col items-center mb-1">
             <p class="font-bold text-xl text-green-700">{{ user.balance }} pts</p>
             <p class="text-xs text-gray-500 mt-1 uppercase tracking-wide">{{ t('home.balance') }}</p>
           </div>

           <div class="mt-2 bg-amber-50 text-amber-600 text-[10px] px-3 py-1 rounded-full border border-amber-100 flex items-center shadow-sm">
              <span :class="{'animate-pulse': user.pendingEarnings > 0}" class="mr-1 text-xs">●</span> 
              +{{ user.pendingEarnings || 0 }} {{ t('home.pending') }}
           </div>
        </div>
      </div>
    </section>

    <section class="px-4 mt-6">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center space-x-2">
          <Recycle class="w-5 h-5 text-green-600" />
          <h3 class="text-lg font-semibold text-green-700">{{ t('home.nearby') }}</h3>
          <span v-if="!isLoading" class="text-sm text-gray-500">({{ rvmList.length }})</span>
        </div>
      </div>

      <div class="flex overflow-x-auto space-x-4 pb-3 scrollbar-hide">
        
        <template v-if="isLoading">
           <RVMCardSkeleton v-for="n in 3" :key="n" />
        </template>

        <template v-else>
          <RVMCard
            v-for="rvm in rvmList"
            :key="rvm.deviceNo"
            :deviceNo="rvm.deviceNo"
            :status="rvm.status"
            :distance="rvm.distance"
            :address="rvm.address"
            :compartments="rvm.compartments"
            :latitude="rvm.latitude"  
            :longitude="rvm.longitude"
            @click="goToMachineDetails(rvm.deviceNo)"
          />
        </template>

      </div>
    </section>

    <Navbar />
  </div>
</template>

<script setup>
import Navbar from "../components/NavBar.vue";
import RVMCard from "../components/RVMCard.vue";
import RVMCardSkeleton from "../components/RVMCardSkeleton.vue"; 
import UserGreeting from "../components/UserGreeting.vue";
import { Recycle } from "lucide-vue-next";
import { Swiper, SwiperSlide } from "swiper/vue";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import { useHomeLogic } from "../composables/useHomeLogic.js";

const { t } = useI18n();
const { user, rvmList, sliderImages, isLoading } = useHomeLogic();

const router = useRouter();
const goToMachineDetails = (deviceNo) => {
  router.push(`/machine/${deviceNo}`);
};
</script>