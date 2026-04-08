import { computed, ref } from 'vue';
import { supabase } from '../services/supabase';
import type { TicketFilters, CustomerServiceMessage, CustomerServiceTicket } from '../types';

const now = () => new Date().toISOString();

const mockTickets: CustomerServiceTicket[] = [
  {
    id: 'cs-1', ticket_number: 'CS-0001', subject: 'Quotation request for food waste machine', description: 'Corporate prospect asking for quotation for 8 outlets in KL.',
    customer_name: 'Jason Lim', customer_phone: '+60123456789', customer_email: 'jason@example.com', company_name: 'ABC Restaurant Group' as any,
    category: 'Sales', priority: 'High', status: 'Open', lead_score: 'hot', assigned_to: 'Alfred',
    source: 'WhatsApp', ai_summary: 'Corporate F&B lead asking for urgent quotation.', ai_sentiment: 'positive', ai_tags: ['corporate', 'quotation'],
    created_at: now(), updated_at: now(), custom_fields: { company_name: 'ABC Restaurant Group' }
  } as unknown as CustomerServiceTicket,
  {
    id: 'cs-2', ticket_number: 'CS-0002', subject: 'Points not credited', description: 'Merchant says customer points are missing after submission.',
    customer_name: 'Nur Ain', customer_phone: '+60119876543', category: 'Support', priority: 'Medium', status: 'In Progress', lead_score: 'warm', assigned_to: 'Support Team',
    source: 'Web', ai_summary: 'Likely issue between submission log and rewards sync.', ai_sentiment: 'neutral', ai_tags: ['points', 'rvm'],
    created_at: now(), updated_at: now(), custom_fields: { company_name: 'Merchant Portal User' }
  } as unknown as CustomerServiceTicket,
];

const mockMessages: Record<string, CustomerServiceMessage[]> = {
  'cs-1': [{ id: 'msg-1', ticket_id: 'cs-1', message_type: 'message', content: 'Hi, I want a quotation for 8 outlets in KL.', sender_type: 'customer', sender_name: 'Jason Lim', is_internal: false, read_by_agent: true, read_by_customer: true, created_at: now(), updated_at: now() }],
  'cs-2': [{ id: 'msg-2', ticket_id: 'cs-2', message_type: 'message', content: 'My customer recycled but no points were reflected.', sender_type: 'customer', sender_name: 'Nur Ain', is_internal: false, read_by_agent: true, read_by_customer: true, created_at: now(), updated_at: now() }],
};

export function useCustomerService() {
  const tickets = ref<CustomerServiceTicket[]>([]);
  const messages = ref<CustomerServiceMessage[]>([]);
  const selectedTicket = ref<CustomerServiceTicket | null>(null);
  const loading = ref(false);
  const usingMock = ref(false);

  const stats = computed(() => ({
    total: tickets.value.length,
    open: tickets.value.filter(t => t.status === 'Open').length,
    urgent: tickets.value.filter(t => t.priority === 'Critical' || t.lead_score === 'hot').length,
    inProgress: tickets.value.filter(t => t.status === 'In Progress').length,
  }));

  const applyLocalFilter = (rows: CustomerServiceTicket[], filter?: TicketFilters) => {
    let result = [...rows];
    if (filter?.status) result = result.filter(r => r.status === filter.status);
    if (filter?.category) result = result.filter(r => r.category === filter.category);
    if (filter?.priority) result = result.filter(r => r.priority === filter.priority);
    if (filter?.lead_score) result = result.filter(r => r.lead_score === filter.lead_score);
    if (filter?.assigned_to) result = result.filter(r => r.assigned_to === filter.assigned_to);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(r => [r.ticket_number, r.subject, r.customer_name, r.customer_phone, r.customer_email, r.ai_summary].filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
    }
    return result;
  };

  const loadTickets = async (filter?: TicketFilters) => {
    loading.value = true;
    try {
      const { data, error } = await supabase.from('customer_service_tickets').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      tickets.value = applyLocalFilter((data as CustomerServiceTicket[]) || [], filter);
      usingMock.value = false;
    } catch (e) {
      console.warn('Using mock customer service data', e);
      tickets.value = applyLocalFilter(mockTickets, filter);
      usingMock.value = true;
    } finally {
      loading.value = false;
    }
  };

  const loadTicket = async (id: string) => {
    try {
      const { data, error } = await supabase.from('customer_service_tickets').select('*').eq('id', id).single();
      if (error) throw error;
      selectedTicket.value = data as CustomerServiceTicket;
      usingMock.value = false;
    } catch {
      selectedTicket.value = mockTickets.find(t => t.id === id) || null;
      usingMock.value = true;
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase.from('customer_service_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
      if (error) throw error;
      messages.value = (data as CustomerServiceMessage[]) || [];
      usingMock.value = false;
    } catch {
      messages.value = mockMessages[ticketId] || [];
      usingMock.value = true;
    }
  };

  const updateTicket = async (id: string, patch: Partial<CustomerServiceTicket>) => {
    try {
      const { error } = await supabase.from('customer_service_tickets').update({ ...patch, updated_at: now() }).eq('id', id);
      if (error) throw error;
    } catch {
      const idx = mockTickets.findIndex(t => t.id === id);
      if (idx >= 0) mockTickets[idx] = { ...mockTickets[idx], ...patch, updated_at: now() } as CustomerServiceTicket;
    }
    await loadTickets();
    if (selectedTicket.value?.id === id) await loadTicket(id);
  };

  const addMessage = async (ticketId: string, message: Omit<CustomerServiceMessage, 'id' | 'ticket_id' | 'created_at' | 'updated_at'>) => {
    const payload = { ...message, ticket_id: ticketId, created_at: now(), updated_at: now() };
    try {
      const { error } = await supabase.from('customer_service_messages').insert(payload);
      if (error) throw error;
    } catch {
      mockMessages[ticketId] = [...(mockMessages[ticketId] || []), { ...payload, id: `mock-${Date.now()}` } as CustomerServiceMessage];
    }
    await loadMessages(ticketId);
  };

  return { tickets, messages, selectedTicket, loading, usingMock, stats, loadTickets, loadTicket, loadMessages, updateTicket, addMessage };
}
