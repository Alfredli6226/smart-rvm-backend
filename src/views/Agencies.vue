<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAgencies } from '../composables/useAgencies';
import { useViewerAssignments } from '../composables/useViewerAssignments';
import { Building2, MonitorSmartphone, Plus, Trash2, X, Check, Loader2 } from 'lucide-vue-next';

const { agencies, machines, loading, selectedAgencyId, selectedAgencyAssignments, fetchAgencies, fetchMachines, fetchAssignments, toggleMachine, createAgency, removeAgency } = useAgencies();
const { assignMachinesToViewer } = useViewerAssignments();

const showAddModal = ref(false);
const newEmail = ref('');
const adding = ref(false);
const selectedViewer = ref<any>(null);
const showAssignModal = ref(false);

// Count assignments per agency
const getAssignmentCount = (agencyId: string) => {
  return selectedAgencyId.value === agencyId ? selectedAgencyAssignments.value.length : '?';
};

const handleAddAgency = async () => {
  if (!newEmail.value) return;
  adding.value = true;
  await createAgency(newEmail.value);
  adding.value = false;
  showAddModal.value = false;
  newEmail.value = '';
};

const openAssign = async (agency: any) => {
  selectedViewer.value = agency;
  await fetchMachines();
  await fetchAssignments(agency.id);
  showAssignModal.value = true;
};

const handleToggleMachine = async (machineId: number) => {
  if (!selectedViewer.value) return;
  await toggleMachine(selectedViewer.value.id, machineId);
};

const handleRemove = async (id: string) => {
  if (!confirm('Remove this agency and all their machine access?')) return;
  await removeAgency(id);
};

onMounted(() => {
  fetchAgencies();
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-xl font-bold text-gray-900">Agencies Management</h2>
        <p class="text-sm text-gray-500 mt-1">Create VIEWER accounts and assign machine access</p>
      </div>
      <button @click="showAddModal = true"
        class="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl hover:bg-purple-700 text-sm font-bold transition-all">
        <Plus :size="18" /> Add Agency
      </button>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>

    <div v-else-if="agencies.length === 0" class="bg-white rounded-2xl border border-gray-200 p-12 text-center">
      <Building2 :size="48" class="text-gray-300 mx-auto mb-4" />
      <p class="text-gray-500 text-sm">No agencies yet. Click "Add Agency" to create one.</p>
    </div>

    <div v-else class="grid grid-cols-1 gap-4">
      <div v-for="agency in agencies" :key="agency.id"
        class="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Building2 :size="24" class="text-purple-600" />
            </div>
            <div>
              <h3 class="font-bold text-gray-900">{{ agency.email }}</h3>
              <p class="text-xs text-gray-400">Role: {{ agency.role }} | Created: {{ new Date(agency.created_at).toLocaleDateString() }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button @click="openAssign(agency)"
              class="flex items-center gap-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
              <MonitorSmartphone :size="14" /> Assign Machines
            </button>
            <button @click="handleRemove(agency.id)"
              class="flex items-center gap-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
              <Trash2 :size="14" /> Remove
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Agency Modal -->
    <div v-if="showAddModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showAddModal = false">
      <div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl mx-4">
        <h3 class="text-lg font-bold text-gray-900 mb-4">Add Agency</h3>
        <p class="text-sm text-gray-500 mb-4">Create a VIEWER account with limited machine access.</p>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Agency Email</label>
          <input v-model="newEmail" type="email" placeholder="agency@example.com"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
        </div>

        <div class="flex justify-end gap-3">
          <button @click="showAddModal = false" class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button @click="handleAddAgency" :disabled="adding || !newEmail"
            class="px-4 py-2 text-sm font-bold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
            {{ adding ? 'Creating...' : 'Create Agency' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Assign Machines Modal -->
    <div v-if="showAssignModal && selectedViewer" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showAssignModal = false">
      <div class="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl mx-4 max-h-[80vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-4">
          <div>
            <h3 class="text-lg font-bold text-gray-900">Machine Access: {{ selectedViewer.email }}</h3>
            <p class="text-sm text-gray-500">Select machines this agency can view</p>
          </div>
          <button @click="showAssignModal = false" class="text-gray-400 hover:text-gray-600">
            <X :size="20" />
          </button>
        </div>

        <div v-if="machines.length === 0" class="text-center py-8 text-gray-400">No machines available</div>

        <div v-else class="space-y-2">
          <div v-for="machine in machines" :key="machine.id"
            class="flex items-center justify-between p-3 rounded-xl border hover:bg-gray-50 transition-colors cursor-pointer"
            :class="selectedAgencyAssignments.includes(machine.id) ? 'border-purple-300 bg-purple-50' : 'border-gray-200'"
            @click="handleToggleMachine(machine.id)">
            <div class="flex items-center gap-3">
              <div class="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <MonitorSmartphone :size="16" class="text-gray-600" />
              </div>
              <div>
                <p class="text-sm font-medium text-gray-900">{{ machine.device_no }}</p>
                <p class="text-xs text-gray-400">{{ machine.zone || machine.address || 'No location' }}</p>
              </div>
            </div>
            <div>
              <div v-if="selectedAgencyAssignments.includes(machine.id)" class="h-6 w-6 rounded-full bg-purple-600 flex items-center justify-center">
                <Check :size="14" class="text-white" />
              </div>
              <div v-else class="h-6 w-6 rounded-full border-2 border-gray-300"></div>
            </div>
          </div>
        </div>

        <div class="flex justify-end mt-6">
          <button @click="showAssignModal = false" class="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">
            Done
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
