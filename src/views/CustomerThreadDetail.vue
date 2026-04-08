<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useCustomerService } from '../composables/useCustomerService';

const route = useRoute();
const { selectedTicket, messages, loading, usingMock, loadTicket, loadMessages, updateTicket, addMessage } = useCustomerService();
const reply = ref('');
const internal = ref(false);

const ticketId = route.params.id as string;

const sendReply = async () => {
  if (!reply.value.trim()) return;
  await addMessage(ticketId, { sender_type: internal.value ? 'agent' : 'agent', sender_name: internal.value ? 'Staff Note' : 'AI Assistant', content: reply.value.trim(), message_type: 'message', read_by_agent: true, read_by_customer: false, is_internal: internal.value });
  reply.value = '';
  internal.value = false;
};

onMounted(async () => {
  await loadTicket(ticketId);
  await loadMessages(ticketId);
});
</script>

<template>
  <div class="space-y-6" v-if="selectedTicket">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ selectedTicket.customer_name || 'Customer Thread' }}</h1>
        <p class="text-sm text-gray-500">{{ selectedTicket.customer_phone || selectedTicket.source || selectedTicket.ticket_number }}</p>
      </div>
      <div v-if="usingMock" class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Mock mode</div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 rounded-xl bg-white border shadow-sm p-4 space-y-4">
        <div class="space-y-3 max-h-[500px] overflow-y-auto">
          <div v-for="message in messages" :key="message.id" class="rounded-xl p-3" :class="message.is_internal ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'">
            <div class="flex items-center justify-between text-xs text-gray-500"><span>{{ message.sender_name || message.sender_type }}</span><span>{{ new Date(message.created_at).toLocaleString() }}</span></div>
            <p class="mt-2 whitespace-pre-wrap text-sm text-gray-800">{{ message.content }}</p>
          </div>
        </div>

        <div class="space-y-3 border-t pt-4">
          <textarea v-model="reply" rows="4" class="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Reply to customer or add internal note..."></textarea>
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 text-sm text-gray-600"><input v-model="internal" type="checkbox" /> Internal note</label>
            <button @click="sendReply" class="rounded-lg bg-emerald-600 px-4 py-2 text-white">Send</button>
          </div>
        </div>
      </div>

      <div class="rounded-xl bg-white border shadow-sm p-4 space-y-4">
        <div>
          <p class="text-xs text-gray-500">AI Summary</p>
          <p class="mt-1 text-sm text-gray-800">{{ selectedTicket.ai_summary || 'No summary yet' }}</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500">Status</label>
            <select class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" :value="selectedTicket.status" @change="updateTicket(ticketId, { status: ($event.target as HTMLSelectElement).value as any })">
              <option value="new">New</option><option value="ai_replied">AI Replied</option><option value="pending_human">Pending Human</option><option value="in_progress">In Progress</option><option value="waiting_customer">Waiting Customer</option><option value="resolved">Resolved</option><option value="escalated">Escalated</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500">Priority</label>
            <select class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" :value="selectedTicket.priority" @change="updateTicket(ticketId, { priority: ($event.target as HTMLSelectElement).value as any })">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500">Lead Score</label>
            <select class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" :value="selectedTicket.lead_score" @change="updateTicket(ticketId, { lead_score: ($event.target as HTMLSelectElement).value as any })">
              <option value="cold">Cold</option><option value="warm">Warm</option><option value="hot">Hot</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500">Assigned To</label>
            <input class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" :value="selectedTicket.assigned_to || ''" @change="updateTicket(ticketId, { assigned_to: ($event.target as HTMLInputElement).value })" />
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500">Description</label>
          <textarea class="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows="3" :value="selectedTicket.description || ''" @change="updateTicket(ticketId, { description: ($event.target as HTMLTextAreaElement).value })"></textarea>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="text-gray-500">{{ loading ? 'Loading thread...' : 'Thread not found' }}</div>
</template>
