<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { useUserProfile } from '../composables/useUserProfile'; 
import { supabase } from '../services/supabase';
import { RefreshCw, ArrowLeft, CreditCard, Hash, Mail, AlertTriangle, Ban, CheckCircle, Wallet, Scale, Edit2 } from 'lucide-vue-next';

const route = useRoute();
const activeTab = ref<'earned' | 'spent'>('earned');

// Initialize logic with current route ID
const userId = route.params.id as string;
// 🔥 CHANGED: Destructure 'recyclingHistory' instead of 'disposalHistory'
const { user, recyclingHistory, withdrawalHistory, loading, isSyncing, syncData, auditResult } = useUserProfile(userId);

// Watch for route changes
watch(() => route.params.id, (newId) => {
    if(newId) location.reload(); 
});

// Helper to handle broken images without TS errors
const handleImageError = (e: Event) => {
    const target = e.target as HTMLImageElement;
    target.src = 'https://placehold.co/100x100?text=No+Img';
};

const isUpdatingStatus = ref(false);
const showStatusModal = ref(false);
const newStatus = ref<'ACTIVE' | 'WARNED' | 'BLOCKED'>('ACTIVE');

const showAdjustModal = ref(false);
const adjustAmount = ref<number | null>(null);
const adjustNote = ref('');
const adjustType = ref<'points' | 'weight'>('points');
const isSubmittingAdjust = ref(false);

const showEditProfile = ref(false);
const editProfile = ref({ nickname: '', phone: '', email: '', card_no: '', vendor_internal_id: '' });
const isSubmittingProfile = ref(false);

const getStatusBadge = (status?: string) => {
    switch (status) {
        case 'ACTIVE': return { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle };
        case 'WARNED': return { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: AlertTriangle };
        case 'BLOCKED': return { color: 'bg-red-100 text-red-700 border-red-200', icon: Ban };
        default: return { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: CheckCircle };
    }
};

const openStatusModal = (status: 'ACTIVE' | 'WARNED' | 'BLOCKED') => { newStatus.value = status; showStatusModal.value = true; };
const updateUserStatus = async () => {
    if (!user.value || isUpdatingStatus.value) return;
    isUpdatingStatus.value = true;
    try {
        const { error } = await supabase.from('users').update({ status: newStatus.value, updated_at: new Date().toISOString() }).eq('id', user.value.id);
        if (error) throw error;
        if (user.value) user.value.status = newStatus.value;
        showStatusModal.value = false;
    } catch (err: any) { console.error('Status update error:', err); } 
    finally { isUpdatingStatus.value = false; }
};

const openAdjustModal = (type: 'points' | 'weight') => { adjustType.value = type; adjustAmount.value = null; adjustNote.value = ''; showAdjustModal.value = true; };
const handleAdjust = async () => {
    if (!user.value || !adjustAmount.value || isSubmittingAdjust.value) return;
    isSubmittingAdjust.value = true;
    try {
        if (adjustType.value === 'points') {
            const newPoints = (user.value.lifetime_integral || 0) + adjustAmount.value;
            await supabase.from('users').update({ lifetime_integral: newPoints, updated_at: new Date().toISOString() }).eq('id', user.value.id);
            user.value.lifetime_integral = newPoints;
        } else {
            const newWeight = (user.value.total_weight || 0) + adjustAmount.value;
            await supabase.from('users').update({ total_weight: newWeight, updated_at: new Date().toISOString() }).eq('id', user.value.id);
            user.value.total_weight = newWeight;
        }
        showAdjustModal.value = false;
    } catch (err: any) { console.error('Adjust error:', err); }
    finally { isSubmittingAdjust.value = false; }
};

const openEditProfile = () => {
    if (user.value) {
        editProfile.value = { nickname: user.value.nickname || '', phone: user.value.phone || '', email: user.value.email || '', card_no: user.value.card_no || '', vendor_internal_id: user.value.vendor_internal_id || '' };
        showEditProfile.value = true;
    }
};
const handleProfileSave = async () => {
    if (!user.value || isSubmittingProfile.value) return;
    isSubmittingProfile.value = true;
    try {
        const { error } = await supabase.from('users').update({ ...editProfile.value, updated_at: new Date().toISOString() }).eq('id', user.value.id);
        if (error) throw error;
        Object.assign(user.value, editProfile.value);
        showEditProfile.value = false;
    } catch (err: any) { console.error('Profile update error:', err); }
    finally { isSubmittingProfile.value = false; }
};
</script>

<template>
  <div v-if="loading || !user" class="p-10 text-center text-gray-500">Loading profile...</div>

  <div v-else class="space-y-6">
    <RouterLink to="/users" class="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors">
        <ArrowLeft :size="16" class="mr-1" /> Back to Users
    </RouterLink>
    
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          
          <div class="flex items-center space-x-4">
              <div class="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 overflow-hidden">
                  <div class="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    <img 
                        :src="user.avatar_url && user.avatar_url.startsWith('http') ? user.avatar_url : 'https://placehold.co/100x100?text=User'" 
                        class="h-full w-full object-cover"
                        @error="handleImageError"
                    />
                </div>
              </div>
              <div>
                  <div class="flex items-center gap-2">
                    <h1 class="text-2xl font-bold text-gray-900">{{ user.nickname || 'Unknown User' }}</h1>
                    <button @click="openEditProfile" class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Edit Profile">
                        <Edit2 :size="16" />
                    </button>
                  </div>
                  <div class="flex items-center gap-2 mt-1">
                    <span :class="`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(user.status).color}`">
                        <component :is="getStatusBadge(user.status).icon" :size="12" class="mr-1" />
                        {{ user.status || 'ACTIVE' }}
                    </span>
                    <button v-if="user.status !== 'WARNED'" @click="openStatusModal('WARNED')" class="text-xs text-yellow-600 hover:text-yellow-700 hover:underline">Warn</button>
                    <button v-if="user.status !== 'BLOCKED'" @click="openStatusModal('BLOCKED')" class="text-xs text-red-600 hover:text-red-700 hover:underline">Block</button>
                    <button v-if="user.status && user.status !== 'ACTIVE'" @click="openStatusModal('ACTIVE')" class="text-xs text-green-600 hover:text-green-700 hover:underline">Activate</button>
                  </div>
                  <div class="flex items-center text-gray-500 text-sm mt-1">
                      <span class="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs mr-2">{{ user.phone }}</span>
                      <span v-if="user.vendor_user_no" class="text-xs">Ext ID: {{ user.vendor_user_no }}</span>
                  </div>
                  <div v-if="user.email" class="flex items-center text-gray-400 text-sm mt-1">
                      <Mail :size="12" class="mr-1.5" /> {{ user.email }}
                  </div>
              </div>
          </div>

          <div class="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
              <div class="text-right group cursor-pointer" @click="openAdjustModal('weight')">
                  <div class="text-xs text-gray-500 uppercase tracking-wide font-semibold">Recycled</div>
                  <div class="text-xl font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{{ user.total_weight || 0 }} kg <Scale :size="14" class="inline opacity-0 group-hover:opacity-50 ml-1" /></div>
              </div>
              <div class="text-right border-l pl-6 border-gray-100">
                  <div class="text-xs text-gray-500 uppercase tracking-wide font-semibold">Verified Balance</div>
                  <div class="text-3xl font-bold text-blue-600 group-hover:text-blue-700 transition-colors">{{ auditResult.currentBalance }}</div>
              </div>
              
              <div class="flex flex-col items-end">
                <button 
                    @click="syncData" 
                    :disabled="isSyncing" 
                    class="flex items-center justify-center h-10 px-4 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition-all active:scale-95 shadow-sm"
                    title="Pull latest machine records"
                >
                    <RefreshCw :size="16" :class="{'animate-spin': isSyncing, 'mr-2': true}" />
                    {{ isSyncing ? 'Harvesting...' : 'Sync Data' }}
                </button>
                <div class="text-[10px] text-gray-400 mt-1.5 text-right max-w-[150px] leading-tight">
                Pulls latest records from machine API.
                </div>
            </div>
          </div>
      </div>

      <div class="mt-6 pt-4 border-t border-gray-50 flex gap-6 text-xs text-gray-400">
          <div class="flex items-center">
             <CreditCard :size="12" class="mr-1.5" /> Card: {{ user.card_no || '-' }}
          </div>
          <div class="flex items-center">
             <Hash :size="12" class="mr-1.5" /> Int ID: {{ user.vendor_internal_id || '-' }}
          </div>
          <div class="ml-auto">
             Last Synced: {{ user.last_synced_at ? new Date(user.last_synced_at).toLocaleString() : 'Never' }}
          </div>
      </div>
    </div>

    <div v-if="!loading" class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div class="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
           <div class="flex items-center">
              <span class="mr-2 text-xl">⚖️</span> 
              <div>
                  <h3 class="text-sm font-bold text-slate-700 uppercase">Merchant Ledger</h3>
                  <div class="text-[10px] text-gray-500">Your Local Transaction History</div>
              </div>
           </div>
        </div>

        <div class="grid grid-cols-3 divide-x divide-gray-100 text-center p-4">
            <div>
                <div class="text-xs text-gray-400 uppercase tracking-wider font-semibold">Verified Earnings</div>
                <div class="text-lg font-bold text-gray-700">{{ auditResult.totalEarned }}</div>
            </div>
            <div>
                 <div class="text-xs text-gray-400 uppercase tracking-wider font-semibold">Withdrawn</div>
                 <div class="text-lg font-bold text-red-600">-{{ auditResult.totalWithdrawn }}</div>
            </div>
            <div>
                 <div class="text-xs text-gray-400 uppercase tracking-wider font-semibold">Net Payable</div>
                 <div class="text-2xl font-bold text-blue-600">{{ auditResult.currentBalance }}</div>
            </div>
        </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        
      <div class="border-b border-gray-100 flex">
          <button @click="activeTab = 'earned'" :class="`flex-1 py-4 text-center text-sm font-medium border-b-2 transition-colors ${activeTab === 'earned' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:bg-gray-50'}`">Recycling History</button>
          <button @click="activeTab = 'spent'" :class="`flex-1 py-4 text-center text-sm font-medium border-b-2 transition-colors ${activeTab === 'spent' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:bg-gray-50'}`">Withdrawals</button>
      </div>

      <div class="p-0">
          <div v-if="activeTab === 'earned'" class="overflow-x-auto">
              <table class="w-full text-left">
                  <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                          <th class="px-6 py-3">Time</th>
                          <th class="px-6 py-3">Machine & Type</th>
                          <th class="px-6 py-3">Weight</th>
                          <th class="px-6 py-3">Status</th>
                          <th class="px-6 py-3 text-right">Value</th>
                      </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                      <tr v-if="recyclingHistory.length === 0"><td colspan="5" class="p-6 text-center text-gray-400">No records found</td></tr>
                      <tr v-for="r in recyclingHistory" :key="r.id" class="hover:bg-gray-50">
                          <td class="px-6 py-3 text-sm text-gray-600">{{ new Date(r.submitted_at).toLocaleString() }}</td>
                          <td class="px-6 py-3 text-sm text-gray-500 font-mono">
                            {{ r.device_no }}
                            <div class="text-[10px] text-gray-400 font-sans">{{ r.waste_type }}</div>
                          </td>
                          <td class="px-6 py-3 text-sm font-bold">{{ r.api_weight }} kg</td>
                          <td class="px-6 py-3 text-sm">
                            <span v-if="r.status === 'VERIFIED'" class="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Verified</span>
                            <span v-else-if="r.status === 'REJECTED'" class="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Rejected</span>
                            <span v-else class="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 animate-pulse">Pending</span>
                          </td>
                          <td class="px-6 py-3 text-sm text-right font-bold">
                            <span v-if="r.status === 'VERIFIED'" class="text-green-600">+{{ r.calculated_value?.toFixed(2) }}</span>
                            <span v-else class="text-gray-300 line-through decoration-gray-300">
                                {{ r.calculated_value?.toFixed(2) }}
                            </span>
                          </td>
                      </tr>
                  </tbody>
              </table>
          </div>
          
          <div v-if="activeTab === 'spent'" class="overflow-x-auto">
               <table class="w-full text-left">
                  <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr><th class="px-6 py-3">Date</th><th class="px-6 py-3">Amount</th><th class="px-6 py-3">Status</th></tr>
                  </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr v-if="withdrawalHistory.length === 0">
                            <td colspan="3" class="p-6 text-center text-gray-400">No withdrawals found</td>
                        </tr>
                        <tr v-for="w in withdrawalHistory" :key="w.id" class="hover:bg-gray-50">
                            <td class="px-6 py-3 text-sm text-gray-600">
                                {{ new Date(w.created_at).toLocaleString() }}
                            </td>

                            <td class="px-6 py-3 text-sm font-bold text-red-600">
                                -{{ w.amount }}
                            </td>

                            <td class="px-6 py-3 text-sm">
                                <span v-if="w.status === 'EXTERNAL_SYNC'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                    <span class="mr-1">🤖</span> External Sync
                                </span>
                                
                                <span v-else-if="w.status === 'PENDING'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Pending
                                </span>

                                <span v-else-if="w.status === 'PAID' || w.status === 'APPROVED'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Paid
                                </span>
                                
                                <span v-else class="capitalize text-gray-600">
                                    {{ w.status }}
                                </span>
                            </td>
                        </tr>
                    </tbody>
              </table>
          </div>
      </div>
    </div>

    <!-- Status Modal -->
    <div v-if="showStatusModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showStatusModal = false">
        <div class="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Update User Status</h3>
            <p class="text-gray-600 mb-6">Change status to <span class="font-bold">{{ newStatus }}</span>?</p>
            <div class="flex gap-3 justify-end">
                <button @click="showStatusModal = false" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button @click="updateUserStatus" :disabled="isUpdatingStatus" class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
                    {{ isUpdatingStatus ? 'Saving...' : 'Confirm' }}
                </button>
            </div>
        </div>
    </div>

    <!-- Edit Profile Modal -->
    <div v-if="showEditProfile" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showEditProfile = false">
        <div class="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Edit Profile</h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Nickname</label>
                    <input v-model="editProfile.nickname" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input v-model="editProfile.phone" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input v-model="editProfile.email" type="email" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                    <input v-model="editProfile.card_no" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Vendor Internal ID</label>
                    <input v-model="editProfile.vendor_internal_id" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
            </div>
            <div class="flex gap-3 justify-end mt-6">
                <button @click="showEditProfile = false" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button @click="handleProfileSave" :disabled="isSubmittingProfile" class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
                    {{ isSubmittingProfile ? 'Saving...' : 'Save' }}
                </button>
            </div>
        </div>
    </div>

    <!-- Balance Adjustment Modal -->
    <div v-if="showAdjustModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showAdjustModal = false">
        <div class="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Adjust {{ adjustType === 'points' ? 'Points' : 'Weight' }}</h3>
            <p class="text-gray-600 mb-4 text-sm">Current: {{ adjustType === 'points' ? (user?.lifetime_integral || 0) + ' pts' : (user?.total_weight || 0) + ' kg' }}</p>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ adjustType === 'points' ? 'Points' : 'Weight (kg)' }}</label>
                    <input v-model.number="adjustAmount" type="number" step="0.01" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Enter amount (use negative to deduct)" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                    <input v-model="adjustNote" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Reason for adjustment" />
                </div>
            </div>
            <div class="flex gap-3 justify-end mt-6">
                <button @click="showAdjustModal = false" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button @click="handleAdjust" :disabled="isSubmittingAdjust || !adjustAmount" class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
                    {{ isSubmittingAdjust ? 'Saving...' : 'Confirm' }}
                </button>
            </div>
        </div>
    </div>
  </div>
</template>