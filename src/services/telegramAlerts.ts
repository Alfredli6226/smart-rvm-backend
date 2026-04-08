/**
 * Telegram Alert Service
 * 
 * Provides scaffolding for sending Telegram alerts for hot leads/urgent tickets.
 * Gracefully falls back when credentials/webhooks are absent.
 */

export interface TelegramAlertConfig {
  botToken?: string;
  chatId?: string;
  enabled: boolean;
  alertOnHotLeads: boolean;
  alertOnCriticalTickets: boolean;
  alertOnNewHighPriority: boolean;
}

export interface AlertPayload {
  type: 'hot_lead' | 'critical_ticket' | 'new_high_priority' | 'escalation';
  title: string;
  message: string;
  ticketId?: string;
  leadId?: string;
  priority?: string;
  customerName?: string;
  customerPhone?: string;
  timestamp: string;
  url?: string;
}

class TelegramAlertService {
  private config: TelegramAlertConfig = {
    enabled: false,
    alertOnHotLeads: true,
    alertOnCriticalTickets: true,
    alertOnNewHighPriority: true,
  };

  private isConfigured = false;

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    // Try to load from environment variables
    const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    const chatId = import.meta.env.VITE_TELEGRAM_ALERT_CHAT_ID;

    if (botToken && chatId) {
      this.config = {
        botToken,
        chatId,
        enabled: true,
        alertOnHotLeads: true,
        alertOnCriticalTickets: true,
        alertOnNewHighPriority: true,
      };
      this.isConfigured = true;
      console.log('Telegram alerts configured');
    } else {
      console.warn('Telegram alerts not configured. Missing VITE_TELEGRAM_BOT_TOKEN or VITE_TELEGRAM_ALERT_CHAT_ID');
      this.isConfigured = false;
    }
  }

  /**
   * Send an alert to Telegram
   * Returns true if sent successfully, false if not configured or failed
   */
  async sendAlert(payload: AlertPayload): Promise<boolean> {
    if (!this.config.enabled || !this.isConfigured) {
      console.log('Telegram alerts disabled or not configured. Alert would have been:', payload);
      return false;
    }

    try {
      const message = this.formatMessage(payload);
      const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
      });

      if (!response.ok) {
        console.error('Telegram API error:', await response.text());
        return false;
      }

      console.log('Telegram alert sent:', payload.type);
      return true;
    } catch (error) {
      console.error('Failed to send Telegram alert:', error);
      return false;
    }
  }

  /**
   * Check if a ticket/lead should trigger an alert based on configuration
   */
  shouldAlertForTicket(ticket: any): boolean {
    if (!this.config.enabled) return false;

    if (this.config.alertOnCriticalTickets && ticket.priority === 'Critical') {
      return true;
    }

    if (this.config.alertOnNewHighPriority && ticket.priority === 'High' && ticket.status === 'Open') {
      return true;
    }

    if (this.config.alertOnHotLeads && ticket.lead_score === 'hot') {
      return true;
    }

    return false;
  }

  /**
   * Format alert message for Telegram
   */
  private formatMessage(payload: AlertPayload): string {
    const emoji = {
      hot_lead: '🔥',
      critical_ticket: '🚨',
      new_high_priority: '⚠️',
      escalation: '📈',
    }[payload.type] || '📢';

    const title = `<b>${emoji} ${payload.title}</b>`;
    const message = payload.message;
    const details = [
      payload.customerName && `<b>Customer:</b> ${payload.customerName}`,
      payload.customerPhone && `<b>Phone:</b> ${payload.customerPhone}`,
      payload.priority && `<b>Priority:</b> ${payload.priority}`,
      payload.timestamp && `<b>Time:</b> ${new Date(payload.timestamp).toLocaleString()}`,
    ].filter(Boolean).join('\n');

    const urlSection = payload.url ? `\n\n<a href="${payload.url}">View in Dashboard</a>` : '';

    return `${title}\n\n${message}\n\n${details}${urlSection}`;
  }

  /**
   * Send alert for a hot lead
   */
  async alertHotLead(lead: any, dashboardUrl?: string): Promise<boolean> {
    if (!this.config.alertOnHotLeads) return false;

    const payload: AlertPayload = {
      type: 'hot_lead',
      title: '🔥 Hot Lead Alert',
      message: `New hot lead identified: ${lead.company_name || lead.contact_person}`,
      leadId: lead.id,
      customerName: lead.contact_person,
      customerPhone: lead.phone,
      timestamp: new Date().toISOString(),
      url: dashboardUrl,
    };

    return this.sendAlert(payload);
  }

  /**
   * Send alert for a critical ticket
   */
  async alertCriticalTicket(ticket: any, dashboardUrl?: string): Promise<boolean> {
    if (!this.config.alertOnCriticalTickets) return false;

    const payload: AlertPayload = {
      type: 'critical_ticket',
      title: '🚨 Critical Ticket Alert',
      message: `Critical priority ticket requires immediate attention: ${ticket.subject}`,
      ticketId: ticket.id,
      customerName: ticket.customer_name,
      customerPhone: ticket.customer_phone,
      priority: ticket.priority,
      timestamp: new Date().toISOString(),
      url: dashboardUrl,
    };

    return this.sendAlert(payload);
  }

  /**
   * Send alert for ticket escalation
   */
  async alertEscalation(ticket: any, reason: string, dashboardUrl?: string): Promise<boolean> {
    const payload: AlertPayload = {
      type: 'escalation',
      title: '📈 Ticket Escalation',
      message: `Ticket escalated: ${reason}`,
      ticketId: ticket.id,
      customerName: ticket.customer_name,
      priority: ticket.priority,
      timestamp: new Date().toISOString(),
      url: dashboardUrl,
    };

    return this.sendAlert(payload);
  }

  /**
   * Get current configuration status
   */
  getStatus() {
    return {
      configured: this.isConfigured,
      enabled: this.config.enabled,
      config: { ...this.config, botToken: this.config.botToken ? '***' + this.config.botToken.slice(-4) : undefined },
    };
  }
}

// Export singleton instance
export const telegramAlerts = new TelegramAlertService();

// Export helper functions for easy use
export const useTelegramAlerts = () => {
  return {
    sendAlert: telegramAlerts.sendAlert.bind(telegramAlerts),
    alertHotLead: telegramAlerts.alertHotLead.bind(telegramAlerts),
    alertCriticalTicket: telegramAlerts.alertCriticalTicket.bind(telegramAlerts),
    alertEscalation: telegramAlerts.alertEscalation.bind(telegramAlerts),
    shouldAlertForTicket: telegramAlerts.shouldAlertForTicket.bind(telegramAlerts),
    getStatus: telegramAlerts.getStatus.bind(telegramAlerts),
  };
};