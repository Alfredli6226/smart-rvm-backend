<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { supabase } from '../services/supabase';
import { Truck, Phone, MapPin, Weight, Search, Plus, ChevronLeft, ChevronRight } from 'lucide-vue-next';

const orders = ref<any[]>([]);
const loading = ref(false);
const statusFilter = ref('ALL');
const showNewModal = ref(false);

const newOrder = ref({
  customer_name: '', customer_phone: '', customer_address: '',
  waste_type: '', estimated_weight: 0, pickup_date: '', notes: ''
});

const filteredOrders = computed(() => {
  if (statusFilter.value === 'ALL') return orders.value;
  return orders.value.filter(o => o.status === statusFilter.value);
});

const fetchOrders = async () => {
  loading.value = true;
  const { data } = await supabase.from('bulk_orders')
    .select('*').order('created_at', { ascending: false });
  if (data) orders.value = data;
  loading.value = false;
};

const updateStatus = async (id: string, status: string) => {
  await supabase.from('bulk_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  await fetchOrders();
};

const createOrder = async () => {
  if (!newOrder.value.customer_name) return;
  const orderNo = 'BCO-' + Date.now().toString().slice(-8);
  await supabase.from('bulk_orders').insert({
    ...newOrder.value,
    order_no: orderNo,
    status: 'PENDING',
    merchant_id: '11111111-1111-1111-1111-111111111111',
    pickup_date: newOrder.value.pickup_date ? new Date(newOrder.value.pickup_date).toISOString() : null,
  });
  showNewModal.value = false;
  newOrder.value = { customer_name: '', customer_phone: '', customer_address: '', waste_type: '', estimated_weight: 0, pickup_date: '', notes: '' };
  await fetchOrders();
};

const statusColor = (s: string) => ({
  'PENDING': 'bg-amber-100 text-amber-700',
  'ASSIGNED': 'bg-blue-100 text-blue-700',
  'IN_PROGRESS': 'bg-indigo-100 text-indigo-700',
  'COMPLETED': 'bg-green-100 text-green-700',
  'CANCELLED': 'bg-red-100 text-red-700',
}[s] || 'bg-gray-100 text-gray-700');

onMounted(fetchOrders);
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-xl font-bold text-gray-900">Bulk Collection</h2>
        <p class="text-sm text-gray-500 mt-1">Manage pickup orders for large recyclable collections</p>
      </div>
      <button @click="showNewModal = true"
        class="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl hover:bg-purple-700 text-sm font-bold">
        <Plus :size="18" /> New Order
      </button>
    </div>

    <div class="flex gap-2">
      <button v-for="s in ['ALL','PENDING','ASSIGNED','IN_PROGRESS','COMPLETED']" :key="s"
        @click="statusFilter = s"
        :class="statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
        {{ s === 'ALL' ? 'All' : s }}
      </button>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>

    <div v-else-if="filteredOrders.length === 0" class="bg-white rounded-2xl border border-gray-200 p-12 text-center">
      <Truck :size="48" class="text-gray-300 mx-auto mb-4" />
      <p class="text-gray-500 text-sm">No bulk collection orders yet</p>
    </div>

    <div v-else class="space-y-3">
      <div v-for="order in filteredOrders" :key="order.id"
        class="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <span class="text-sm font-bold text-gray-900">{{ order.order_no || order.id.slice(0,8) }}</span>
              <span class="text-xs font-bold px-2 py-0.5 rounded-full" :class="statusColor(order.status)">{{ order.status }}</span>
            </div>
            <p class="text-base font-bold text-gray-800">{{ order.customer_name }}</p>
            <p class="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <Phone :size="14" /> {{ order.customer_phone || '-' }}
            </p>
            <p class="text-sm text-gray-500 flex items-center gap-1" v-if="order.customer_address">
              <MapPin :size="14" /> {{ order.customer_address }}
            </p>
            <div class="flex items-center gap-4 mt-2 text-xs text-gray-400">
              <span class="flex items-center gap-1"><Weight :size="14" /> {{ order.estimated_weight || 0 }} kg</span>
              <span>{{ order.waste_type || 'General' }}</span>
              <span v-if="order.pickup_date">📅 {{ new Date(order.pickup_date).toLocaleDateString() }}</span>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <select @change="(e: any) => updateStatus(order.id, e.target.value)"
              class="text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white">
              <option value="PENDING" :selected="order.status === 'PENDING'">Pending</option>
              <option value="ASSIGNED" :selected="order.status === 'ASSIGNED'">Assigned</option>
              <option value="IN_PROGRESS" :selected="order.status === 'IN_PROGRESS'">In Progress</option>
              <option value="COMPLETED" :selected="order.status === 'COMPLETED'">Completed</option>
              <option value="CANCELLED" :selected="order.status === 'CANCELLED'">Cancelled</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- New Order Modal -->
    <div v-if="showNewModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showNewModal = false">
      <div class="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4">
        <h3 class="text-lg font-bold text-gray-900 mb-4">New Bulk Collection Order</h3>
        <div class="space-y-3">
          <input v-model="newOrder.customer_name" placeholder="Customer name *"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input v-model="newOrder.customer_phone" placeholder="Phone number"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input v-model="newOrder.customer_address" placeholder="Pickup address"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <div class="flex gap-3">
            <input v-model="newOrder.waste_type" placeholder="Waste type (e.g. UCO, Plastic)"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model.number="newOrder.estimated_weight" type="number" placeholder="Weight (kg)"
              class="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <input v-model="newOrder.pickup_date" type="datetime-local"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <textarea v-model="newOrder.notes" placeholder="Notes"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows="2"></textarea>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showNewModal = false" class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg">Cancel</button>
          <button @click="createOrder" class="px-4 py-2 text-sm font-bold text-white bg-purple-600 rounded-lg hover:bg-purple-700">Create Order</button>
        </div>
      </div>
    </div>
  </div>
</template>
