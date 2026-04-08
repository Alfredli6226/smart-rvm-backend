<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { useLeads } from '../composables/useLeads';

const { leads, loading, stats, usingMock, loadLeads, updateLead } = useLeads();
const filter = reactive({ search: '', status: '', lead_score: '', source: '' });
const applyFilters = () => loadLeads({ ...filter });
onMounted(applyFilters);
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Leads Manager</h1>
        <p class="text-sm text-gray-500">Track hot, warm, and cold enquiries for MyGreenPlus.</p>
      </div>
      <div v-if="usingMock" class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Mock mode</div>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
      <div class="rounded-xl bg-white p-4 shadow-sm border"><p class="text-xs text-gray-500">Total</p><p class="text-2xl font-bold">{{ stats.total }}</p></div>
      <div class="rounded-xl bg-white p-4 shadow-sm border"><p class="text-xs text-gray-500">Hot</p><p class="text-2xl font-bold text-red-600">{{ stats.hot }}</p></div>
      <div class="rounded-xl bg-white p-4 shadow-sm border"><p class="text-xs text-gray-500">Warm</p><p class="text-2xl font-bold text-orange-600">{{ stats.warm }}</p></div>
      <div class="rounded-xl bg-white p-4 shadow-sm border"><p class="text-xs text-gray-500">Follow-up</p><p class="text-2xl font-bold text-blue-600">{{ stats.qualified }}</p></div>
    </div>

    <div class="rounded-xl bg-white p-4 shadow-sm border grid grid-cols-1 md:grid-cols-4 gap-3">
      <input v-model="filter.search" @input="applyFilters" placeholder="Search lead" class="rounded-lg border px-3 py-2 text-sm" />
      <select v-model="filter.status" @change="applyFilters" class="rounded-lg border px-3 py-2 text-sm"><option value="">All statuses</option><option value="new">New</option><option value="qualified">Qualified</option><option value="proposal_sent">Proposal Sent</option><option value="follow_up">Follow Up</option><option value="closed_won">Closed Won</option></select>
      <select v-model="filter.lead_score" @change="applyFilters" class="rounded-lg border px-3 py-2 text-sm"><option value="">All scores</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option></select>
      <input v-model="filter.source" @input="applyFilters" placeholder="Source" class="rounded-lg border px-3 py-2 text-sm" />
    </div>

    <div class="rounded-xl bg-white shadow-sm border overflow-hidden">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 text-gray-500"><tr><th class="px-4 py-3 text-left">Lead</th><th class="px-4 py-3 text-left">Interest</th><th class="px-4 py-3 text-left">Score</th><th class="px-4 py-3 text-left">Status</th><th class="px-4 py-3 text-left">AI Summary</th><th class="px-4 py-3 text-left">Next Follow Up</th></tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="6" class="px-4 py-6 text-center text-gray-500">Loading...</td></tr>
          <tr v-for="lead in leads" :key="lead.id" class="border-t">
            <td class="px-4 py-3"><div class="font-medium">{{ lead.contact_person }}</div><div class="text-xs text-gray-500">{{ lead.company_name || lead.phone }}</div></td>
            <td class="px-4 py-3">{{ lead.inquiry_type }}</td>
            <td class="px-4 py-3">
              <select class="rounded-lg border px-2 py-1 text-sm" :value="lead.lead_score" @change="updateLead(lead.id, { lead_score: ($event.target as HTMLSelectElement).value as any })">
                <option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option>
              </select>
            </td>
            <td class="px-4 py-3">
              <select class="rounded-lg border px-2 py-1 text-sm" :value="lead.status" @change="updateLead(lead.id, { status: ($event.target as HTMLSelectElement).value as any })">
                <option value="new">New</option><option value="qualified">Qualified</option><option value="proposal_sent">Proposal Sent</option><option value="follow_up">Follow Up</option><option value="closed_won">Closed Won</option><option value="closed_lost">Closed Lost</option>
              </select>
            </td>
            <td class="px-4 py-3 text-gray-600 max-w-md">{{ lead.ai_summary }}</td>
            <td class="px-4 py-3 text-gray-600">{{ lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleString() : '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
