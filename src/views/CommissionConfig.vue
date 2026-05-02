<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { supabase } from '../services/supabase';
import { Save, DollarSign } from 'lucide-vue-next';

const rates = ref([{ level: 1, rate: 5 }, { level: 2, rate: 2 }, { level: 3, rate: 1 }]);
const saving = ref(false);
const saved = ref(false);

const fetchConfig = async () => {
  const { data } = await supabase.from('commission_config').select('*').order('level');
  if (data?.length) rates.value = data.map(r => ({ level: r.level, rate: Number(r.rate) }));
};

const saveConfig = async () => {
  saving.value = true;
  saved.value = false;
  for (const r of rates.value) {
    await supabase.from('commission_config').upsert({ level: r.level, rate: r.rate }, { onConflict: 'level' });
  }
  saved.value = true;
  setTimeout(() => saved.value = false, 3000);
  saving.value = false;
};

onMounted(fetchConfig);
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-xl font-bold text-gray-900">Commission Settings</h2>
        <p class="text-sm text-gray-500 mt-1">Set revenue share % for each level</p>
      </div>
      <button @click="saveConfig" :disabled="saving"
        class="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl hover:bg-purple-700 text-sm font-bold transition-all disabled:opacity-50">
        <Save :size="18" /> {{ saving ? 'Saving...' : (saved ? 'Saved ✓' : 'Save') }}
      </button>
    </div>

    <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div class="p-6 border-b border-gray-100 bg-gray-50">
        <h3 class="font-bold text-gray-900">Revenue Sharing Tiers</h3>
        <p class="text-sm text-gray-500 mt-1">Each recycling submission generates commission for up to 3 levels.</p>
      </div>
      
      <div class="p-6 space-y-6">
        <div v-for="r in rates" :key="r.level" class="flex items-center justify-between p-4 rounded-xl bg-gray-50">
          <div class="flex items-center gap-4">
            <div class="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <DollarSign :size="20" class="text-purple-600" />
            </div>
            <div>
              <p class="font-bold text-gray-900">Level {{ r.level }}</p>
              <p class="text-xs text-gray-400" v-if="r.level === 1">Agency (machine owner)</p>
              <p class="text-xs text-gray-400" v-else>Introducer</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <input v-model.number="r.rate" type="number" step="0.1" min="0" max="100"
              class="w-20 px-3 py-2 border border-gray-300 rounded-lg text-right text-lg font-bold text-purple-700 focus:ring-2 focus:ring-purple-500" />
            <span class="text-lg font-bold text-gray-400">%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
