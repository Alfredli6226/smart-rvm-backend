import { computed, ref } from 'vue';
import { supabase } from '../services/supabase';
import type { Lead, LeadFilters } from '../types';

const now = () => new Date().toISOString();

const normalizeLead = (row: Record<string, any>): Lead => ({
  id: row.id,
  lead_number: row.lead_number || String(row.id).slice(0, 8).toUpperCase(),
  company_name: row.company_name,
  contact_person: row.customer_name || row.company_name || 'Unknown Lead',
  email: row.customer_email || '',
  phone: row.customer_phone,
  inquiry_type: row.interest_type || 'general',
  description: row.ai_summary || row.location || row.timeline || '',
  estimated_value: undefined,
  currency: 'MYR',
  status: String(row.status || 'new').replace(/_/g, ' ').replace(/(^|\s)(\w)/g, (_, p1, p2) => `${p1}${p2.toUpperCase()}`) as Lead['status'],
  lead_score: row.score || 'warm',
  confidence_score: Number(row.ai_confidence || 0),
  source: row.source || 'unknown',
  assigned_to: row.assigned_to,
  next_follow_up: row.next_follow_up_at,
  ai_summary: row.ai_summary,
  ai_tags: [],
  created_at: row.created_at || now(),
  updated_at: row.updated_at || row.created_at || now(),
  notes: [row.budget_range, row.timeline, row.location].filter(Boolean).join(' | '),
});

export function useLeads() {
  const leads = ref<Lead[]>([]);
  const loading = ref(false);
  const usingMock = ref(false);
  const stats = computed(() => ({ total: leads.value.length, hot: leads.value.filter(l => l.lead_score === 'hot').length, warm: leads.value.filter(l => l.lead_score === 'warm').length, qualified: leads.value.filter(l => ['Qualified', 'Proposal Sent', 'Negotiation'].includes(l.status)).length }));

  const applyLocalFilter = (rows: Lead[], filter?: LeadFilters) => {
    let result = [...rows];
    if (filter?.status) result = result.filter(r => r.status === filter.status);
    if (filter?.lead_score) result = result.filter(r => r.lead_score === filter.lead_score);
    if (filter?.source) result = result.filter(r => r.source === filter.source);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(r => [r.lead_number, r.company_name, r.contact_person, r.email, r.phone, r.ai_summary, r.inquiry_type].filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
    }
    return result;
  };

  const loadLeads = async (filter?: LeadFilters) => {
    loading.value = true;
    try {
      const { data, error } = await supabase.from('customer_service_leads').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      leads.value = applyLocalFilter(((data as Record<string, any>[]) || []).map(normalizeLead), filter);
      usingMock.value = false;
    } catch (e) {
      console.warn('Failed to load leads data', e);
      leads.value = [];
      usingMock.value = false;
    } finally {
      loading.value = false;
    }
  };

  const updateLead = async (id: string, patch: Partial<Lead>) => {
    const payload = {
      customer_name: patch.contact_person,
      customer_email: patch.email,
      customer_phone: patch.phone,
      company_name: patch.company_name,
      interest_type: patch.inquiry_type,
      source: patch.source,
      score: patch.lead_score,
      status: patch.status?.toLowerCase().replace(/\s+/g, '_'),
      ai_summary: patch.ai_summary,
      ai_confidence: patch.confidence_score,
      assigned_to: patch.assigned_to,
      next_follow_up_at: patch.next_follow_up,
      updated_at: now(),
    };
    const { error } = await supabase.from('customer_service_leads').update(payload).eq('id', id);
    if (error) throw error;
    await loadLeads();
  };

  return { leads, loading, usingMock, stats, loadLeads, updateLead };
}
