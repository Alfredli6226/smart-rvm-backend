/**
 * Intake Service for website/WhatsApp/social import
 * 
 * Provides structure for creating tickets/leads from intake payloads
 * with channel/source classification.
 */

import { supabase } from './supabase';
import type { CustomerServiceTicket, Lead } from '../types';

export interface IntakePayload {
  // Contact Information
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  
  // Inquiry Details
  subject: string;
  message: string;
  inquiryType?: string;
  
  // Source/Channel Information
  channel: 'website' | 'whatsapp' | 'email' | 'phone' | 'social' | 'in-person';
  source?: string; // e.g., 'facebook', 'instagram', 'linkedin', 'contact_form'
  campaign?: string;
  referral?: string;
  
  // Additional Metadata
  metadata?: {
    url?: string;
    userAgent?: string;
    ipAddress?: string;
    location?: string;
    attachments?: string[];
    customFields?: Record<string, any>;
  };
  
  // Classification Hints
  suggestedCategory?: string;
  suggestedPriority?: 'Low' | 'Medium' | 'High' | 'Critical';
  tags?: string[];
}

export interface IntakeResult {
  success: boolean;
  ticketId?: string;
  leadId?: string;
  ticket?: CustomerServiceTicket;
  lead?: Lead;
  message: string;
  warnings?: string[];
}

export interface ChannelClassifier {
  (payload: IntakePayload): {
    category: string;
    priority: 'Low' | 'Medium' | 'High' | 'Critical';
    leadScore: 'hot' | 'warm' | 'cold';
    tags: string[];
    isLead: boolean;
  };
}

class IntakeService {
  private channelClassifiers: Record<string, ChannelClassifier> = {
    website: this.classifyWebsiteInquiry.bind(this),
    whatsapp: this.classifyWhatsAppInquiry.bind(this),
    email: this.classifyEmailInquiry.bind(this),
    social: this.classifySocialInquiry.bind(this),
    phone: this.classifyPhoneInquiry.bind(this),
    'in-person': this.classifyInPersonInquiry.bind(this),
  };

  /**
   * Process an intake payload and create ticket/lead
   */
  async processIntake(payload: IntakePayload): Promise<IntakeResult> {
    try {
      // Validate payload
      if (!payload.subject && !payload.message) {
        return {
          success: false,
          message: 'Subject or message is required',
        };
      }

      // Classify based on channel
      const classifier = this.channelClassifiers[payload.channel] || this.classifyWebsiteInquiry;
      const classification = classifier(payload);

      // Determine if this should be a lead or ticket
      if (classification.isLead) {
        return await this.createLeadFromIntake(payload, classification);
      } else {
        return await this.createTicketFromIntake(payload, classification);
      }
    } catch (error) {
      console.error('Intake processing error:', error);
      return {
        success: false,
        message: `Failed to process intake: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Create a customer service ticket from intake
   */
  private async createTicketFromIntake(
    payload: IntakePayload,
    classification: ReturnType<ChannelClassifier>
  ): Promise<IntakeResult> {
    const ticketNumber = await this.generateTicketNumber();
    
    const ticketData = {
      ticket_number: ticketNumber,
      subject: payload.subject || 'Inquiry from ' + (payload.name || payload.channel),
      description: payload.message,
      customer_name: payload.name,
      customer_email: payload.email,
      customer_phone: payload.phone,
      company_name: payload.company,
      category: classification.category,
      priority: classification.priority,
      status: 'Open' as const,
      lead_score: classification.leadScore,
      channel: payload.channel,
      source: payload.source || payload.channel,
      ai_tags: classification.tags,
      custom_fields: {
        ...payload.metadata?.customFields,
        campaign: payload.campaign,
        referral: payload.referral,
        intake_source: payload.channel,
      },
    };

    try {
      const { data, error } = await supabase
        .from('customer_service_tickets')
        .insert(ticketData)
        .select()
        .single();

      if (error) throw error;

      // Generate AI summary if needed (could be async)
      setTimeout(() => {
        this.generateAISummary(data.id, payload);
      }, 100);

      return {
        success: true,
        ticketId: data.id,
        ticket: data as CustomerServiceTicket,
        message: `Ticket ${ticketNumber} created successfully`,
      };
    } catch (error) {
      console.error('Failed to create ticket:', error);
      return {
        success: false,
        message: `Failed to create ticket: ${error instanceof Error ? error.message : 'Database error'}`,
      };
    }
  }

  /**
   * Create a lead from intake
   */
  private async createLeadFromIntake(
    payload: IntakePayload,
    classification: ReturnType<ChannelClassifier>
  ): Promise<IntakeResult> {
    const leadNumber = await this.generateLeadNumber();
    
    const leadData = {
      lead_number: leadNumber,
      contact_person: payload.name,
      email: payload.email,
      phone: payload.phone,
      company_name: payload.company,
      inquiry_type: payload.inquiryType || classification.category,
      description: payload.message,
      status: 'New' as const,
      lead_score: classification.leadScore,
      source: payload.source || payload.channel,
      ai_tags: classification.tags,
      custom_fields: {
        ...payload.metadata?.customFields,
        campaign: payload.campaign,
        referral: payload.referral,
        intake_source: payload.channel,
      },
    };

    try {
      const { data, error } = await supabase
        .from('customer_service_leads')
        .insert(leadData)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        leadId: data.id,
        lead: data as Lead,
        message: `Lead ${leadNumber} created successfully`,
      };
    } catch (error) {
      console.error('Failed to create lead:', error);
      return {
        success: false,
        message: `Failed to create lead: ${error instanceof Error ? error.message : 'Database error'}`,
      };
    }
  }

  /**
   * Generate unique ticket number
   */
  private async generateTicketNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Get count of tickets today
    const { count } = await supabase
      .from('customer_service_tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-${month}-${day}T00:00:00Z`)
      .lt('created_at', `${year}-${month}-${day + 1}T00:00:00Z`);

    const sequence = ((count || 0) + 1).toString().padStart(4, '0');
    return `TKT-${year}${month}${day}-${sequence}`;
  }

  /**
   * Generate unique lead number
   */
  private async generateLeadNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Get count of leads today
    const { count } = await supabase
      .from('customer_service_leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-${month}-${day}T00:00:00Z`)
      .lt('created_at', `${year}-${month}-${day + 1}T00:00:00Z`);

    const sequence = ((count || 0) + 1).toString().padStart(4, '0');
    return `LD-${year}${month}${day}-${sequence}`;
  }

  /**
   * Generate AI summary for ticket (mock/placeholder)
   */
  private async generateAISummary(ticketId: string, payload: IntakePayload) {
    // This is a placeholder for actual AI integration
    // In production, this would call an AI service
    const summary = `Inquiry via ${payload.channel}: ${payload.subject || payload.message.substring(0, 100)}...`;
    
    try {
      await supabase
        .from('customer_service_tickets')
        .update({ ai_summary: summary })
        .eq('id', ticketId);
    } catch (error) {
      console.error('Failed to update AI summary:', error);
    }
  }

  /**
   * Channel classification functions
   */
  private classifyWebsiteInquiry(payload: IntakePayload) {
    const message = payload.message.toLowerCase();
    const subject = payload.subject.toLowerCase();
    
    let category = 'General';
    let priority: 'Low' | 'Medium' | 'High' | 'Critical' = 'Medium';
    let leadScore: 'hot' | 'warm' | 'cold' = 'warm';
    const tags: string[] = ['website'];
    
    // Business inquiry detection
    if (message.includes('quotation') || message.includes('quote') || 
        message.includes('price') || message.includes('cost') ||
        subject.includes('quotation') || subject.includes('quote')) {
      category = 'Sales';
      leadScore = 'hot';
      tags.push('sales', 'quotation');
    }
    
    // Support issue detection
    if (message.includes('problem') || message.includes('issue') || 
        message.includes('error') || message.includes('not working') ||
        subject.includes('help') || subject.includes('support')) {
      category = 'Support';
      priority = 'High';
      tags.push('support', 'technical');
    }
    
    // Urgent detection
    if (message.includes('urgent') || message.includes('emergency') || 
        message.includes('asap') || subject.includes('urgent')) {
      priority = 'High';
      leadScore = 'hot';
    }
    
    // Check if this is likely a lead (business inquiry)
    const isLead = category === 'Sales' || 
                  (payload.company && payload.company.length > 0) ||
                  (message.includes('business') || message.includes('corporate'));
    
    return { category, priority, leadScore, tags, isLead };
  }

  private classifyWhatsAppInquiry(payload: IntakePayload) {
    const classification = this.classifyWebsiteInquiry(payload);
    classification.tags.push('whatsapp');
    classification.priority = 'High'; // WhatsApp inquiries are typically more urgent
    return classification;
  }

  private classifyEmailInquiry(payload: IntakePayload) {
    const classification = this.classifyWebsiteInquiry(payload);
    classification.tags.push('email');
    return classification;
  }

  private classifySocialInquiry(payload: IntakePayload) {
    const classification = this.classifyWebsiteInquiry(payload);
    classification.tags.push('social', payload.source || 'social');
    return classification;
  }

  private classifyPhoneInquiry(payload: IntakePayload) {
    const classification = this.classifyWebsiteInquiry(payload);
    classification.tags.push('phone');
    classification.priority = 'High'; // Phone calls are typically urgent
    classification.leadScore = 'hot';
    return classification;
  }

  private classifyInPersonInquiry(payload: IntakePayload) {
    const classification = this.classifyWebsiteInquiry(payload);
    classification.tags.push('in-person');
    classification.leadScore = 'hot'; // In-person inquiries are high intent
    return classification;
  }

  /**
   * Get all intake channels
   */
  getChannels() {
    return Object.keys(this.channelClassifiers);
  }

  /**
   * Test classification for a payload
   */
  testClassification(payload: IntakePayload) {
    const classifier = this.channelClassifiers[payload.channel] || this.classifyWebsiteInquiry;
    return classifier(payload);
  }
}

// Export singleton instance
export const intakeService = new IntakeService();

// Export helper functions for easy use
export const useIntakeService = () => {
  return {
    processIntake: intakeService.processIntake.bind(intakeService),
    getChannels: intakeService.getChannels.bind(intakeService),
    testClassification: intakeService.testClassification.bind(intakeService),
  };
};