import { computed, ref } from 'vue';
import { supabase } from '../services/supabase';
import type { Lead, LeadFilters } from '../types';

const now = () => new Date().toISOString();
const mockLeads: Lead[] = [
  { id: 'lead-1', lead_number: 'LD-0001', company_name: 'ABC Restaurant Group', contact_person: 'Jason Lim', email: 'jason@example.com', phone: '+60123456789', inquiry_type: 'food_waste_machine', description: '8 outlets in KL, wants quotation urgently', currency: 'MYR', status: 'Qualified', lead_score: 'hot', confidence_score: 92, source: 'website', assigned_to: 'Alfred', next_follow_up: now(), ai_summary: 'High-value F&B lead with urgent quotation request.', ai_tags: ['quotation', 'corporate'], created_at: now(), updated_at: now() },
  { id: 'lead-2', lead_number: 'LD-0002', company_name: 'Eco Retail', contact_person: 'Sarah', email: 'sarah@example.com', phone: '+60112223344', inquiry_type: 'rvm', description: 'Retail traffic campaign interest', currency: 'MYR', status: 'New', lead_score: 'warm', confidence_score: 76, source: 'facebook', assigned_to: 'Sales Team', next_follow_up: now(), ai_summary: 'Potential RVM partnership lead.', ai_tags: ['rvm', 'retail'], created_at: now(), updated_at: now() }
];

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
      leads.value = applyLocalFilter((data as Lead[]) || [], filter);
      usingMock.value = false;
    } catch (e) {
      console.warn('Using mock leads data', e);
      leads.value = applyLocalFilter(mockLeads, filter);
      usingMock.value = true;
    } finally {
      loading.value = false;
    }
  };

  const updateLead = async (id: string, patch: Partial<Lead>) => {
    try {
      const { error } = await supabase.from('customer_service_leads').update({ ...patch, updated_at: now() }).eq('id', id);
      if (error) throw error;
    } catch {
      const idx = mockLeads.findIndex(l => l.id === id);
      if (idx >= 0) mockLeads[idx] = { ...mockLeads[idx], ...patch, updated_at: now() } as Lead;
    }
    await loadLeads();
  };

  return { leads, loading, usingMock, stats, loadLeads, updateLead };
}
