<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useWithdrawal } from '../composables/useWithdrawal';
import { ArrowLeft } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import BaseModal from '../components/BaseModal.vue'; // Import Modal

const localUser = JSON.parse(localStorage.getItem("autogcmUser") || "{}");
const userPhone = localUser.phone; 
const router = useRouter();

const { 
  loading, 
  maxWithdrawal, 
  withdrawalHistory, 
  lifetimeEarnings, 
  fetchBalance, 
  submitWithdrawal 
} = useWithdrawal(userPhone);

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

// ✅ Modal State
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
  
  // 1. Validate Amount
  if (!amount || amount <= 0) {
      showModal("Invalid Amount", "Please enter a valid amount greater than zero.", true);
      return;
  }

  // 2. Validate Bank Selection
  let finalBankName = form.value.bankName;
  
  // Check if user hasn't selected a bank yet
  if (!finalBankName) {
      showModal("Missing Bank", "Please select a bank.", true);
      return;
  }

  // Handle "Other" bank input
  if (finalBankName === 'Other') {
      if (!form.value.customBank.trim()) {
          showModal("Missing Bank Name", "Please type the name of your bank.", true);
          return;
      }
      finalBankName = form.value.customBank.trim();
  }

  // 3. Validate Account Number
  if (!form.value.accountNumber.trim()) {
      showModal("Missing Details", "Please enter your account number.", true);
      return;
  }

  // 4. Validate Holder Name
  if (!form.value.holderName.trim()) {
      showModal("Missing Details", "Please enter the account holder name.", true);
      return;
  }

  // 5. Submit
  const payload = { ...form.value, bankName: finalBankName };
  const result = await submitWithdrawal(amount, payload);
  
  if (result.success) {
    showModal("Success!", "Your withdrawal request has been submitted and is pending approval.");
    form.value.amount = ''; 
  } else {
    showModal("Submission Failed", result.message, true);
  }
};
</script>

<template>
  <div class="p-4 max-w-md mx-auto space-y-6 pb-24"> <div class="flex items-center space-x-3 mb-2">
      <button @click="router.back()" class="p-2 rounded-full bg-white text-gray-600 shadow-sm border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all">
        <ArrowLeft :size="20" />
      </button>
      <h1 class="text-xl font-bold text-gray-800">Withdraw Points</h1>
    </div>
    
    <div class="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
      <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full"></div>

      <div class="relative z-10">
        <div class="text-blue-100 text-sm font-medium">Available to Withdraw</div>
        <div class="text-4xl font-bold mt-1">RM{{ loading ? '...' : maxWithdrawal }} pts</div>
        
        <div class="mt-4 pt-3 border-t border-blue-400/30 flex items-center justify-between text-xs text-blue-100">
            <span>Total Lifetime: {{ lifetimeEarnings }}</span>
            
            <span v-if="withdrawalHistory.some(w => w.status === 'PENDING')" class="bg-blue-800/40 px-2 py-1 rounded flex items-center">
              <span class="mr-1">🔒</span> RM {{ withdrawalHistory.filter(w => w.status === 'PENDING').reduce((s,x)=>s+Number(x.amount),0).toFixed(2) }} Reserved
            </span>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 class="font-bold text-gray-900 mb-4">Request Withdrawal</h3>
      
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Amount</label>
          <input v-model="form.amount" type="number" placeholder="Enter points to withdraw" 
                 class="w-full p-3 bg-gray-50 rounded-lg border-none focus:ring-2 focus:ring-blue-500 transition-all outline-none">
                 <div class="mt-2 flex flex-col gap-1 text-[11px] text-gray-400 pl-1">
                  <p>• Minimum: RM 5.00</p>
                  <p>• Max per transaction: RM 200.00</p>
                  <p>• Daily Limit: RM 200.00</p>
                </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
           <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Bank Name</label>
              
              <select v-model="form.bankName" class="w-full p-3 bg-gray-50 rounded-lg border-none outline-none cursor-pointer">
                <option disabled value="">Select Bank</option>
                <option v-for="bank in bankList" :key="bank" :value="bank">{{ bank }}</option>
              </select>
              
              <div v-if="form.bankName === 'Other'" class="mt-2">
                <input v-model="form.customBank" type="text" placeholder="Type your bank name..." 
                   class="w-full p-3 bg-blue-50 text-blue-900 rounded-lg border border-blue-100 focus:ring-2 focus:ring-blue-500 outline-none">
              </div>
           </div>
           <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Account No.</label>
              <input v-model="form.accountNumber" type="text" placeholder="1234..." 
                 class="w-full p-3 bg-gray-50 rounded-lg border-none outline-none">
           </div>
        </div>
        
        <div>
           <label class="block text-xs font-medium text-gray-500 mb-1">Account Holder Name</label>
           <input v-model="form.holderName" type="text" placeholder="Full Name per IC" 
              class="w-full p-3 bg-gray-50 rounded-lg border-none outline-none">
        </div>

        <button @click="handleSubmit" :disabled="loading" 
                class="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 flex justify-center items-center gap-2">
           <span v-if="loading" class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
           <span>{{ loading ? 'Processing...' : 'Submit Request' }}</span>
        </button>
      </div>
    </div>

    <div class="space-y-3">
      <h3 class="font-bold text-gray-900 px-1">History</h3>
      <div v-if="withdrawalHistory.length === 0" class="text-center py-8 text-gray-400 text-sm">
        No withdrawal history yet.
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
          Okay, Got it
        </button>
      </div>
    </BaseModal>

  </div>
</template>