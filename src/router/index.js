import { createRouter, createWebHistory } from "vue-router";
import Welcome from "../pages/Welcome.vue";
import Login from "../pages/Login.vue"; 
import PhoneVerification from "../pages/PhoneVerification.vue";
import OTPVerification from "../pages/OTPVerification.vue";
import CompleteProfile from "../pages/CompleteProfile.vue";
import RegistrationComplete from "../pages/RegistrationComplete.vue"; 
import Homepage from "../pages/HomePage.vue";
import Profile from "../pages/Profile.vue";
import UserDashboard from "../pages/UserDashboard.vue";
import WithdrawPage from "../pages/WithdrawPage.vue";
import MachineDetailsPage from '../pages/MachineDetailsPage.vue';

const routes = [
  { 
    path: "/", 
    component: Welcome,
    meta: { title: 'Welcome' } 
  },
  { 
    path: "/login", 
    component: Login,
    meta: { title: 'Login' } 
  },
  { 
    path: "/verify-phone", 
    component: PhoneVerification,
    meta: { title: 'Verify Phone' } 
  },
  { 
    path: "/complete-profile", 
    component: CompleteProfile,
    meta: { title: 'Complete Profile' } 
  },
  { 
    path: "/enter-otp", 
    component: OTPVerification,
    meta: { title: 'Enter OTP' } 
  },
  { 
    path: "/register-success", 
    component: RegistrationComplete,
    meta: { title: 'Registration Complete' } 
  },
  { 
    path: '/registration-complete', 
    component: RegistrationComplete,
    meta: { title: 'Registration Complete' } 
  }, 
  { 
    path: "/home-page", 
    component: Homepage,
    meta: { title: 'Home' } 
  },
  { 
    path: "/profile", 
    component: Profile,
    meta: { title: 'My Profile' } 
  },
  { 
    path: "/dashboard", 
    component: UserDashboard,
    meta: { title: 'Dashboard' } 
  },
  { 
    path: "/withdraw", 
    component: WithdrawPage,
    meta: { title: 'Withdraw Funds' } 
  },
  { path: '/machine/:deviceNo', 
    component: MachineDetailsPage, 
    meta: { title: 'Machine Details' } 
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 🚀 DYNAMIC TITLE LOGIC
router.beforeEach((to, from, next) => {
  const defaultTitle = "Smart RVM"; // The base name of your app
  
  // If the route has a title, format it as "Page Name | Smart RVM"
  // Otherwise, just use "Smart RVM"
  document.title = to.meta.title ? `${to.meta.title} | ${defaultTitle}` : defaultTitle;
  
  next();
});

export default router;