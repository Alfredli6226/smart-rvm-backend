<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Save, X, Trash2, MonitorSmartphone, User, ChevronDown } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
  editData?: any | null; 
  isSubmitting: boolean;
  merchants?: { id: string; name: string }[];
  allMachines?: { device_no: string; name: string; merchant_id?: string }[];
}>();

const emit = defineEmits(['close', 'submit', 'delete-admin']);

// Helper to get actual company name (handles 'Create New' option)
const actualCompanyName = computed(() => {
  if (form.value.name === '__new__') {
    return form.value.newCompanyName;
  }
  return form.value.name;
});

// Get selected merchant object
const selectedMerchant = computed(() => {
  if (form.value.name && form.value.name !== '__new__' && props.merchants) {
    return props.merchants.find(m => m.name === form.value.name);
  }
  return null;
});

// Filter available machines based on selected company
const availableMachines = computed(() => {
  if (!props.allMachines) return [];
  
  const merchant = selectedMerchant.value;
  
  if (merchant) {
    // Show machines that belong to this merchant OR unassigned machines
    return props.allMachines.filter(m => 
      m.merchant_id === merchant.id || !m.merchant_id
    );
  }
  
  // If no company selected or creating new, show only unassigned machines
  return props.allMachines.filter(m => !m.merchant_id);
});

const defaultForm = {
  name: '',
  newCompanyName: '',
  currency: 'RM',
  newAdminEmail: '',
  assignedMachines: '', // For NEW assignments only
  selectedMachineIds: [] as string[], // Selected from fixed IDs
  newMachineIds: [] as string[], // Custom new IDs added by user
  machines: [] as any[] // For EXISTING machine edits
};

const form = ref({ ...defaultForm });

const isEditMode = computed(() => !!props.editData);

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (props.editData) {
      // Get existing machine IDs assigned to this merchant
      const existingIds = props.editData.machines?.map((m: any) => m.device_no) || [];
      form.value = {
        name: props.editData.name,
        newCompanyName: '',
        currency: props.editData.currency_symbol,
        newAdminEmail: '', 
        assignedMachines: '',
        selectedMachineIds: existingIds,
        newMachineIds: [],
        machines: JSON.parse(JSON.stringify(props.editData.machines || []))
      };
    } else {
      form.value = { ...defaultForm };
    }
  }
});

const toggleMachineSelection = (machineId: string) => {
  const index = form.value.selectedMachineIds.indexOf(machineId);
  if (index > -1) {
    form.value.selectedMachineIds.splice(index, 1);
  } else {
    form.value.selectedMachineIds.push(machineId);
  }
};

const addNewMachineId = () => {
  const input = (document.querySelector('.new-machine-input') as HTMLInputElement);
  const newId = input?.value?.trim();
  if (newId && !form.value.newMachineIds.includes(newId) && !form.value.selectedMachineIds.includes(newId)) {
    form.value.newMachineIds.push(newId);
    input.value = '';
  }
};

const removeMachineId = (machineId: string) => {
  const selIndex = form.value.selectedMachineIds.indexOf(machineId);
  if (selIndex > -1) {
    form.value.selectedMachineIds.splice(selIndex, 1);
    return;
  }
  const newIndex = form.value.newMachineIds.indexOf(machineId);
  if (newIndex > -1) {
    form.value.newMachineIds.splice(newIndex, 1);
  }
};

const handleSubmit = () => {
  // Combine fixed IDs and new IDs for assignment
  const allMachineIds = [...form.value.selectedMachineIds, ...form.value.newMachineIds];
  
  // Use actual company name (handles the 'Create New' option)
  const companyName = actualCompanyName.value;
  
  emit('submit', { 
    ...form.value, 
    name: companyName,
    assignedMachines: allMachineIds.join(', ')
  });
};

// Helper to check if machine is UCO (Oil)
const isUco = (name: string) => name.toLowerCase().includes('uco') || name.toLowerCase().includes('oil');
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
      
      <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h2 class="text-lg font-bold text-gray-900">
          {{ isEditMode ? 'Edit Client Configuration' : 'Onboard New Client' }}
        </h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
          <X :size="20" />
        </button>
      </div>

      <div class="p-6 space-y-6 overflow-y-auto">
        
        <div class="grid grid-cols-4 gap-4">
            <div class="col-span-3">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1.5">Company Name</label>
                <div class="relative">
                  <select 
                    v-model="form.name" 
                    class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all appearance-none bg-white cursor-pointer"
                  >
                    <option value="" disabled>Select a company</option>
                    <option value="__new__">+ Create New Company</option>
                    <option v-for="merchant in merchants" :key="merchant.id" :value="merchant.name">
                      {{ merchant.name }}
                    </option>
                  </select>
                  <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" :size="16" />
                </div>
                <input 
                  v-if="form.name === '__new__'" 
                  v-model="form.newCompanyName" 
                  type="text" 
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all mt-2" 
                  placeholder="Enter new company name"
                />
            </div>
            <div class="col-span-1">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1.5">Currency</label>
                <input v-model="form.currency" type="text" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-center font-bold" />
            </div>
        </div>

        <div>
            <h3 class="text-xs font-bold text-gray-900 uppercase mb-3 flex items-center">
                <MonitorSmartphone :size="14" class="mr-2"/> Assigned Machines & Pricing
            </h3>
            
            <div v-if="form.machines.length > 0" class="space-y-3 mb-4">
                <div class="grid grid-cols-12 gap-2 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 pb-1">
                    <div class="col-span-4">Device</div>
                    <div class="col-span-2 text-center">Type</div>
                    <div class="col-span-6 text-center">Rates ({{ form.currency }}/kg)</div>
                </div>

                <div v-for="m in form.machines" :key="m.device_no" class="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                    
                    <div class="col-span-4">
                        <div class="font-mono text-xs font-bold text-gray-700">{{ m.device_no }}</div>
                        <div class="text-[10px] text-gray-400 truncate">{{ m.name }}</div>
                    </div>

                    <div class="col-span-2 text-center">
                        <span v-if="isUco(m.name)" class="px-2 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-200">UCO</span>
                        <span v-else class="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-200">RVM</span>
                    </div>

                    <div class="col-span-6 flex gap-2">
                        <template v-if="isUco(m.name)">
                             <div class="flex-1">
                                <input v-model="m.rate_uco" type="number" step="0.01" class="w-full p-1 text-center text-xs border border-orange-200 bg-white rounded focus:ring-1 focus:ring-orange-500 outline-none" placeholder="Oil Rate" />
                                <div class="text-[9px] text-center text-orange-400 mt-0.5">Oil</div>
                             </div>
                        </template>
                        <template v-else>
                             <div class="flex-1">
                                <input v-model="m.rate_plastic" type="number" step="0.01" class="w-full p-1 text-center text-xs border border-blue-200 bg-white rounded focus:ring-1 focus:ring-blue-500 outline-none" />
                                <div class="text-[9px] text-center text-blue-400 mt-0.5">Bin 1 (P/C)</div>
                             </div>
                             <div class="flex-1">
                                <input v-model="m.rate_paper" type="number" step="0.01" class="w-full p-1 text-center text-xs border border-blue-200 bg-white rounded focus:ring-1 focus:ring-blue-500 outline-none" />
                                <div class="text-[9px] text-center text-blue-400 mt-0.5">Bin 2 (Paper)</div>
                             </div>
                        </template>
                    </div>

                </div>
            </div>
            
            <div v-else class="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-lg text-center mb-4">
                No machines assigned yet. Add IDs below.
            </div>

            <label class="block text-xs font-bold text-gray-500 uppercase mb-1.5 flex justify-between">
                <span>Assign New Machines</span>
            </label>
            
            <!-- Fixed Machine ID Options -->
            <div class="mb-3">
                <div class="text-[10px] font-bold text-gray-400 uppercase mb-2">Select Machine IDs</div>
                <div v-if="availableMachines.length > 0" class="flex flex-wrap gap-2">
                    <button 
                        v-for="machine in availableMachines" 
                        :key="machine.device_no"
                        type="button"
                        @click="toggleMachineSelection(machine.device_no)"
                        :class="`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
                            form.selectedMachineIds.includes(machine.device_no)
                            ? 'bg-purple-100 text-purple-700 border-purple-300 ring-2 ring-purple-200'
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        }`"
                    >
                        <MonitorSmartphone :size="12" class="inline mr-1.5"/>
                        {{ machine.device_no }}
                        <span v-if="form.selectedMachineIds.includes(machine.device_no)" class="ml-1">✓</span>
                    </button>
                </div>
                <div v-else class="text-sm text-gray-400 italic bg-gray-50 p-3 rounded-lg text-center">
                    No unassigned machines available. Please select a company first.
                </div>
            </div>
            
            <!-- Add Custom New Machine ID -->
            <div class="mb-3">
                <div class="text-[10px] font-bold text-gray-400 uppercase mb-2">Add New Machine ID</div>
                <div class="flex gap-2">
                    <input 
                        v-model="form.assignedMachines" 
                        type="text" 
                        class="new-machine-input flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                        placeholder="Enter new machine ID (e.g. 071582000099)"
                        @keyup.enter="addNewMachineId"
                    />
                    <button 
                        type="button"
                        @click="addNewMachineId"
                        class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium text-sm transition-all"
                    >
                        Add
                    </button>
                </div>
            </div>
            
            <!-- Selected Machines Display -->
            <div v-if="form.selectedMachineIds.length > 0 || form.newMachineIds.length > 0" class="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <div class="text-[10px] font-bold text-purple-600 uppercase mb-2">Selected Machines ({{ form.selectedMachineIds.length + form.newMachineIds.length }})</div>
                <div class="flex flex-wrap gap-2">
                    <span 
                        v-for="machineId in form.selectedMachineIds" 
                        :key="'sel-' + machineId"
                        class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-white text-purple-700 border border-purple-200"
                    >
                        <MonitorSmartphone :size="12" class="mr-1.5"/>
                        {{ machineId }}
                        <button 
                            type="button"
                            @click="removeMachineId(machineId)"
                            class="ml-2 text-purple-400 hover:text-red-500 transition-colors"
                        >
                            <X :size="14" />
                        </button>
                    </span>
                    <span 
                        v-for="machineId in form.newMachineIds" 
                        :key="'new-' + machineId"
                        class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-white text-purple-700 border border-purple-200"
                    >
                        <MonitorSmartphone :size="12" class="mr-1.5"/>
                        {{ machineId }}
                        <button 
                            type="button"
                            @click="removeMachineId(machineId)"
                            class="ml-2 text-purple-400 hover:text-red-500 transition-colors"
                        >
                            <X :size="14" />
                        </button>
                    </span>
                </div>
            </div>
        </div>

        <div class="h-px bg-gray-100"></div>

        <div>
            <h3 class="text-xs font-bold text-gray-900 uppercase mb-3 flex items-center">
                <User :size="14" class="mr-2"/> Administrators
            </h3>

            <div v-if="isEditMode && props.editData?.admins?.length" class="flex flex-col gap-2 mb-4">
                <div v-for="admin in props.editData.admins" :key="admin.id" class="flex justify-between items-center bg-purple-50 px-3 py-2 rounded-lg border border-purple-100">
                    <span class="text-sm text-purple-900">{{ admin.email }}</span>
                    <button 
                        @click="$emit('delete-admin', admin.id)"
                        class="text-purple-300 hover:text-red-500 transition-colors"
                        title="Revoke Access"
                    >
                        <Trash2 :size="14" />
                    </button>
                </div>
            </div>

            <div class="flex gap-2 items-end">
                <div class="flex-1">
                    <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Invite New Admin</label>
                    <input 
                        v-model="form.newAdminEmail" 
                        type="email" 
                        class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" 
                        placeholder="new.admin@client.com" 
                    />
                </div>
            </div>
        </div>

      </div>

      <div class="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
        <button @click="$emit('close')" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium text-sm">Cancel</button>
        <button 
          @click="handleSubmit" 
          :disabled="isSubmitting"
          class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-medium text-sm transition-all shadow-sm active:scale-95 disabled:opacity-70"
        >
          <Save :size="16" />
          <span>{{ isEditMode ? 'Save Changes' : 'Create Account' }}</span>
        </button>
      </div>

    </div>
  </div>
</template>
