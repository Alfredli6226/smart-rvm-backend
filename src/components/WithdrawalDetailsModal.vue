<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { 
  X, User, Building, 
  ShieldAlert, ShieldCheck, CheckCircle2, 
  AlertTriangle, RefreshCw, Lock, Clock, History, DollarSign
} from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
  withdrawal: any; 
  userWithdrawalHistory?: any[];
}>();

const emit = defineEmits(['close', 'update-status']);

const hasManualDeduction = ref(false);
const isAuditing = ref(false);
const auditResult = ref<any>(null);
const vendorBalance = ref<number | null>(null);
const vendorCheckError = ref<string>('');
const isDeducting = ref(false);
const deductError = ref<string>('');

// Reset state when modal opens or withdrawal changes
watch(() => props.withdrawal, () => {
    hasManualDeduction.value = false;
    auditResult.value = null; 
    isAuditing.value = false;
    vendorBalance.value = null;
    vendorCheckError.value = '';
});

// Calculated local balance (earned - withdrawn)
const localBalance = computed(() => {
    const user = props.withdrawal?.users || {};
    const earned = parseFloat((user as any).total_earned || 0);
    const withdrawn = parseFloat((user as any).total_withdrawn || 0);
    return earned - withdrawn;
});

// Compare vendor vs local
const balanceDifference = computed(() => {
    if (vendorBalance.value === null) return null;
    return vendorBalance.value - localBalance.value;
});

const balanceStatus = computed(() => {
    if (vendorBalance.value === null) return 'pending';
    const diff = Math.abs(balanceDifference.value || 0);
    if (diff < 0.01) return 'matched';
    if (diff > 5) return 'warning';
    return 'minor';
});

const sufficientFunds = computed(() => {
    if (!auditResult.value) return false; 
    if (auditResult.value.status === 'RISK_DETECTED') {
        return auditResult.value.newLocalBalance >= props.withdrawal.amount;
    }
    return true; 
});

const runAudit = async () => {
    isAuditing.value = true;
    vendorBalance.value = null;
    vendorCheckError.value = '';
    try {
        // First: check vendor balance
        const phone = props.withdrawal?.users?.phone || '';
        const userId = props.withdrawal.user_id;
        
        const vendorRes = await fetch('/api/data-sync?action=check-balance&userId=' + encodeURIComponent(userId || '') + '&phone=' + encodeURIComponent(phone || ''));
        const vendorData = await vendorRes.json();
        
        if (vendorData.success) {
            vendorBalance.value = vendorData.vendorBalance;
        } else {
            vendorCheckError.value = vendorData.error || 'Vendor check failed';
        }
        
        // Calculate local balance from available data
        const withdrawalAmount = parseFloat(props.withdrawal.amount || 0);
        const vendorBal = vendorBalance.value || 0;
        
        if (vendorBal >= withdrawalAmount) {
            auditResult.value = { status: 'MATCHED', newLocalBalance: vendorBal };
        } else {
            auditResult.value = { status: 'RISK_DETECTED', newLocalBalance: vendorBal };
        }
    } catch (e) {
        console.error(e);
        auditResult.value = { status: 'ERROR', msg: 'Audit connection failed' };
        vendorCheckError.value = e.message || 'Connection error';
    } finally {
        isAuditing.value = false;
    }
};

const handleApprove = async () => {
    isDeducting.value = true;
    deductError.value = '';
    try {
        // Auto-deduct points on vendor side via proxy
        const userId = props.withdrawal.user_id;
        const amount = parseFloat(props.withdrawal.amount || 0);
        
        const res = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: '/system/integral/set/2',
                method: 'PUT',
                body: {
                    integralNum: amount,
                    remark: 'Withdrawal approval - admin deduct',
                    userId: parseInt(userId) || userId
                }
            })
        });
        const data = await res.json();
        
        if (data.code === 200) {
            // Deduction successful, proceed with approval
            emit('update-status', props.withdrawal.id, 'APPROVED');
            emit('close');
        } else {
            deductError.value = data.msg || 'Vendor deduction failed';
        }
    } catch (e) {
        deductError.value = e.message || 'Connection error';
    } finally {
        isDeducting.value = false;
    }
};

const handleReject = () => {
    emit('update-status', props.withdrawal.id, 'REJECTED');
    emit('close');
};
</script>

<template>
  <div v-if="isOpen && withdrawal" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
    <div @click="emit('close')" class="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"></div>

    <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
      
      <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h3 class="text-lg font-bold text-gray-900">Withdrawal Details</h3>
        <button @click="emit('close')" class="p-2 bg-white rounded-full text-gray-400 hover:text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors">
          <X :size="20" />
        </button>
      </div>

      <div class="p-6 overflow-y-auto space-y-6">

        <div class="flex justify-between items-center p-4 rounded-xl bg-gray-50 border border-gray-100 shadow-sm">
           <div>
              <div class="text-xs text-gray-500 uppercase font-bold tracking-wider">Amount Request</div>
              <div class="text-2xl font-bold text-gray-900">{{ withdrawal.amount }} pts</div>
           </div>
           <div class="text-right">
              <div class="text-xs text-gray-500 uppercase font-bold tracking-wider">Status</div>
              <span :class="`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold ${
                withdrawal.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                withdrawal.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                'bg-amber-100 text-amber-700'
              }`">
                {{ withdrawal.status }}
              </span>
           </div>
        </div>

        <div v-if="withdrawal.is_bundled" class="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <h4 class="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Building :size="14" class="mr-2"/> Split Breakdown
            </h4>
            <div class="space-y-2">
                <div v-for="sub in withdrawal.sub_withdrawals" :key="sub.id" class="flex justify-between text-sm items-center bg-white p-2 rounded border border-gray-100 shadow-sm">
                    <div class="flex flex-col">
                        <span class="font-medium text-gray-800">
                            {{ sub.merchants?.name || (sub.merchant_id ? `Merchant ${sub.merchant_id.slice(0,4)}...` : 'System / Legacy') }}
                        </span>
                        <span class="text-[10px] text-gray-400">{{ new Date(sub.created_at).toLocaleTimeString() }}</span>
                    </div>
                    <span class="font-bold text-gray-900">{{ sub.amount }} pts</span>
                </div>
            </div>
        </div>

        <div>
          <h4 class="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3 border-b pb-2">
            <User :size="16" class="text-blue-500"/> User Profile
          </h4>
          <div class="grid grid-cols-2 gap-4 text-sm">
             <div>
                <span class="block text-xs text-gray-500">Nickname</span>
                <span class="font-medium text-gray-900">{{ withdrawal.users?.nickname || 'Guest' }}</span>
             </div>
             <div>
                <span class="block text-xs text-gray-500">Phone Number</span>
                <span class="font-mono text-gray-700">{{ withdrawal.users?.phone || '-' }}</span>
             </div>
             <div class="col-span-2">
                <span class="block text-xs text-gray-500">Payment To</span>
                <div class="font-medium text-gray-900">{{ withdrawal.bank_name }} - {{ withdrawal.account_number }}</div>
                <div class="text-xs text-gray-400">{{ withdrawal.account_holder_name }}</div>
             </div>
          </div>
        </div>

        <!-- User Withdrawal History -->
        <div v-if="userWithdrawalHistory && userWithdrawalHistory.length > 0" class="space-y-3">
          <h4 class="flex items-center gap-2 text-sm font-bold text-gray-900 border-b pb-2">
            <History :size="16" class="text-purple-500"/> Withdrawal History ({{ userWithdrawalHistory.length }})
          </h4>
          <div class="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            <div v-for="h in userWithdrawalHistory" :key="h.id" 
                 class="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              <div class="flex items-center gap-3">
                <Clock :size="12" class="text-gray-400 flex-shrink-0" />
                <span class="text-gray-500 font-mono">{{ new Date(h.created_at).toLocaleDateString() }}</span>
                <span class="text-gray-400">{{ new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="font-bold text-gray-800">{{ h.amount }} pts</span>
                <span :class="`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  h.status === 'APPROVED' || h.status === 'PAID' ? 'bg-green-100 text-green-700' :
                  h.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`">
                  {{ h.status === 'APPROVED' || h.status === 'PAID' ? 'Paid' : h.status === 'REJECTED' ? 'Rejected' : 'Pending' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="withdrawal.status === 'PENDING'" class="space-y-4">
            
            <h4 class="flex items-center gap-2 text-sm font-bold text-gray-900 border-b pb-2">
                <DollarSign :size="16" class="text-blue-600"/> Vendor Balance Check
            </h4>

            <div v-if="!auditResult" class="text-center bg-gray-50 rounded-xl p-5 border border-dashed border-gray-300">
                <p class="text-sm text-gray-600 mb-3">
                    Verify this user has not double-spent points on the legacy system.
                </p>
                <button 
                    @click="runAudit" 
                    :disabled="isAuditing"
                    class="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center shadow-sm"
                >
                    <RefreshCw :size="16" :class="['mr-2', isAuditing ? 'animate-spin' : '']" />
                    {{ isAuditing ? 'Auditing Balance...' : 'Run Live Audit' }}
                </button>
            </div>

            <div v-else class="animate-in fade-in zoom-in-95 duration-200">

                <!-- Vendor vs Local Balance Comparison -->
                <div v-if="vendorBalance !== null" :class="`p-4 rounded-xl border mb-4 flex items-start ${
                  balanceStatus === 'matched' ? 'bg-green-50 border-green-200' :
                  balanceStatus === 'warning' ? 'bg-red-50 border-red-200' :
                  'bg-amber-50 border-amber-200'
                }`">
                    <ShieldCheck v-if="balanceStatus === 'matched'" class="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                    <AlertTriangle v-else class="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div class="flex-1">
                        <h5 class="text-sm font-bold" :class="balanceStatus === 'matched' ? 'text-green-800' : 'text-amber-800'">
                            Balance Check {{ balanceStatus === 'matched' ? '✓ Matched' : '⚠ Difference Found' }}
                        </h5>
                        <div class="grid grid-cols-2 gap-3 mt-2 text-xs">
                            <div class="bg-white rounded-lg p-2 border">
                                <span class="text-gray-500">Vendor App Balance</span>
                                <div class="font-bold text-gray-900 text-sm">{{ vendorBalance.toFixed(2) }} pts</div>
                            </div>
                            <div class="bg-white rounded-lg p-2 border">
                                <span class="text-gray-500">Our System Balance</span>
                                <div class="font-bold text-gray-900 text-sm">{{ localBalance.toFixed(2) }} pts</div>
                            </div>
                        </div>
                        <div v-if="balanceStatus !== 'matched'" class="mt-2 text-xs">
                            <span class="font-medium text-amber-700">
                                Difference: {{ balanceDifference?.toFixed(2) }} pts
                            </span>
                            <span class="text-gray-500 ml-1">
                                (system {{ (balanceDifference || 0) > 0 ? 'under' : 'over' }}-reported)
                            </span>
                        </div>
                    </div>
                </div>
                
                <div v-if="!sufficientFunds" class="bg-red-50 p-4 rounded-xl border border-red-200 mb-4 flex items-start">
                    <ShieldAlert class="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                        <h5 class="text-sm font-bold text-red-800">Risk Detected: Double Spending</h5>
                        <p class="text-xs text-red-700 mt-1">
                            The user spent points on the legacy app. After auto-deduction, they only have 
                            <strong>{{ auditResult.newLocalBalance }} pts</strong> remaining, which is not enough for this request.
                        </p>
                    </div>
                </div>

                <div v-else class="bg-green-50 p-4 rounded-xl border border-green-200 mb-4 flex items-start">
                    <ShieldCheck class="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                        <h5 class="text-sm font-bold text-green-800">Balance Verified</h5>
                        <p class="text-xs text-green-700 mt-1">
                            User has sufficient points. Safe to proceed with manual deduction.
                        </p>
                    </div>
                </div>

                <button 
                    v-if="!sufficientFunds" 
                    @click="handleReject" 
                    class="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-md"
                >
                    Reject Withdrawal
                </button>

                <div v-else class="bg-amber-50 border border-amber-200 rounded-xl p-4">
                     <div class="flex items-start mb-4">
                        <AlertTriangle class="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div class="ml-3">
                            <h4 class="text-sm font-bold text-amber-800">Manual Deduction Required</h4>
                            <p class="text-xs text-amber-700 mt-1 leading-relaxed">
                                <strong>Safety Check Passed.</strong> Now, you must log in to the <strong>AutoGCM Backend</strong> and manually deduct 
                                <span class="font-bold text-amber-900 bg-amber-100 px-1 rounded">{{ withdrawal.amount }} points</span>.
                            </p>
                            
                            <label class="flex items-center space-x-2 mt-3 text-sm font-medium text-gray-700 cursor-pointer select-none p-2 hover:bg-amber-100/50 rounded transition-colors border border-transparent hover:border-amber-200">
                                <input type="checkbox" v-model="hasManualDeduction" class="rounded border-gray-400 text-blue-600 w-4 h-4 focus:ring-amber-500" />
                                <span>I confirm points are deducted.</span>
                            </label>
                        </div>
                    </div>

                    <div class="flex gap-3">
                        <button @click="handleReject" class="flex-1 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">
                            Reject
                        </button>
                        <div v-if="deductError" class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-2">
                            {{ deductError }}
                        </div>
                        <button 
                            @click="handleApprove"
                            :disabled="!hasManualDeduction || isDeducting"
                            :class="['flex-1 py-2 text-white font-medium rounded-lg transition-all flex items-center justify-center shadow-sm', (hasManualDeduction && !isDeducting) ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed']"
                        >
                            <CheckCircle2 v-if="!isDeducting" :size="16" class="mr-2" />
                            <RefreshCw v-else :size="16" class="mr-2 animate-spin" />
                            {{ isDeducting ? 'Deducting Points...' : 'Approve & Pay' }}
                        </button>
                    </div>
                </div>

            </div>
        </div>

        <div v-if="withdrawal.status === 'PENDING' && !auditResult" class="relative opacity-40 grayscale pointer-events-none select-none">
             <div class="bg-gray-100 border border-gray-200 rounded-xl p-4 h-24 flex items-center justify-center">
                 <div class="flex items-center text-gray-500 font-bold text-sm">
                    <Lock :size="16" class="mr-2"/> Approval Locked
                 </div>
             </div>
        </div>

      </div>
    </div>
  </div>
</template>