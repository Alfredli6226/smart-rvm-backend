<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useWithdrawal } from '../composables/useWithdrawal';
import { ArrowLeft, Wallet } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import BaseModal from '../components/BaseModal.vue'; // Import Modal
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const localUser = JSON.parse(localStorage.getItem("autogcmUser") || "{}");
const userPhone = localUser.phone; 
const router = useRouter();

const { 
  loading, maxWithdrawal, withdrawalHistory, lifetimeEarnings, fetchBalance, submitWithdrawal,
  isNineApp, submitWavpayMock
} = useWithdrawal(userPhone);

const wavpayForm = ref({ amount: '', icNumber: '' });

const form = ref({
  amount: '',
  bankName: '', 
  customBank: '',
  accountNumber: '',
  holderName: ''
});

const bankList = [
  "Maybank", "CIMB Bank", "Public Bank", "RHB Bank", "Hong Leong Bank", 
  "AmBank", "UOB Bank", "Bank Rakyat", "OCBC Bank", "HSBC Bank", 
  "Bank Islam", "Affin Bank", "Alliance Bank", "Standard Chartered", 
  "BSN (Bank Simpanan Nasional)", "Bank Muamalat", "Agrobank", 
  "Touch 'n Go eWallet", "DuitNow", "Other"
];


const modal = reactive({
    isOpen: false,
    isError: false,
    title: '',
    message: ''
});

const showModal = (title, message, isError = false) => {
    modal.title = title;
    modal.message = message;
    modal.isError = isError;
    modal.isOpen = true;
};

onMounted(() => {
  if(userPhone) fetchBalance();
});

const handleSubmit = async () => {
  const amount = Number(form.value.amount);
  
  if (!amount || amount <= 0) {
      showModal(t('withdraw.error_amount'), t('withdraw.error_amount_msg'), true);
      return;
  }

  let finalBankName = form.value.bankName;
  if (!finalBankName) {
      showModal(t('withdraw.error_bank'), t('withdraw.error_bank_msg'), true);
      return;
  }

  if (finalBankName === 'Other') {
      if (!form.value.customBank.trim()) {
          showModal(t('withdraw.error_bank'), t('withdraw.type_bank'), true);
          return;
      }
      finalBankName = form.value.customBank.trim();
  }

  if (!form.value.accountNumber.trim()) {
      showModal(t('withdraw.error_details'), t('withdraw.error_acc_msg'), true);
      return;
  }

  if (!form.value.holderName.trim()) {
      showModal(t('withdraw.error_details'), t('withdraw.error_name_msg'), true);
      return;
  }

  const payload = { ...form.value, bankName: finalBankName };
  const result = await submitWithdrawal(amount, payload);
  
  if (result.success) {
    showModal(t('withdraw.success'), t('withdraw.success_msg'));
    form.value.amount = ''; 
  } else {
    showModal("Submission Failed", result.message, true); // Server errors usually stay in English or need backend translation
  }
};


const handleWavpaySubmit = async () => {
    if (!wavpayForm.value.amount || !wavpayForm.value.icNumber) {
        showModal("Error", "Please fill in all fields", true);
        return;
    }
    const res = await submitWavpayMock(wavpayForm.value.amount, wavpayForm.value.icNumber);
    
    if (res.success) {
        showModal("Success", res.message);
        wavpayForm.value.amount = '';
    } else {
        showModal("Failed", res.message, true);
    }
};

const formatMyKad = (event) => {
  let val = event.target.value.replace(/\D/g, ''); // Remove all non-digits
  
  // Limit to 12 digits (MyKad length)
  if (val.length > 12) val = val.slice(0, 12);

  // Add first hyphen after 6 digits
  if (val.length > 6) {
    val = val.slice(0, 6) + '-' + val.slice(6);
  }
  // Add second hyphen after 8 digits (6 digits + 1 hyphen + 2 digits = 9 chars)
  if (val.length > 9) {
    val = val.slice(0, 9) + '-' + val.slice(9);
  }

  wavpayForm.value.icNumber = val;
};

</script>

<template>
  <div class="p-4 max-w-md mx-auto space-y-6 pb-24"> <div class="flex items-center space-x-3 mb-2">
      <button @click="router.back()" class="p-2 rounded-full bg-white text-gray-600 shadow-sm border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all">
        <ArrowLeft :size="20" />
      </button>
      <h1 class="text-xl font-bold text-gray-800">
       {{ isNineApp ? 'Nine App Auto-Credit' : t('withdraw.title') }}
      </h1>
    </div>
    
    <div class="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
      <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full"></div>

      <div class="relative z-10">
        <div class="text-blue-100 text-sm font-medium">{{ t('withdraw.available') }}</div>
        <div class="text-4xl font-bold mt-1">RM{{ loading ? '...' : maxWithdrawal }} pts</div>
        
        <div class="mt-4 pt-3 border-t border-blue-400/30 flex items-center justify-between text-xs text-blue-100">
            <span>{{ t('withdraw.lifetime') }}: {{ lifetimeEarnings }}</span>
            
            <span v-if="withdrawalHistory.some(w => w.status === 'PENDING')" class="bg-blue-800/40 px-2 py-1 rounded flex items-center">
              <span class="mr-1">🔒</span> RM {{ withdrawalHistory.filter(w => w.status === 'PENDING').reduce((s,x)=>s+Number(x.amount),0).toFixed(2) }} {{ t('withdraw.reserved') }}
            </span>
        </div>
      </div>
    </div>

   <div v-if="isNineApp" class="bg-white rounded-xl p-6 shadow-sm border border-blue-200">
    <div class="flex items-center gap-3 mb-6 p-3 bg-blue-50 rounded-lg text-blue-900">
        <Wallet />
        <div class="text-sm font-bold">Linked to Nine App Wallet</div>
    </div>

    <div class="space-y-4">
        <div>
            <label class="text-xs font-bold text-gray-500">Amount (RM)</label>
            <input v-model="wavpayForm.amount" type="number" class="w-full p-3 bg-gray-50 rounded-lg outline-none" placeholder="0.00">
            
            <div class="mt-2 flex flex-col gap-1 text-[11px] text-gray-400 pl-1">
               <p>• {{ t('withdraw.limit_min') }}: RM 5.00</p>
               <p>• {{ t('withdraw.limit_max') }}: RM 200.00</p>
               <p>• {{ t('withdraw.limit_daily') }}: RM 300.00</p>
            </div>
        </div>

        <div>
            <label class="text-xs font-bold text-gray-500">IC / Passport Number</label>
            <input 
                :value="wavpayForm.icNumber" 
                @input="formatMyKad"
                type="text" 
                class="w-full p-3 bg-gray-50 rounded-lg outline-none" 
                placeholder="e.g. 881010-01-xxxx"
                maxlength="14"
            >
        </div>
        
        <button @click="handleWavpaySubmit" :disabled="loading" class="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
            {{ loading ? 'Processing...' : 'Confirm Auto Credit' }}
        </button>
    </div>
</div>

<div v-else class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
   <h3 class="font-bold text-gray-900 mb-4">{{ t('withdraw.request_title') }}</h3>
      
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('withdraw.amount') }}</label>
          <input 
            v-model="form.amount" 
            type="number" 
            :placeholder="t('withdraw.enter_amount')" 
            class="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-blue-500 transition-all outline-none"
          >
          <div class="mt-2 flex flex-col gap-1 text-[11px] text-gray-400 pl-1">
             <p>• {{ t('withdraw.limit_min') }}: RM 5.00</p>
             <p>• {{ t('withdraw.limit_max') }}: RM 200.00</p>
             <p>• {{ t('withdraw.limit_daily') }}: RM 200.00</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
           <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('withdraw.bank_name') }}</label>
              
              <select v-model="form.bankName" class="w-full p-3 bg-gray-50 rounded-lg border-none outline-none cursor-pointer">
                <option disabled value="">{{ t('withdraw.select_bank') }}</option>
                <option v-for="bank in bankList" :key="bank" :value="bank">{{ bank }}</option>
              </select>
              
              <div v-if="form.bankName === 'Other'" class="mt-2">
                <input v-model="form.customBank" type="text" placeholder="Type your bank name..." 
                   class="w-full p-3 bg-blue-50 text-blue-900 rounded-lg border border-blue-100 focus:ring-2 focus:ring-blue-500 outline-none">
              </div>
           </div>
           <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('withdraw.account_no') }}</label>
              <input v-model="form.accountNumber" type="text" placeholder="1234..." 
                 class="w-full p-3 bg-gray-50 rounded-lg border-none outline-none">
           </div>
        </div>
        
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('withdraw.holder_name') }}</label>
          <input 
              v-model="form.holderName" 
              type="text" 
              :placeholder="t('withdraw.holder_placeholder')" 
              class="w-full p-3 bg-gray-50 rounded-lg border-none outline-none"
          >
        </div>

        <button @click="handleSubmit" :disabled="loading" 
                class="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 flex justify-center items-center gap-2">
           <span v-if="loading" class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
           <span>{{ loading ? t('withdraw.processing') : t('withdraw.submit') }}</span>
        </button>
      </div>
    </div>

    <div class="space-y-3">
      <h3 class="font-bold text-gray-900 px-1">{{ t('withdraw.history') }}</h3>
      <div v-if="withdrawalHistory.length === 0" class="text-center py-8 text-gray-400 text-sm">
        {{ t('withdraw.no_history') }}
      </div>
      <div v-for="item in withdrawalHistory" :key="item.created_at" 
           class="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center transition hover:shadow-md">
         <div>
            <div class="font-bold text-gray-900">RM {{ Number(item.amount).toFixed(2) }}</div>
            <div class="text-xs text-gray-400">
                {{ new Date(item.created_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) }}
                <span class="mx-1">•</span> {{ item.bank_name }}
            </div>
         </div>
         <span :class="`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
            item.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 
            item.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 
            'bg-amber-100 text-amber-700'
         }`">
            {{ item.status === 'EXTERNAL_SYNC' ? 'MIGRATED' : item.status }}
         </span>
      </div>
    </div>

    <BaseModal :isOpen="modal.isOpen" @close="modal.isOpen = false">
      <div class="text-center p-2">
        <div class="mb-4 mx-auto flex items-center justify-center w-14 h-14 rounded-full" 
             :class="modal.isError ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-500'">
           <span v-if="modal.isError" class="text-3xl font-bold">!</span>
           <span v-else class="text-3xl font-bold">✓</span>
        </div>
        
        <h3 class="text-xl font-bold text-gray-800 mb-2">{{ modal.title }}</h3>
        <p class="text-gray-500 mb-6 text-sm leading-relaxed">{{ modal.message }}</p>
        
        <button @click="modal.isOpen = false" 
                class="w-full py-3 rounded-xl font-bold transition text-white shadow-md active:scale-95 transform"
          :class="modal.isError ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'">
          {{ t('withdraw.modal_ok') }}
        </button>
      </div>
    </BaseModal>

  </div>
</template>