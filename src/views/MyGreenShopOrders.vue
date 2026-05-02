<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">🛍️ MyGreenShop Orders</h1>
        <p class="text-sm text-gray-500 mt-1">View and manage all voucher and product redemptions</p>
      </div>
      <div class="flex items-center gap-3">
        <select v-model="statusFilter" class="p-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Processing">Processing</option>
          <option value="Shipped">Shipped</option>
          <option value="Completed">Completed</option>
          <option value="Done">Done</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <select v-model="typeFilter" class="p-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All Types</option>
          <option value="voucher">Vouchers</option>
          <option value="product">Products</option>
        </select>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <p class="text-2xl font-bold text-gray-800">{{ stats.total }}</p>
        <p class="text-xs text-gray-500">Total Orders</p>
      </div>
      <div class="bg-amber-50 rounded-xl p-4 shadow-sm border border-amber-100">
        <p class="text-2xl font-bold text-amber-700">{{ stats.pending }}</p>
        <p class="text-xs text-amber-500">Pending</p>
      </div>
      <div class="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-100">
        <p class="text-2xl font-bold text-blue-700">{{ stats.processing }}</p>
        <p class="text-xs text-blue-500">Processing</p>
      </div>
      <div class="bg-green-50 rounded-xl p-4 shadow-sm border border-green-100">
        <p class="text-2xl font-bold text-green-700">{{ stats.done }}</p>
        <p class="text-xs text-green-500">Completed</p>
      </div>
    </div>

    <!-- Orders Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div v-if="loading" class="p-8 text-center text-gray-400">Loading orders...</div>
      
      <div v-else-if="filteredOrders.length === 0" class="p-8 text-center text-gray-400">
        No orders found
      </div>

      <table v-else class="w-full">
        <thead class="bg-gray-50 border-b border-gray-100">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Order</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Item</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="order in filteredOrders" :key="order.id" 
              class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3">
              <span class="text-xs font-mono text-gray-500">#{{ order.order_id?.slice(-8).toUpperCase() }}</span>
            </td>
            <td class="px-4 py-3">
              <div>
                <p class="text-sm font-medium text-gray-800">{{ getAddressName(order) }}</p>
                <p class="text-xs text-gray-400">{{ order.user_phone }}</p>
              </div>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <span>{{ order.item_type === 'voucher' ? '🎫' : '🎁' }}</span>
                <span class="text-sm">{{ order.item_name }}</span>
              </div>
            </td>
            <td class="px-4 py-3">
              <span class="text-sm font-semibold text-green-600">RM {{ Number(order.amount).toFixed(2) }}</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">
              {{ new Date(order.created_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' }) }}
            </td>
            <td class="px-4 py-3">
              <span :class="'px-2 py-1 rounded-full text-xs font-semibold ' + statusClass(order.status)">
                {{ order.status }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <button @click="viewOrder(order)" class="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition">
                  View
                </button>
                <select v-model="order.status" @change="updateStatus(order)" 
                        class="p-1.5 border border-gray-200 rounded-lg text-xs bg-white">
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option :value="order.item_type === 'voucher' ? 'Done' : 'Shipped'">
                    {{ order.item_type === 'voucher' ? 'Done (Sent)' : 'Shipped' }}
                  </option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Order Detail Modal -->
    <div v-if="selectedOrder" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="selectedOrder = null">
      <div class="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div class="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-lg font-bold text-gray-800">📋 Order Details</h2>
          <button @click="selectedOrder = null" class="p-1 hover:bg-gray-100 rounded-lg">✕</button>
        </div>
        <div class="p-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-gray-400">Order ID</p>
              <p class="text-sm font-semibold">#{{ selectedOrder.order_id?.slice(-8).toUpperCase() }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Status</p>
              <span :class="'px-2 py-0.5 rounded-full text-xs font-semibold inline-block mt-0.5 ' + statusClass(selectedOrder.status)">
                {{ selectedOrder.status }}
              </span>
            </div>
            <div>
              <p class="text-xs text-gray-400">Type</p>
              <p class="text-sm">{{ selectedOrder.item_type === 'voucher' ? '🎫 Voucher' : '🎁 Product' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Amount</p>
              <p class="text-sm font-bold text-green-600">RM {{ Number(selectedOrder.amount).toFixed(2) }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Item</p>
              <p class="text-sm">{{ selectedOrder.item_name }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">User Phone</p>
              <p class="text-sm font-mono">{{ selectedOrder.user_phone }}</p>
            </div>
            <div class="col-span-2">
              <p class="text-xs text-gray-400">Date</p>
              <p class="text-sm">{{ new Date(selectedOrder.created_at).toLocaleString('en-MY') }}</p>
            </div>
          </div>

          <!-- Shipping Address (for products) -->
          <div v-if="selectedOrder.shipping_address" class="border-t border-gray-100 pt-4">
            <p class="text-xs font-bold text-gray-700 mb-2">📍 Shipping Address</p>
            <div class="bg-teal-50 rounded-xl p-4 text-sm text-teal-800">
              <p>{{ selectedOrder.shipping_address.name }}</p>
              <p>{{ selectedOrder.shipping_address.phone }}</p>
              <p>{{ selectedOrder.shipping_address.line1 }}</p>
              <p v-if="selectedOrder.shipping_address.line2">{{ selectedOrder.shipping_address.line2 }}</p>
              <p>{{ selectedOrder.shipping_address.city }}, {{ selectedOrder.shipping_address.state }} {{ selectedOrder.shipping_address.postcode }}</p>
            </div>
          </div>

          <!-- Voucher Info -->
          <div v-else class="border-t border-gray-100 pt-4">
            <p class="text-xs text-purple-600">📱 Deliver voucher code via WhatsApp to {{ selectedOrder.user_phone }}</p>
          </div>

          <!-- Status Update -->
          <div class="border-t border-gray-100 pt-4">
            <p class="text-xs font-bold text-gray-700 mb-2">Update Status</p>
            <div class="flex gap-2 flex-wrap">
              <button v-for="s in ['Pending', 'Processing', 'Done', 'Shipped', 'Completed']" :key="s"
                @click="selectedOrder.status = s; updateStatus(selectedOrder)"
                :class="'px-3 py-1.5 rounded-lg text-xs font-semibold transition ' + (
                  selectedOrder.status === s ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )">
                {{ s }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { supabase } from '../services/supabase';

const loading = ref(true);
const orders = ref<any[]>([]);
const statusFilter = ref('');
const typeFilter = ref('');
const selectedOrder = ref<any>(null);

const filteredOrders = computed(() => {
  let result = orders.value;
  if (statusFilter.value) result = result.filter(o => o.status === statusFilter.value);
  if (typeFilter.value) result = result.filter(o => o.item_type === typeFilter.value);
  return result;
});

const stats = computed(() => ({
  total: orders.value.length,
  pending: orders.value.filter(o => o.status === 'Pending').length,
  processing: orders.value.filter(o => o.status === 'Processing').length,
  done: orders.value.filter(o => ['Completed', 'Done'].includes(o.status)).length
}));

const statusClass = (s: string) => {
  if (['Completed', 'Done'].includes(s)) return 'bg-green-100 text-green-700';
  if (s === 'Processing' || s === 'Shipped') return 'bg-blue-100 text-blue-700';
  if (s === 'Pending') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
};

const getAddressName = (order: any) => {
  if (order.shipping_address?.name) return order.shipping_address.name;
  if (order.item_type === 'voucher') return 'Voucher (WhatsApp)';
  return 'No address';
};

const fetchOrders = async () => {
  loading.value = true;
  try {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) orders.value = data;
  } catch (err) {
    console.error('Failed to load orders:', err);
  } finally {
    loading.value = false;
  }
};

const updateStatus = async (order: any) => {
  try {
    await supabase
      .from('orders')
      .update({ status: order.status, updated_at: new Date().toISOString() })
      .eq('id', order.id);
  } catch (err) {
    console.error('Failed to update status:', err);
  }
};

const viewOrder = (order: any) => {
  selectedOrder.value = order;
};

onMounted(() => {
  fetchOrders();
});
</script>
