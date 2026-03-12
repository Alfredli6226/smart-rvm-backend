<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMerchantSettings } from '../../composables/useMerchantSettings'; 
import { supabase } from '../../services/supabase';
import { Save, Store, Server, RefreshCw, MapPin, Search, Settings2, ChevronDown } from 'lucide-vue-next';

const { 
    loading, saving, message, merchant, machines, 
    fetchData, saveSettings, fetchAddress 
} = useMerchantSettings();

const clients = ref<any[]>([]);
const selectedClientId = ref('');

// Fetch list of all clients for the dropdown
async function fetchClientList() {
    const { data } = await supabase
        .from('merchants')
        .select('id, name')
        .order('name');
    if (data) clients.value = data;
}

// When dropdown changes, load that client's data
const handleClientChange = () => {
    if (selectedClientId.value) {
        fetchData(selectedClientId.value);
    }
};

onMounted(() => {
    fetchClientList();
});
</script>

<template>
    <div class="p-6 max-w-7xl mx-auto space-y-8">
        
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-100 pb-8">
            
            <div class="flex items-center gap-4">
                <div class="h-14 w-14 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-sm border border-purple-100 shrink-0">
                    <Settings2 :size="28" />
                </div>
                <div>
                    <h1 class="text-xl font-bold text-gray-900 tracking-tight">Manage Client Configuration</h1>
                    <p class="text-sm text-gray-500 mt-1 font-medium">Select a client to configure their fleet locations and pricing.</p>
                </div>
            </div>
            
            <div class="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto bg-gray-50 p-1.5 rounded-2xl border border-gray-200">
                
                <div class="relative w-full sm:w-auto">
                    <select 
                        v-model="selectedClientId" 
                        @change="handleClientChange"
                        class="w-full sm:w-64 appearance-none bg-white border border-gray-200 text-gray-700 py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium text-sm shadow-sm hover:border-gray-300 transition-colors cursor-pointer"
                    >
                        <option value="" disabled>Select a Client...</option>
                        <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
                    </select>
                    <ChevronDown class="absolute right-3 top-3 text-gray-400 pointer-events-none" :size="16" />
                </div>

                <button 
                    @click="saveSettings" 
                    :disabled="saving || !selectedClientId"
                    class="w-full sm:w-auto flex items-center justify-center px-5 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95 text-sm font-bold whitespace-nowrap"
                >
                    <Save :size="16" class="mr-2" :class="{'animate-spin': saving}" />
                    {{ saving ? 'Saving...' : 'Save Config' }}
                </button>
            </div>
        </div>

        <div v-if="message" class="bg-green-100 text-green-700 px-4 py-3 rounded-lg border border-green-200 flex items-center animate-fade-in">
            <RefreshCw class="mr-2" :size="16"/> {{ message }}
        </div>

        <div v-if="!selectedClientId" class="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <Store class="mx-auto text-gray-300 mb-3" :size="48" />
            <h3 class="text-gray-500 font-medium">Please select a client to view their settings</h3>
        </div>

        <div v-else-if="loading" class="text-center py-20 text-gray-500">
            <RefreshCw class="mx-auto animate-spin mb-2" :size="24" />
            Loading configuration...
        </div>

        <div v-else class="space-y-8 animate-fade-in">
            
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
                <div class="flex items-center gap-2">
                    <span class="text-sm font-bold text-gray-600 uppercase">Currency:</span>
                    <input v-model="merchant.currency_symbol" class="w-20 p-2 text-center font-bold border border-gray-200 rounded-lg uppercase focus:ring-2 focus:ring-purple-200 outline-none" placeholder="RM" />
                </div>
                <div class="h-6 w-px bg-gray-200"></div>
                <div class="flex items-center gap-2 flex-1">
                    <span class="text-sm font-bold text-gray-600 uppercase">Merchant Name:</span>
                    <input v-model="merchant.name" class="flex-1 p-2 font-medium border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-200 outline-none" />
                </div>
            </div>

            <div class="space-y-6">
                <div class="flex items-center gap-2 pb-2 border-b border-gray-200">
                    <Server class="text-gray-600" :size="20"/>
                    <h3 class="font-bold text-gray-800">Fleet Units ({{ machines.length }})</h3>
                </div>

                <div v-for="m in machines" :key="m.id" class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-shadow hover:shadow-md">
                    
                    <div class="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-4">
                        <div class="h-12 w-12 rounded-xl flex items-center justify-center font-mono text-xs font-bold border shrink-0 shadow-sm"
                             :class="m.name.toLowerCase().includes('uco') ? 'bg-orange-100 text-orange-600 border-orange-200' : 'bg-green-100 text-green-600 border-green-200'">
                            {{ m.name.toLowerCase().includes('uco') ? 'OIL' : 'RVM' }}
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center justify-between">
                                <div class="text-[10px] text-gray-400 font-mono uppercase tracking-wide">ID: {{ m.device_no }}</div>
                                <span :class="m.is_active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-200 text-gray-500 border-gray-300'" 
                                      class="text-[10px] uppercase font-bold px-2 py-0.5 rounded border">
                                    {{ m.is_active ? 'Active' : 'Inactive' }}
                                </span>
                            </div>
                            <input v-model="m.name" type="text" class="text-lg font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none w-full transition-colors" placeholder="Machine Name" />
                        </div>
                    </div>

                    <div class="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                        
                        <div class="space-y-4 border-r border-gray-100 pr-0 lg:pr-8">
                            <h4 class="text-xs font-bold text-gray-400 uppercase flex items-center mb-3">
                                <MapPin :size="12" class="mr-2"/> Location & Contact
                            </h4>
                            
                            <div class="grid grid-cols-2 gap-3">
                                <input v-model="m.location_name" placeholder="Location Name (Lobby)" class="text-sm p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none" />
                                <input v-model="m.maintenance_contact" placeholder="Support Phone" class="text-sm p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none" />
                            </div>

                            <div class="relative">
                                <textarea v-model="m.address" rows="2" placeholder="Full Address..." class="w-full text-xs p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none resize-none pr-8"></textarea>
                                <button @click="fetchAddress(m)" class="absolute right-2 top-2 text-gray-400 hover:text-blue-600 transition-colors" title="Auto-fill Address">
                                    <Search :size="14" />
                                </button>
                            </div>

                            <div class="flex gap-2">
                                <input v-model="m.latitude" placeholder="Lat" class="w-1/2 text-xs p-2 border border-gray-200 rounded-lg font-mono outline-none focus:border-blue-500" />
                                <input v-model="m.longitude" placeholder="Long" class="w-1/2 text-xs p-2 border border-gray-200 rounded-lg font-mono outline-none focus:border-blue-500" />
                            </div>
                        </div>

                        <div class="space-y-4">
                            <h4 class="text-xs font-bold text-gray-400 uppercase flex items-center mb-3">
                                <Settings2 :size="12" class="mr-2"/> Pricing Configuration <span class="ml-auto text-[10px] bg-gray-100 px-2 rounded">per kg</span>
                            </h4>

                            <div v-if="m.name.toLowerCase().includes('uco')" class="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-xs font-bold text-orange-800 uppercase">Bin Type</label>
                                    <input v-model="m.config_bin_1" class="text-[10px] font-bold bg-white px-2 py-1 rounded text-orange-700 border border-orange-200 outline-none w-32" />
                                </div>
                                <div class="relative">
                                    <span class="absolute left-3 top-2.5 text-gray-500 font-bold">{{ merchant.currency_symbol }}</span>
                                    <input v-model="m.rate_uco" type="number" step="0.01" class="w-full pl-10 p-2.5 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-200 outline-none font-mono text-lg font-bold text-orange-900 bg-white" />
                                </div>
                            </div>

                            <div v-else class="space-y-3">
                                <div class="bg-green-50 p-3 rounded-xl border border-green-100 flex items-center gap-3">
                                    <div class="w-1/3">
                                        <label class="text-[10px] font-bold text-green-800 uppercase block mb-1">Bin 1 Config</label>
                                        <input v-model="m.config_bin_1" class="w-full text-[10px] bg-white px-2 py-1.5 rounded border border-green-200 outline-none font-bold text-green-700" placeholder="e.g. Plastic/Can" />
                                    </div>
                                    <div class="flex-1">
                                        <label class="text-[10px] font-bold text-green-800 uppercase block mb-1">Price / kg</label>
                                        <div class="relative">
                                            <span class="absolute left-3 top-1.5 text-gray-400 font-bold text-xs">{{ merchant.currency_symbol }}</span>
                                            <input v-model="m._comboRate" type="number" step="0.01" class="w-full pl-8 p-1.5 border border-green-200 rounded font-mono font-bold text-green-900 outline-none focus:ring-1 focus:ring-green-300" />
                                        </div>
                                    </div>
                                </div>

                                <div class="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center gap-3">
                                    <div class="w-1/3">
                                        <label class="text-[10px] font-bold text-blue-800 uppercase block mb-1">Bin 2 Config</label>
                                        <input v-model="m.config_bin_2" class="w-full text-[10px] bg-white px-2 py-1.5 rounded border border-blue-200 outline-none font-bold text-blue-700" placeholder="e.g. Paper" />
                                    </div>
                                    <div class="flex-1">
                                        <label class="text-[10px] font-bold text-blue-800 uppercase block mb-1">Price / kg</label>
                                        <div class="relative">
                                            <span class="absolute left-3 top-1.5 text-gray-400 font-bold text-xs">{{ merchant.currency_symbol }}</span>
                                            <input v-model="m.rate_paper" type="number" step="0.01" class="w-full pl-8 p-1.5 border border-blue-200 rounded font-mono font-bold text-blue-900 outline-none focus:ring-1 focus:ring-blue-300" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>
</template>