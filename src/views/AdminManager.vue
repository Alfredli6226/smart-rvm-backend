<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Trash2, UserPlus, Shield } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import { useAdmins } from '../composables/useAdmins'; // Import the new composable

const auth = useAuthStore();
const { admins, loading, fetchAdmins, addAdmin, removeAdmin } = useAdmins();

// Local UI State
const showAddModal = ref(false);
const newEmail = ref('');
const newRole = ref('VIEWER');

const isPlatformOwner = computed(() => auth.role === 'SUPER_ADMIN' && !auth.merchantId);
const isViewer = computed(() => auth.role === 'VIEWER');
const isAgent = computed(() => {
  const route = window.location.pathname;
  if (route.includes('agent-dashboard')) return true;
  return auth.role?.toUpperCase() === 'AGENT';
});
const isCollector = computed(() => {
  const route = window.location.pathname;
  if (route.includes('collector-dashboard')) return true;
  return auth.role?.toUpperCase() === 'COLLECTOR';
});
const canAddAdmin = computed(() => !isViewer.value && !isAgent.value && !isCollector.value);

const handleAddAdmin = async () => {
    const res = await addAdmin(newEmail.value, newRole.value);
    if (res.success) {
        newEmail.value = '';
        showAddModal.value = false;
    } else {
        alert("Failed to add admin: " + res.message);
    }
};

const handleRemoveAdmin = async (id: string) => {
    if (!confirm('Revoke access for this admin?')) return;
    const res = await removeAdmin(id);
    if (!res.success) {
        alert("Error removing admin: " + res.message);
    }
};

onMounted(() => {
    // Wait for auth to be ready
    if (auth.loading) {
        const unwatch = auth.$subscribe((_, state) => {
            if (!state.loading) {
                fetchAdmins();
                unwatch();
            }
        });
    } else {
        fetchAdmins();
    }
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
         <h1 class="text-2xl font-bold text-gray-900 flex items-center">
           <Shield class="mr-3 text-blue-600" :size="28" />
           {{ isPlatformOwner ? 'Platform Team' : 'Admin Access' }}
         </h1>
         <p class="text-gray-500 mt-1">
           {{ isPlatformOwner 
              ? 'Manage global administrators who can access all merchants.' 
              : 'Manage who is allowed to login to this dashboard.' 
           }}
         </p>
      </div>
      <button 
        v-if="canAddAdmin"
        @click="showAddModal = !showAddModal"
        class="flex items-center space-x-2 text-sm text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg shadow-sm transition-all"
      >
        <UserPlus :size="16" />
        <span>Add Admin</span>
      </button>
    </div>

    <div v-if="showAddModal && canAddAdmin" class="bg-blue-50 p-6 rounded-xl border border-blue-100 animate-fade-in-down">
      <h3 class="text-sm font-bold text-blue-800 mb-2">Whitelist New Administrator</h3>
      <p class="text-xs text-blue-600 mb-4">
        1. Add their email here. <br>
        2. Tell them to go to the Login page and click <strong>"First Time Activation"</strong> to set their password.
      </p>
      
      <div class="flex gap-4 items-end">
        <div class="flex-1">
          <label class="block text-xs font-medium text-blue-800 mb-1">Email Address</label>
          <input v-model="newEmail" type="email" class="w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" placeholder="colleague@example.com" />
        </div>
        <div class="w-48">
          <label class="block text-xs font-medium text-blue-800 mb-1">Role</label>
          <select v-model="newRole" class="w-full px-3 py-2 border border-blue-200 rounded-md bg-white">
            <option value="VIEWER">Viewer (Read Only)</option>
            <option value="EDITOR">Editor (Can Approve)</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
        </div>
        <button @click="handleAddAdmin" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">
          Add to Whitelist
        </button>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div v-if="loading" class="p-8 text-center text-gray-400">Loading admins...</div>

      <table v-else class="w-full text-left">
        <thead class="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
          <tr>
            <th class="px-6 py-4">Admin User</th>
            <th class="px-6 py-4">Role</th>
            <th class="px-6 py-4">Added Date</th>
            <th v-if="canAddAdmin" class="px-6 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="admin in admins" :key="admin.id" class="hover:bg-gray-50">
            <td class="px-6 py-4">
              <div class="font-medium text-gray-900">{{ admin.email }}</div>
              <div v-if="!admin.merchant_id && isPlatformOwner" class="text-[10px] text-blue-600 font-bold uppercase mt-1">Global Access</div>
            </td>
            <td class="px-6 py-4">
              <span :class="`px-2 py-1 text-xs font-bold rounded-full 
                ${(admin.role as string) === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`">
                {{ (admin.role as string).replace('_', ' ') }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
              {{ new Date(admin.created_at).toLocaleDateString() }}
            </td>
            <td v-if="canAddAdmin" class="px-6 py-4 text-right">
              <button v-if="canAddAdmin" @click="handleRemoveAdmin(admin.id)" class="text-gray-400 hover:text-red-600 transition-colors">
                <Trash2 :size="16" />
              </button>
            </td>
          </tr>
          <tr v-if="admins.length === 0" class="text-center">
             <td :colspan="canAddAdmin ? 4 : 3" class="py-8 text-gray-400 text-sm">No administrators found.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>