import { computed, ref } from 'vue';
import { supabase } from '../services/supabase';
import type { TicketFilters, CustomerServiceMessage, CustomerServiceTicket } from '../types';

const now = () => new Date().toISOString();

const normalizeTicket = (row: Record<string, any>): CustomerServiceTicket => {
  const updatedAt = row.updated_at || row.last_message_at || row.created_at || now();
  const category = row.category || 'general';
  const priority = row.priority || 'medium';
  const status = row.status || 'new';
  const customerName = row.customer_name || row.company_name || row.customer_phone || 'Unknown Customer';

  return {
    id: row.id,
    ticket_number: row.ticket_number || String(row.id).slice(0, 8).toUpperCase(),
    subject: row.subject || `${category} inquiry`,
    description: row.description || row.ai_summary || row.next_action || '',
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    company_name: row.company_name,
    category: String(category).replace(/(^|_)(\w)/g, (_, p1, p2) => `${p1 ? ' ' : ''}${p2.toUpperCase()}`),
    priority: String(priority).charAt(0).toUpperCase() + String(priority).slice(1).toLowerCase() as CustomerServiceTicket['priority'],
    status: String(status)
      .replace(/_/g, ' ')
      .replace(/(^|\s)(\w)/g, (_, p1, p2) => `${p1}${p2.toUpperCase()}`) as CustomerServiceTicket['status'],
    lead_score: row.lead_score,
    assigned_to: row.assigned_to,
    source: row.source || row.channel,
    channel: row.channel,
    ai_summary: row.ai_summary,
    ai_sentiment: row.ai_sentiment,
    ai_tags: row.ai_tags || [],
    next_action: row.next_action,
    last_message_at: row.last_message_at,
    created_at: row.created_at || now(),
    updated_at: updatedAt,
    custom_fields: {
      company_name: row.company_name,
      customer_label: customerName,
    },
  };
};

const normalizeMessage = (row: Record<string, any>): CustomerServiceMessage => ({
  id: row.id,
  ticket_id: row.ticket_id,
  message_type: row.is_internal ? 'internal_note' : 'message',
  content: row.message || row.content || '',
  sender_type: row.sender_type || 'customer',
  sender_name: row.sender_name,
  is_internal: Boolean(row.is_internal),
  read_by_agent: true,
  read_by_customer: row.sender_type !== 'agent',
  created_at: row.created_at || now(),
  updated_at: row.updated_at || row.created_at || now(),
});

export function useCustomerService() {
  const tickets = ref<CustomerServiceTicket[]>([]);
  const messages = ref<CustomerServiceMessage[]>([]);
  const selectedTicket = ref<CustomerServiceTicket | null>(null);
  const loading = ref(false);
  const usingMock = ref(false);

  const stats = computed(() => ({
    total: tickets.value.length,
    open: tickets.value.filter(t => ['Open', 'New'].includes(t.status)).length,
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
      result = result.filter(r => [r.ticket_number, r.subject, r.customer_name, r.customer_phone, r.customer_email, r.ai_summary, r.company_name].filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
    }
    return result;
  };

  const loadTickets = async (filter?: TicketFilters) => {
    loading.value = true;
    try {
      const { data, error } = await supabase.from('customer_service_tickets').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      tickets.value = applyLocalFilter(((data as Record<string, any>[]) || []).map(normalizeTicket), filter);
      usingMock.value = false;
    } catch (e) {
      console.warn('Failed to load customer service data', e);
      tickets.value = [];
      usingMock.value = false;
    } finally {
      loading.value = false;
    }
  };

  const loadTicket = async (id: string) => {
    const { data, error } = await supabase.from('customer_service_tickets').select('*').eq('id', id).single();
    if (error) throw error;
    selectedTicket.value = normalizeTicket(data as Record<string, any>);
    usingMock.value = false;
  };

  const loadMessages = async (ticketId: string) => {
    const { data, error } = await supabase.from('customer_service_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
    if (error) throw error;
    messages.value = ((data as Record<string, any>[]) || []).map(normalizeMessage);
    usingMock.value = false;
  };

  const findTicketsByPhone = async (phone: string) => {
    const normalized = phone.replace(/\D/g, '');
    const { data, error } = await supabase.from('customer_service_tickets').select('*').ilike('customer_phone', `%${normalized}%`).order('updated_at', { ascending: false });
    if (error) throw error;
    return ((data as Record<string, any>[]) || []).map(normalizeTicket);
  };

  const findTicketByNumber = async (ticketNumber: string) => {
    const { data, error } = await supabase.from('customer_service_tickets').select('*').eq('ticket_number', ticketNumber).maybeSingle();
    if (error) throw error;
    return data ? normalizeTicket(data as Record<string, any>) : null;
  };

  const loadOpenTickets = async () => {
    return loadTickets({ status: 'Open' });
  };

  const updateTicket = async (id: string, patch: Partial<CustomerServiceTicket>) => {
    const payload = Object.fromEntries(
      Object.entries({
        customer_name: patch.customer_name,
        customer_email: patch.customer_email,
        customer_phone: patch.customer_phone,
        company_name: patch.company_name,
        category: patch.category?.toLowerCase(),
        priority: patch.priority?.toLowerCase(),
        status: patch.status?.toLowerCase().replace(/\s+/g, '_'),
        assigned_to: patch.assigned_to,
        ai_summary: patch.ai_summary,
        ai_sentiment: patch.ai_sentiment?.toLowerCase(),
        ai_tags: patch.ai_tags,
        lead_score: patch.lead_score,
        next_action: patch.next_action,
        last_message_at: patch.last_message_at,
        updated_at: now(),
      }).filter(([, value]) => value !== undefined)
    );

    const { error } = await supabase.from('customer_service_tickets').update(payload).eq('id', id);
    if (error) throw error;
    await loadTickets();
    if (selectedTicket.value?.id === id) await loadTicket(id);
  };

  const addMessage = async (ticketId: string, message: Omit<CustomerServiceMessage, 'id' | 'ticket_id' | 'created_at' | 'updated_at'>) => {
    const createdAt = now();
    const payload = {
      ticket_id: ticketId,
      sender_type: message.sender_type,
      sender_name: message.sender_name,
      message: message.content,
      content: message.content,
      is_internal: message.is_internal,
      created_at: createdAt,
      updated_at: createdAt,
    };
    const { error } = await supabase.from('customer_service_messages').insert(payload);
    if (error) throw error;

    const ticketPatch: Record<string, any> = {
      last_message_at: createdAt,
      updated_at: createdAt,
    };

    if (!message.is_internal) {
      ticketPatch.status = 'in_progress';
    }

    await supabase.from('customer_service_tickets').update(ticketPatch).eq('id', ticketId);
    await loadMessages(ticketId);
    if (selectedTicket.value?.id === ticketId) await loadTicket(ticketId);
  };

  return { tickets, messages, selectedTicket, loading, usingMock, stats, loadTickets, loadTicket, loadMessages, findTicketsByPhone, findTicketByNumber, loadOpenTickets, updateTicket, addMessage };
}
