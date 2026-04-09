<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/auth';
import { useMachineStore } from '../stores/machines';
import { storeToRefs } from 'pinia';
import { 
  RefreshCcw, Plus, Pencil, Trash2, Play, Pause, Image, Video, Users, Megaphone, 
  LayoutGrid, MapPin, Phone, X, Eye, Search, Upload, Check, ChevronDown, FileText
} from 'lucide-vue-next';
import { saveAs } from 'file-saver';

const auth = useAuthStore();
const machineStore = useMachineStore();
const { machines } = storeToRefs(machineStore);

const isSuperAdmin = computed(() => auth.role === 'SUPER_ADMIN' && !auth.merchantId);

const loading = ref(false);
const searchTerm = ref('');
const advertisements = ref<any[]>([]);
const totalActiveAds = ref(0);
const availableSlots = ref(0);
const totalInvestors = ref(0);

const showModal = ref(false);
const editingAd = ref<any | null>(null);
const formData = ref({
  title: '',
  mediaUrl: '',
  mediaType: 'image' as 'image' | 'video',
  duration: 0,
  assignedMachines: [] as number[],
  contactNumber: '',
  status: 'inactive' as 'active' | 'inactive'
});
const isSubmitting = ref(false);
const selectedFile = ref<File | null>(null);
const showMachineDropdown = ref(false);
const fileError = ref('');

const MAX_SLOTS_PER_MACHINE = 10;
const MAX_VIDEO_DURATION = 60;

const demoAdvertisements = [
  {
    id: 1,
    title: 'Recycle Rewards Campaign',
    media_url: 'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?w=400',
    media_type: 'image',
    duration: null,
    assigned_machines: [1, 2, 3],
    contact_number: '+60123456789',
    status: 'active',
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 2,
    title: 'Eco-Friendly Promo',
    media_url: 'https://images.unsplash.com/photo-1532996122724-3c7597a9c410?w=400',
    media_type: 'image',
    duration: null,
    assigned_machines: [4, 5],
    contact_number: '+60198765432',
    status: 'active',
    created_at: '2024-01-14T09:00:00Z'
  },
  {
    id: 3,
    title: 'Green Machine Demo',
    media_url: 'https://images.unsplash.com/photo-1604187351574-c75ca79f5807?w=400',
    media_type: 'image',
    duration: null,
    assigned_machines: [1],
    contact_number: '+601155577999',
    status: 'inactive',
    created_at: '2024-01-13T08:00:00Z'
  },
  {
    id: 4,
    title: 'Sustainability Video',
    media_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    media_type: 'video',
    duration: 15,
    assigned_machines: [2, 3, 4, 5],
    contact_number: '+60112233445',
    status: 'active',
    created_at: '2024-01-12T07:00:00Z'
  }
];

const filteredAdvertisements = computed(() => {
  let result = advertisements.value;
  
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase();
    result = result.filter(ad => {
      const titleMatch = ad.title?.toLowerCase().includes(term);
      const machineMatch = ad.assigned_machines?.some((mid: number) => {
        const machine = machines.value.find(m => m.id === mid);
        return machine?.name?.toLowerCase().includes(term);
      });
      return titleMatch || machineMatch;
    });
  }
  
  return result;
});

const availableMachines = computed(() => machines.value);

function getMachineNames(machineIds: number[]) {
  if (!machineIds || machineIds.length === 0) return [];
  return machineIds.map(id => {
    const machine = machines.value.find(m => m.id === id);
    return machine?.name || `Machine #${id}`;
  });
}

function getSelectedMachineNames() {
  return formData.value.assignedMachines.map(id => {
    const machine = machines.value.find(m => m.id === id);
    return machine?.name || `Machine #${id}`;
  });
}

async function fetchData() {
  loading.value = true;
  try {
    await machineStore.fetchMachines();
    
    const { data: ads, error } = await supabase
      .from('advertisements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Using demo data (database not available)');
      advertisements.value = demoAdvertisements;
    } else if (!ads || ads.length === 0) {
      advertisements.value = demoAdvertisements;
    } else {
      advertisements.value = ads;
    }
    
    totalActiveAds.value = advertisements.value.filter(ad => ad.status === 'active').length;
    
    const assignedSlots = advertisements.value.reduce((sum, ad) => {
      return sum + (ad.assigned_machines?.length || 0);
    }, 0);
    const maxSlots = machines.value.length * MAX_SLOTS_PER_MACHINE;
    availableSlots.value = Math.max(0, maxSlots - assignedSlots);
    
    const uniqueContacts = new Set(
      advertisements.value.map(ad => ad.contact_number).filter(Boolean)
    );
    totalInvestors.value = uniqueContacts.size;

  } catch (err) {
    console.log('Using demo data:', err);
    advertisements.value = demoAdvertisements;
    totalActiveAds.value = demoAdvertisements.filter(ad => ad.status === 'active').length;
    totalInvestors.value = new Set(demoAdvertisements.map(ad => ad.contact_number)).size;
  } finally {
    loading.value = false;
  }
}

function handleRefresh() {
  fetchData();
}

function openAddModal() {
  editingAd.value = null;
  formData.value = {
    title: '',
    mediaUrl: '',
    mediaType: 'image',
    duration: 0,
    assignedMachines: [],
    contactNumber: '',
    status: 'inactive'
  };
  selectedFile.value = null;
  fileError.value = '';
  showModal.value = true;
}

function openEditModal(ad: any) {
  editingAd.value = ad;
  formData.value = {
    title: ad.title || '',
    mediaUrl: ad.media_url || '',
    mediaType: ad.media_type || 'image',
    duration: ad.duration || 0,
    assignedMachines: ad.assigned_machines || [],
    contactNumber: ad.contact_number || '',
    status: ad.status || 'inactive'
  };
  selectedFile.value = null;
  fileError.value = '';
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingAd.value = null;
  selectedFile.value = null;
  fileError.value = '';
}

function exportAdReport(ad: any) {
  const machineNames = (ad.assigned_machines || []).map((id: number) => {
    const machine = machines.value.find(m => m.id === id);
    return machine?.name || `Machine ${id}`;
  });

  const reportData = [
    { Field: 'Campaign Title', Value: ad.title || '' },
    { Field: 'Media Type', Value: ad.media_type || '' },
    { Field: 'Duration', Value: ad.media_type === 'video' ? `${ad.duration}s` : 'N/A' },
    { Field: 'Status', Value: ad.status === 'active' ? 'Active' : 'Inactive' },
    { Field: 'Contact Number', Value: ad.contact_number || '' },
    { Field: 'Investor Name', Value: ad.title || '' },
    { Field: 'Assigned Machines', Value: machineNames.join(', ') || 'None' },
    { Field: 'Created Date', Value: ad.created_at ? new Date(ad.created_at).toLocaleDateString() : '' },
    { Field: '', Value: '' },
    { Field: '--- Performance Metrics ---', Value: '' },
    { Field: 'Total Machines', Value: ad.assigned_machines?.length || 0 },
    { Field: 'Report Generated', Value: new Date().toLocaleString() }
  ];

  const csvContent = reportData
    .map(row => `"${row.Field}","${row.Value}"`)
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const fileName = `Ad_Report_${(ad.title || 'campaign').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  saveAs(blob, fileName);
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  
  fileError.value = '';
  
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  
  if (!isVideo && !isImage) {
    fileError.value = 'Please select an image or video file';
    return;
  }
  
  if (isVideo) {
    formData.value.mediaType = 'video';
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      if (video.duration > MAX_VIDEO_DURATION) {
        fileError.value = 'Video duration exceeds the maximum limit of 1 minute';
        selectedFile.value = null;
        input.value = '';
      } else {
        formData.value.duration = Math.round(video.duration);
        selectedFile.value = file;
      }
    };
    video.src = URL.createObjectURL(file);
  } else {
    formData.value.mediaType = 'image';
    selectedFile.value = file;
  }
}

function toggleMachine(machineId: number) {
  const idx = formData.value.assignedMachines.indexOf(machineId);
  if (idx > -1) {
    formData.value.assignedMachines.splice(idx, 1);
  } else {
    formData.value.assignedMachines.push(machineId);
  }
}

function selectAllMachines() {
  formData.value.assignedMachines = machines.value.map(m => m.id);
}

function clearMachines() {
  formData.value.assignedMachines = [];
}

async function handleSubmit() {
  if (!formData.value.title.trim()) {
    alert('Please enter a campaign title');
    return;
  }
  if (!formData.value.contactNumber.trim()) {
    alert('Please enter a contact number');
    return;
  }
  
  isSubmitting.value = true;
  
  try {
    let mediaUrl = formData.value.mediaUrl;
    
    if (selectedFile.value) {
      const fileExt = selectedFile.value.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `advertisements/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, selectedFile.value);
      
      if (uploadError) {
        console.error('Upload error:', uploadError);
        mediaUrl = filePath;
      } else {
        const { data: urlData } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);
        mediaUrl = urlData.publicUrl;
      }
    }
    
    const adData: any = {
      title: formData.value.title,
      media_url: mediaUrl,
      media_type: formData.value.mediaType,
      duration: formData.value.mediaType === 'video' ? formData.value.duration : null,
      assigned_machines: formData.value.assignedMachines,
      contact_number: formData.value.contactNumber,
      status: formData.value.status,
      updated_at: new Date().toISOString()
    };
    
    if (editingAd.value) {
      const { error } = await supabase
        .from('advertisements')
        .update(adData)
        .eq('id', editingAd.value.id);
      
      if (error) throw error;
    } else {
      const { data: adminData } = await supabase
        .from('app_admins')
        .select('id')
        .eq('role', 'SUPER_ADMIN')
        .limit(1)
        .single();
      
      adData.created_by = adminData?.id;
      
      const { error } = await supabase
        .from('advertisements')
        .insert(adData);
      
      if (error) throw error;
    }
    
    closeModal();
    await fetchData();
    
  } catch (err: any) {
    console.error('Error saving advertisement:', err);
    alert('Failed to save: ' + err.message);
  } finally {
    isSubmitting.value = false;
  }
}

async function toggleStatus(ad: any) {
  if (!isSuperAdmin.value) return;
  const newStatus = ad.status === 'active' ? 'inactive' : 'active';
  const { error } = await supabase
    .from('advertisements')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', ad.id);

  if (!error) {
    ad.status = newStatus;
    totalActiveAds.value = advertisements.value.filter(a => a.status === 'active').length;
  }
};

async function deleteAd(id: number) {
  if (!isSuperAdmin.value) return;
  if (!confirm('Are you sure you want to delete this advertisement?')) return;
  
  const { error } = await supabase
    .from('advertisements')
    .delete()
    .eq('id', id);

  if (!error) {
    advertisements.value = advertisements.value.filter(ad => ad.id !== id);
    totalActiveAds.value = advertisements.value.filter(a => a.status === 'active').length;
    const uniqueContacts = new Set(advertisements.value.map(ad => ad.contact_number).filter(Boolean));
    totalInvestors.value = uniqueContacts.size;
  }
};

function getStatusBadge(status: string) {
  return status === 'active' 
    ? 'bg-green-100 text-green-800 border-green-200' 
    : 'bg-gray-100 text-gray-600 border-gray-200';
};
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 flex items-center">
          <Megaphone class="mr-3 text-blue-600" :size="28" />
          Digital Advertising
        </h1>
        <p class="text-gray-500 mt-1">Manage ad campaigns across {{ machines.length }} RVM units</p>
      </div>
      <div class="flex items-center gap-2">
        <button 
          v-if="isSuperAdmin"
          @click="handleRefresh"
          :disabled="loading"
          class="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50"
        >
          <RefreshCcw :size="14" :class="{ 'animate-spin': loading }" />
          <span>Refresh Data</span>
        </button>
        <button 
          v-if="isSuperAdmin"
          @click="openAddModal"
          class="flex items-center space-x-2 text-sm text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg shadow-sm transition-all"
        >
          <Plus :size="14" />
          <span>New Advertisement</span>
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-blue-100 rounded-lg">
            <Megaphone class="text-blue-600" :size="20" />
          </div>
          <div>
            <p class="text-sm text-gray-500">Total Active Ads</p>
            <p class="text-2xl font-bold text-gray-900">{{ totalActiveAds }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-green-100 rounded-lg">
            <LayoutGrid class="text-green-600" :size="20" />
          </div>
          <div>
            <p class="text-sm text-gray-500">Available Slots</p>
            <p class="text-2xl font-bold text-gray-900">{{ availableSlots }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-purple-100 rounded-lg">
            <Users class="text-purple-600" :size="20" />
          </div>
          <div>
            <p class="text-sm text-gray-500">Total Investors</p>
            <p class="text-2xl font-bold text-gray-900">{{ totalInvestors }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div class="flex flex-wrap gap-4 items-center">
        <div class="relative flex-1 min-w-[200px]">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" :size="18"/>
          <input 
            v-model="searchTerm"
            type="text" 
            placeholder="Search by campaign name or machine..."
            class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div class="text-sm text-gray-500">
          {{ filteredAdvertisements.length }} campaign{{ filteredAdvertisements.length !== 1 ? 's' : '' }}
        </div>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase font-semibold tracking-wider">
            <tr>
              <th class="px-6 py-4">Media Preview</th>
              <th class="px-6 py-4">Campaign Details</th>
              <th class="px-6 py-4">Duration</th>
              <th class="px-6 py-4">Assigned Machines</th>
              <th class="px-6 py-4">Investor Contact</th>
              <th class="px-6 py-4 text-center">Status</th>
              <th v-if="isSuperAdmin" class="px-6 py-4 text-right">Actions</th>
              <th v-else class="px-6 py-4 text-right">Access</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="loading && advertisements.length === 0">
              <td :colspan="7" class="px-6 py-10 text-center text-gray-400">Loading advertisements...</td>
            </tr>

            <tr v-for="ad in filteredAdvertisements" :key="ad.id" class="hover:bg-gray-50/80 transition-colors">
              <td class="px-6 py-5 align-top">
                <div class="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                  <img 
                    v-if="ad.media_type === 'image'" 
                    :src="ad.media_url" 
                    :alt="ad.title"
                    class="w-full h-full object-cover"
                    @error="($event.target as HTMLImageElement).style.display = 'none'"
                  />
                  <div v-else class="flex flex-col items-center gap-1 text-gray-500">
                    <Video :size="20" />
                    <span class="text-[10px]">Video</span>
                  </div>
                </div>
              </td>

              <td class="px-6 py-5 align-top">
                <div class="font-bold text-gray-900">{{ ad.title }}</div>
                <div class="flex items-center gap-2 mt-1">
                  <Image v-if="ad.media_type === 'image'" :size="12" class="text-gray-400" />
                  <Video v-else :size="12" class="text-gray-400" />
                  <span class="text-xs text-gray-500 capitalize">{{ ad.media_type }}</span>
                </div>
              </td>

              <td class="px-6 py-5 align-top">
                <span 
                  v-if="ad.media_type === 'video'" 
                  class="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200"
                >
                  {{ ad.duration }}s
                </span>
                <span v-else class="text-xs text-gray-400">-</span>
              </td>

              <td class="px-6 py-5 align-top">
                <div class="flex flex-wrap gap-1.5 max-w-[200px]">
                  <span 
                    v-for="(name, idx) in getMachineNames(ad.assigned_machines)" 
                    :key="idx"
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200"
                  >
                    <MapPin :size="10" class="mr-1" />
                    {{ name }}
                  </span>
                  <span 
                    v-if="ad.assigned_machines?.length > 3"
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-100"
                  >
                    +{{ ad.assigned_machines.length - 3 }}
                  </span>
                  <span v-if="!ad.assigned_machines?.length" class="text-xs text-gray-400">
                    No machines assigned
                  </span>
                </div>
              </td>

              <td class="px-6 py-5 align-top">
                <div class="inline-flex items-center text-xs font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">
                  <Phone :size="12" class="mr-1.5" />
                  {{ ad.contact_number }}
                </div>
              </td>

              <td class="px-6 py-5 align-top text-center">
                <span :class="`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(ad.status)}`">
                  {{ ad.status === 'active' ? 'Active' : 'Inactive' }}
                </span>
              </td>

              <td v-if="isSuperAdmin" class="px-6 py-5 align-top text-right">
                <div class="flex items-center justify-end gap-1">
                  <button 
                    @click="exportAdReport(ad)"
                    class="p-1.5 text-gray-500 hover:text-green-700 hover:bg-gray-100 rounded transition-all"
                    title="Export Report"
                  >
                    <FileText :size="14" />
                  </button>
                  <button 
                    @click="toggleStatus(ad)"
                    class="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-all"
                    :title="ad.status === 'active' ? 'Deactivate' : 'Activate'"
                  >
                    <Pause v-if="ad.status === 'active'" :size="14" />
                    <Play v-else :size="14" />
                  </button>
                  <button 
                    @click="openEditModal(ad)"
                    class="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-gray-100 rounded transition-all"
                    title="Edit"
                  >
                    <Pencil :size="14" />
                  </button>
                  <button 
                    @click="deleteAd(ad.id)"
                    class="p-1.5 text-gray-500 hover:text-red-700 hover:bg-gray-100 rounded transition-all"
                    title="Delete"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
              </td>
              <td v-else class="px-6 py-5 align-top text-right">
                <div class="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-400 bg-gray-50 rounded border border-gray-100">
                  <Eye :size="12" />
                  View Only
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div v-if="!loading && filteredAdvertisements.length === 0" class="p-10 text-center text-gray-500">
        <Megaphone :size="40" class="mx-auto mb-3 text-gray-300" />
        <p v-if="searchTerm">No campaigns match your search.</p>
        <p v-else-if="isSuperAdmin">No advertisements yet. Create your first campaign!</p>
        <p v-else>No advertisements available.</p>
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="p-6 border-b border-gray-200">
          <h2 class="text-xl font-bold text-gray-900">
            {{ editingAd ? 'Edit Campaign' : 'New Advertisement' }}
          </h2>
          <p class="text-sm text-gray-500 mt-1">
            {{ editingAd ? 'Update campaign details' : 'Create a new ad campaign' }}
          </p>
        </div>
        
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Campaign Title *</label>
            <input 
              v-model="formData.title"
              type="text" 
              class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter campaign name..."
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Media File *</label>
            <div class="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
              <input 
                type="file" 
                id="file-upload"
                accept="image/*,video/*"
                class="hidden"
                @change="handleFileSelect"
              />
              <label for="file-upload" class="cursor-pointer">
                <Upload class="mx-auto h-10 w-10 text-gray-400 mb-2" />
                <p class="text-sm text-gray-600">
                  Click to upload {{ formData.mediaType === 'image' ? 'image' : 'video' }}
                </p>
                <p class="text-xs text-gray-400 mt-1">
                  {{ formData.mediaType === 'video' ? `Max ${MAX_VIDEO_DURATION} seconds` : 'JPG, PNG, GIF supported' }}
                </p>
              </label>
              <div v-if="selectedFile" class="mt-3 flex items-center justify-center gap-2 text-sm text-green-600">
                <Check :size="16" />
                {{ selectedFile.name }}
              </div>
              <div v-if="formData.mediaUrl && !selectedFile" class="mt-3">
                <p class="text-xs text-gray-500 mb-1">Current file:</p>
                <img 
                  v-if="formData.mediaType === 'image'" 
                  :src="formData.mediaUrl" 
                  class="h-20 mx-auto object-contain rounded"
                />
                <video 
                  v-else 
                  :src="formData.mediaUrl" 
                  class="h-20 mx-auto object-contain rounded"
                  controls
                />
              </div>
              <p v-if="fileError" class="mt-2 text-sm text-red-500">{{ fileError }}</p>
            </div>
          </div>

          <div v-if="formData.mediaType === 'video'">
            <label class="block text-sm font-medium text-gray-700 mb-1">Video Duration</label>
            <div class="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border border-gray-200">
              {{ formData.duration }} seconds
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Assign Machines</label>
            <div class="relative">
              <button 
                type="button"
                @click="showMachineDropdown = !showMachineDropdown"
                class="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-left flex items-center justify-between"
              >
                <span class="text-gray-600">
                  {{ formData.assignedMachines.length > 0 
                    ? `${formData.assignedMachines.length} machine${formData.assignedMachines.length !== 1 ? 's' : ''} selected`
                    : 'Select machines...'
                  }}
                </span>
                <ChevronDown :size="16" class="text-gray-400" />
              </button>
              
              <div v-if="showMachineDropdown" class="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <div class="p-2 flex gap-2 border-b border-gray-100">
                  <button 
                    type="button"
                    @click="selectAllMachines"
                    class="text-xs text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <button 
                    type="button"
                    @click="clearMachines"
                    class="text-xs text-gray-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <div v-if="machines.length === 0" class="p-4 text-center text-sm text-gray-400">
                  No machines available
                </div>
                <label 
                  v-for="machine in machines" 
                  :key="machine.id"
                  class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input 
                    type="checkbox"
                    :checked="formData.assignedMachines.includes(machine.id)"
                    @change="toggleMachine(machine.id)"
                    class="rounded border-gray-300"
                  />
                  <MapPin :size="14" class="text-gray-400" />
                  <div>
                    <div class="text-sm text-gray-900">{{ machine.name }}</div>
                    <div class="text-xs text-gray-400">{{ machine.address }}</div>
                  </div>
                </label>
              </div>
            </div>
            <div v-if="formData.assignedMachines.length > 0" class="mt-2 flex flex-wrap gap-1">
              <span 
                v-for="name in getSelectedMachineNames()" 
                :key="name"
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700"
              >
                {{ name }}
              </span>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Investor Contact Number *</label>
            <div class="relative">
              <Phone class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" :size="18" />
              <input 
                v-model="formData.contactNumber"
                type="tel" 
                class="w-full pl-10 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+60 xxx xxx xxx"
              />
            </div>
          </div>

          <div v-if="editingAd">
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select 
              v-model="formData.status"
              class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="inactive">Inactive</option>
              <option value="active">Active</option>
            </select>
          </div>
        </div>

        <div class="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button 
            @click="closeModal"
            class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            @click="handleSubmit"
            :disabled="isSubmitting"
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {{ isSubmitting ? 'Saving...' : (editingAd ? 'Update Campaign' : 'Create Campaign') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>