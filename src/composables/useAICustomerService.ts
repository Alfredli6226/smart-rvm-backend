/**
 * AI Customer Service Composable
 * 
 * Provides AI-powered features for customer service:
 * - Summary generation
 * - Suggested replies
 * - Sentiment analysis
 * - Action recommendations
 */

import { ref, computed } from 'vue';
import { supabase } from '../services/supabase';
import type { CustomerServiceTicket, CustomerServiceMessage } from '../types';

export interface AISuggestion {
  id: string;
  ticket_id: string;
  type: 'summary' | 'reply' | 'action' | 'sentiment';
  content: string;
  confidence: number;
  created_at: string;
}

export interface AIConfig {
  enabled: boolean;
  summaryEnabled: boolean;
  replySuggestionsEnabled: boolean;
  sentimentAnalysisEnabled: boolean;
  actionRecommendationsEnabled: boolean;
  model: string;
}

export function useAICustomerService() {
  const config = ref<AIConfig>({
    enabled: import.meta.env.VITE_AI_ENABLED === 'true',
    summaryEnabled: true,
    replySuggestionsEnabled: true,
    sentimentAnalysisEnabled: true,
    actionRecommendationsEnabled: true,
    model: import.meta.env.VITE_AI_MODEL || 'mock',
  });

  const suggestions = ref<AISuggestion[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Generate AI summary for a ticket
   */
  const generateSummary = async (ticketId: string, messages: CustomerServiceMessage[]): Promise<string> => {
    if (!config.value.summaryEnabled) {
      return 'AI summary generation is disabled';
    }

    loading.value = true;
    error.value = null;

    try {
      // In a real implementation, this would call an AI service
      // For now, we'll create a mock summary based on message content
      
      const allText = messages
        .map(m => m.content)
        .join(' ')
        .toLowerCase();

      let summary = '';
      
      // Simple keyword-based summary generation
      if (allText.includes('quotation') || allText.includes('price') || allText.includes('cost')) {
        summary = 'Customer is inquiring about pricing or requesting a quotation.';
      } else if (allText.includes('problem') || allText.includes('issue') || allText.includes('error')) {
        summary = 'Customer is reporting an issue or problem that needs technical support.';
      } else if (allText.includes('delivery') || allText.includes('shipping') || allText.includes('install')) {
        summary = 'Customer has questions about delivery, shipping, or installation.';
      } else if (allText.includes('thank') || allText.includes('appreciate') || allText.includes('good')) {
        summary = 'Positive feedback or appreciation from customer.';
      } else {
        summary = `Customer inquiry via ${messages[0]?.sender_type || 'unknown'}. ${messages[0]?.content.substring(0, 100)}...`;
      }

      // Save summary to ticket
      await supabase
        .from('customer_service_tickets')
        .update({ ai_summary: summary })
        .eq('id', ticketId);

      // Save suggestion record
      await saveSuggestion({
        ticket_id: ticketId,
        type: 'summary',
        content: summary,
        confidence: 0.8,
      });

      return summary;
    } catch (err) {
      error.value = `Failed to generate summary: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error('AI summary generation error:', err);
      return 'Failed to generate AI summary';
    } finally {
      loading.value = false;
    }
  };

  /**
   * Generate suggested reply for a ticket
   */
  const generateSuggestedReply = async (
    ticketId: string, 
    ticket: CustomerServiceTicket, 
    messages: CustomerServiceMessage[]
  ): Promise<string> => {
    if (!config.value.replySuggestionsEnabled) {
      return 'AI reply suggestions are disabled';
    }

    loading.value = true;
    error.value = null;

    try {
      // Mock AI reply generation based on ticket context
      const lastMessage = messages[messages.length - 1];
      const customerName = ticket.customer_name || 'Customer';
      const category = ticket.category?.toLowerCase() || 'general';
      
      let reply = '';

      switch (category) {
        case 'sales':
          reply = `Dear ${customerName},\n\nThank you for your interest in our products. I'd be happy to provide you with a quotation. Could you please share more details about your requirements?\n\nBest regards,\nSupport Team`;
          break;
        case 'support':
          reply = `Dear ${customerName},\n\nI understand you're experiencing an issue. Let me help you resolve this. Could you provide more details about what you're seeing?\n\nBest regards,\nSupport Team`;
          break;
        case 'complaint':
          reply = `Dear ${customerName},\n\nI apologize for the inconvenience you've experienced. Our team is looking into this matter and we'll get back to you with a resolution as soon as possible.\n\nSincerely,\nSupport Team`;
          break;
        default:
          reply = `Dear ${customerName},\n\nThank you for reaching out. We've received your message and will respond shortly.\n\nBest regards,\nSupport Team`;
      }

      // If there's a specific question in the last message, tailor the response
      if (lastMessage?.content.toLowerCase().includes('when') || lastMessage?.content.toLowerCase().includes('how long')) {
        reply += '\n\nWe typically respond within 24 hours during business days.';
      }

      if (lastMessage?.content.toLowerCase().includes('urgent') || ticket.priority === 'High' || ticket.priority === 'Critical') {
        reply = `URGENT: ${reply}`;
      }

      // Save suggestion record
      await saveSuggestion({
        ticket_id: ticketId,
        type: 'reply',
        content: reply,
        confidence: 0.7,
      });

      return reply;
    } catch (err) {
      error.value = `Failed to generate suggested reply: ${err instanceof Error ? err.message : 'Unknown error'}`;
      console.error('AI reply generation error:', err);
      return 'Failed to generate suggested reply';
    } finally {
      loading.value = false;
    }
  };

  /**
   * Analyze sentiment of messages
   */
  const analyzeSentiment = async (messages: CustomerServiceMessage[]): Promise<'positive' | 'negative' | 'neutral'> => {
    if (!config.value.sentimentAnalysisEnabled) {
      return 'neutral';
    }

    try {
      const allText = messages.map(m => m.content).join(' ').toLowerCase();
      
      // Simple keyword-based sentiment analysis
      const positiveWords = ['thank', 'great', 'good', 'excellent', 'happy', 'appreciate', 'helpful', 'love'];
      const negativeWords = ['angry', 'frustrated', 'disappointed', 'bad', 'terrible', 'awful', 'hate', 'complaint'];
      
      const positiveCount = positiveWords.filter(word => allText.includes(word)).length;
      const negativeCount = negativeWords.filter(word => allText.includes(word)).length;
      
      if (positiveCount > negativeCount * 2) return 'positive';
      if (negativeCount > positiveCount * 2) return 'negative';
      return 'neutral';
    } catch (err) {
      console.error('Sentiment analysis error:', err);
      return 'neutral';
    }
  };

  /**
   * Generate recommended action for a ticket
   */
  const generateRecommendedAction = async (
    ticket: CustomerServiceTicket,
    messages: CustomerServiceMessage[]
  ): Promise<string> => {
    if (!config.value.actionRecommendationsEnabled) {
      return 'No action recommendation available';
    }

    try {
      const sentiment = await analyzeSentiment(messages);
      
      let action = '';
      
      // Check for hot lead score (handle undefined case)
      const isHotLead = ticket.lead_score === 'hot';
      
      if (ticket.priority === 'Critical' || isHotLead) {
        action = '🚨 IMMEDIATE ACTION REQUIRED: Call customer within 1 hour';
      } else if (ticket.priority === 'High') {
        action = '⚠️ High Priority: Respond within 4 hours';
      } else if (sentiment === 'negative') {
        action = '😟 Negative sentiment: Escalate to senior support';
      } else if (ticket.category === 'Sales' && isHotLead) {
        action = '💰 Hot Sales Lead: Send quotation within 24 hours';
      } else if (messages.length === 1 && ticket.status === 'Open') {
        action = '📝 First response needed: Send acknowledgment';
      } else if (ticket.status === 'In Progress' && messages.length > 3) {
        action = '⏳ Follow up required: Check if customer needs more help';
      } else {
        action = '📋 Standard response: Reply within 24 hours';
      }

      // Save suggestion record
      await saveSuggestion({
        ticket_id: ticket.id,
        type: 'action',
        content: action,
        confidence: 0.6,
      });

      return action;
    } catch (err) {
      console.error('Action recommendation error:', err);
      return 'Unable to generate action recommendation';
    }
  };

  /**
   * Save AI suggestion to database
   */
  const saveSuggestion = async (suggestion: Omit<AISuggestion, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('ai_suggestions')
        .insert({
          ...suggestion,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      suggestions.value.push(data as AISuggestion);
      return data;
    } catch (err) {
      console.error('Failed to save AI suggestion:', err);
      throw err;
    }
  };

  /**
   * Load AI suggestions for a ticket
   */
  const loadSuggestions = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_suggestions')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      suggestions.value = (data as AISuggestion[]) || [];
    } catch (err) {
      console.error('Failed to load AI suggestions:', err);
      suggestions.value = [];
    }
  };

  /**
   * Get the latest suggestion of a specific type
   */
  const getLatestSuggestion = (ticketId: string, type: AISuggestion['type']) => {
    return suggestions.value
      .filter(s => s.ticket_id === ticketId && s.type === type)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  };

  /**
   * Clear suggestions for a ticket
   */
  const clearSuggestions = async (ticketId: string) => {
    try {
      await supabase
        .from('ai_suggestions')
        .delete()
        .eq('ticket_id', ticketId);

      suggestions.value = suggestions.value.filter(s => s.ticket_id !== ticketId);
    } catch (err) {
      console.error('Failed to clear suggestions:', err);
    }
  };

  /**
   * Update AI configuration
   */
  const updateConfig = (newConfig: Partial<AIConfig>) => {
    config.value = { ...config.value, ...newConfig };
  };

  return {
    config,
    suggestions,
    loading,
    error,
    
    // Methods
    generateSummary,
    generateSuggestedReply,
    analyzeSentiment,
    generateRecommendedAction,
    loadSuggestions,
    getLatestSuggestion,
    clearSuggestions,
    updateConfig,
    
    // Computed
    isEnabled: computed(() => config.value.enabled),
    hasSuggestions: computed(() => suggestions.value.length > 0),
  };
}