<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useCustomerService } from '../composables/useCustomerService';

const router = useRouter();
const { tickets, loading, stats, usingMock, loadTickets } = useCustomerService();
const filter = reactive({ search: '', status: '', category: '', priority: '', lead_score: '' });

const visibleTickets = computed(() => tickets.value);
const applyFilters = () => loadTickets({ ...filter });
const openTicket = (id: string) => router.push(`/customer-service/${id}`);

onMounted(applyFilters);
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Customer Service Inbox</h1>
        <p class="text-sm text-gray-500">Support tickets, complaints, and inbound sales enquiries in one place.</p>
      </div>
      <div v-if="usingMock" class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Mock mode</div>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
      <div class="rounded-xl bg-white p-4 shadow-sm border"><p class="text-xs text-gray-500">Total</p><p class="text-2xl font-bold">{{ stats.total }}</p></div>
      <div class="rounded-xl bg-white p-4 shadow-sm border"><p class="text-xs text-gray-500">New</p><p class="text-2xl font-bold text-blue-600">{{ stats.open }}</p></div>
      <div class="rounded-xl bg-white p-4 shadow-sm border"><p class="text-xs text-gray-500">Urgent / Hot</p><p class="text-2xl font-bold text-red-600">{{ stats.urgent }}</p></div>
      <div class="rounded-xl bg-white p-4 shadow-sm border"><p class="text-xs text-gray-500">Pending</p><p class="text-2xl font-bold text-orange-600">{{ stats.inProgress }}</p></div>
    </div>

    <div class="rounded-xl bg-white p-4 shadow-sm border space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
        <input v-model="filter.search" @input="applyFilters" placeholder="Search customer / company" class="rounded-lg border px-3 py-2 text-sm" />
        <select v-model="filter.status" @change="applyFilters" class="rounded-lg border px-3 py-2 text-sm"><option value="">All statuses</option><option value="new">New</option><option value="pending_human">Pending Human</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option></select>
        <select v-model="filter.category" @change="applyFilters" class="rounded-lg border px-3 py-2 text-sm"><option value="">All categories</option><option value="support">Support</option><option value="sales">Sales</option><option value="complaint">Complaint</option><option value="maintenance">Maintenance</option></select>
        <select v-model="filter.priority" @change="applyFilters" class="rounded-lg border px-3 py-2 text-sm"><option value="">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select>
        <select v-model="filter.lead_score" @change="applyFilters" class="rounded-lg border px-3 py-2 text-sm"><option value="">All lead scores</option><option value="cold">Cold</option><option value="warm">Warm</option><option value="hot">Hot</option></select>
      </div>
    </div>

    <div class="rounded-xl bg-white shadow-sm border overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50 text-gray-500"><tr><th class="px-4 py-3 text-left">Customer</th><th class="px-4 py-3 text-left">Category</th><th class="px-4 py-3 text-left">Priority</th><th class="px-4 py-3 text-left">Lead</th><th class="px-4 py-3 text-left">AI Summary</th><th class="px-4 py-3 text-left">Assigned</th><th class="px-4 py-3 text-left"></th></tr></thead>
          <tbody>
            <tr v-if="loading"><td colspan="7" class="px-4 py-6 text-center text-gray-500">Loading...</td></tr>
            <tr v-for="ticket in visibleTickets" :key="ticket.id" class="border-t hover:bg-gray-50">
              <td class="px-4 py-3"><div class="font-medium text-gray-900">{{ ticket.customer_name || 'Unknown' }}</div><div class="text-xs text-gray-500">{{ ticket.customer_phone || ticket.source || ticket.ticket_number }}</div></td>
              <td class="px-4 py-3 capitalize">{{ ticket.category }}</td>
              <td class="px-4 py-3 capitalize">{{ ticket.priority }}</td>
              <td class="px-4 py-3 uppercase font-semibold">{{ ticket.lead_score || '-' }}</td>
              <td class="px-4 py-3 text-gray-600 max-w-md">{{ ticket.ai_summary }}</td>
              <td class="px-4 py-3">{{ ticket.assigned_to || 'Unassigned' }}</td>
              <td class="px-4 py-3 text-right"><button @click="openTicket(ticket.id)" class="rounded-lg bg-emerald-600 px-3 py-1.5 text-white">Open</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
