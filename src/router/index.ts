import { createRouter, createWebHistory } from 'vue-router';
import { supabase } from '../services/supabase'; 

// 1. IMPORT LAYOUT
import Layout from '../components/Layout.vue'; 

// Import Views
import Dashboard from '../views/Dashboard.vue';
import Withdrawals from '../views/Withdrawal.vue';
import Users from '../views/Users.vue';
import UserDetail from '../views/UserDetail.vue';
import MachineStatus from '../views/MachineStatus.vue';
import Login from '../views/Login.vue';
import AdminManager from '../views/AdminManager.vue';
import IssueReports from '../views/IssueReports.vue';
import MerchantSettings from '../views/MerchantSettings.vue';
import BigDataPlatform from '../views/BigDataPlatform.vue';
import ReportsView from '../views/ReportsView.vue';
import CustomerServiceInbox from '../views/CustomerServiceInbox.vue';
import CustomerThreadDetail from '../views/CustomerThreadDetail.vue';
import LeadsManager from '../views/LeadsManager.vue';

const MerchantsManager = () => import('../views/SuperAdmin/Merchants.vue');
const ManageClientSettings = () => import('../views/SuperAdmin/ManageClientSettings.vue');

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // --------------------------------------------------------
    // 1. PUBLIC ROUTES (No Sidebar/Tabs)
    // --------------------------------------------------------
    { 
      path: '/login', 
      name: 'login', 
      component: Login,
      meta: { hideSidebar: true, requiresAuth: false, title: 'Login' } 
    },
    {
      path: '/contact',
      name: 'Contact',
      component: () => import('../views/IntakePage.vue'),
      meta: { hideSidebar: true, requiresAuth: false, title: 'Contact Us' }
    },
    {
      path: '/big-data',
      name: 'BigDataPlatform',
      component: BigDataPlatform,
      meta: { requiresAuth: true, title: 'Big Data Platform' }
    },
    {
      path: '/admin/docs',
      name: 'AdminDocs',
      component: () => import('../views/AdminDocs.vue'),
      meta: { requiresAuth: true, title: 'Operations Manual' }
    },

    // --------------------------------------------------------
    // 2. PROTECTED ROUTES (Wrapped in Layout)
    // --------------------------------------------------------
    {
      path: '/',
      component: Layout, // 👈 THIS IS KEY: Loads Layout (Sidebar+Tabs) first
      meta: { requiresAuth: true },
      // All these pages will render INSIDE Layout's <router-view>
      children: [
        {
          path: '', // Empty path means this is the default for '/'
          name: 'dashboard',
          component: Dashboard,
          meta: { title: 'Dashboard' } 
        },
        {
          path: 'agent-dashboard',
          name: 'agent-dashboard',
          component: Dashboard,
          meta: { title: 'Agent Dashboard', forceAgentView: true } 
        },
        {
          path: 'collector-dashboard',
          name: 'collector-dashboard',
          component: Dashboard,
          meta: { title: 'Collector Dashboard', forceCollectorView: true } 
        },
        {
          path: 'submissions', // Note: No leading slash
          name: 'submissions',
          component: () => import('../views/Submissions.vue'),
          meta: { title: 'Submissions' } 
        },
        {
          path: 'withdrawals',
          name: 'withdrawals',
          component: Withdrawals,
          meta: { title: 'Withdrawals' } 
        },
        {
          path: 'users',
          name: 'users',
          component: Users,
          meta: { title: 'User Management' } 
        },
        {
          path: 'users/:id',
          name: 'userDetail',
          component: UserDetail,
          meta: { title: 'User Profile' } 
        },
        {
          path: 'machines',
          name: 'machines',
          component: MachineStatus,
          meta: { title: 'Machine Status' } 
        },
        { 
          path: 'admins', 
          name: 'admins',
          component: AdminManager,
          meta: { title: 'Admin Access' } 
        },
        {
          path: 'cleaning-logs',
          name: 'CleaningLogs',
          component: () => import('../views/CleaningLogs.vue'),
          meta: { title: 'Waste Logs' } 
        },
        {
          path: 'settings',
          name: 'Settings',
          component: MerchantSettings,
          meta: { title: 'Settings' } 
        },
        // Platform Routes
        {
          path: 'platform/advertising',
          name: 'DigitalAdvertising',
          component: () => import('../views/DigitalAdvertising.vue'),
          meta: { requiresSuperAdmin: true, title: 'Digital Advertising' } 
        },

        // Super Admin Routes
        {
          path: 'super-admin/merchants',
          name: 'SuperAdminMerchants',
          component: MerchantsManager,
          meta: { requiresSuperAdmin: true, title: 'Manage Clients' } 
        },
        {
          path: 'super-admin/config',
          name: 'SuperAdminConfig',
          component: ManageClientSettings,
          meta: { requiresSuperAdmin: true, title: 'Platform Config' } 
        },
        {
          path: 'super-admin/issues',
          name: 'IssueReports',
          component: IssueReports,
          meta: { requiresSuperAdmin: true, title: 'Issue Reports' } 
        },
        {
          path: 'notifications',
          name: 'Notifications',
          component: () => import('../views/Notifications.vue'),
          meta: { title: 'Notifications' } 
        },
        {
          path: 'customer-service',
          name: 'CustomerServiceInbox',
          component: CustomerServiceInbox,
          meta: { title: 'Customer Service Inbox' }
        },
        {
          path: 'customer-service/:id',
          name: 'CustomerThreadDetail',
          component: CustomerThreadDetail,
          meta: { title: 'Customer Thread Detail' }
        },
        {
          path: 'leads',
          name: 'LeadsManager',
          component: LeadsManager,
          meta: { title: 'Leads Manager' }
        },
        {
          path: 'reports',
          name: 'Reports',
          component: ReportsView,
          meta: { title: 'Reports' } 
        },
      ]
    }
  ]
});

// ------------------------------------------------------------------
//  THE GATEKEEPER (Navigation Guard)
// ------------------------------------------------------------------
router.beforeEach(async (to, _from, next) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  // Check matched routes (checks parents too)
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const requiresSuperAdmin = to.matched.some(record => record.meta.requiresSuperAdmin);

  if (requiresAuth && !session) {
    next({ name: 'login' });
    return;
  }

  if (session) {
    // Check Admin Role
    const { data: admin } = await supabase
      .from('app_admins')
      .select('role')
      .eq('email', session.user.email!)
      .maybeSingle();

    if (!admin) {
      await supabase.auth.signOut();
      next({ name: 'login' });
      return;
    }

    if (!admin) {
      await supabase.auth.signOut();
      next({ name: 'login' });
      return;
    }

    if (requiresSuperAdmin && admin?.role?.toUpperCase() !== 'SUPER_ADMIN') {
      console.log('Access denied: User role is', admin?.role);
      alert("⛔ Access Denied: Super Admin Only");
      next({ name: 'dashboard' }); 
      return;
    }
  }

  next();
});

export default router;