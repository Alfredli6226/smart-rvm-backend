// CS WhatsApp Sync — creates tickets & messages from WhatsApp data
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'env not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { action } = req.query;

  try {
    // Create a ticket + message from WhatsApp
    if (action === 'incoming') {
      const { from, name, message, timestamp } = req.body || {};
      if (!from || !message) {
        return res.status(400).json({ error: 'from and message required' });
      }

      // Find existing ticket for this customer, or create new
      const { data: existing } = await supabase
        .from('customer_service_tickets')
        .select('id')
        .eq('customer_phone', from)
        .in('status', ['New', 'In Progress', 'Open'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let ticketId;
      if (existing) {
        ticketId = existing.id;
        // Update last_message_at
        await supabase.from('customer_service_tickets')
          .update({ last_message_at: new Date().toISOString(), status: 'In Progress' })
          .eq('id', ticketId);
      } else {
        const { data: newTicket } = await supabase.from('customer_service_tickets').insert({
          customer_name: name || from,
          customer_phone: from,
          channel: 'whatsapp',
          source: 'whatsapp',
          category: 'general',
          priority: 'medium',
          status: 'New',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString()
        }).select().single();
        ticketId = newTicket?.id;
      }

      if (ticketId) {
        await supabase.from('customer_service_messages').insert({
          ticket_id: ticketId,
          sender_type: 'customer',
          sender_name: name || from,
          message: message,
          created_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
        });
      }

      return res.json({ success: true, ticket_id: ticketId });
    }

    // List open tickets
    if (action === 'tickets') {
      const { data, error } = await supabase
        .from('customer_service_tickets')
        .select('*')
        .eq('channel', 'whatsapp')
        .order('last_message_at', { ascending: false })
        .limit(50);

      if (error) return res.status(400).json({ error: error.message });
      return res.json({ data: data || [] });
    }

    // Get messages for a ticket
    if (action === 'messages') {
      const { ticketId } = req.query;
      if (!ticketId) return res.status(400).json({ error: 'ticketId required' });

      const { data, error } = await supabase
        .from('customer_service_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) return res.status(400).json({ error: error.message });
      return res.json({ data: data || [] });
    }

    // Send reply (from agent to customer via OpenClaw)
    if (action === 'reply') {
      const { ticketId, message } = req.body || {};
      if (!ticketId || !message) {
        return res.status(400).json({ error: 'ticketId and message required' });
      }

      // Save the agent reply
      const { data: ticket } = await supabase.from('customer_service_tickets')
        .select('customer_phone')
        .eq('id', ticketId)
        .single();

      if (!ticket) return res.status(404).json({ error: 'ticket not found' });

      await supabase.from('customer_service_messages').insert({
        ticket_id: ticketId,
        sender_type: 'agent',
        sender_name: 'Support Agent',
        message: message,
        created_at: new Date().toISOString()
      });

      await supabase.from('customer_service_tickets')
        .update({ last_message_at: new Date().toISOString(), status: 'In Progress' })
        .eq('id', ticketId);

      return res.json({ 
        success: true, 
        note: 'Message saved. Send via WhatsApp: wacli send text --to "' + ticket.customer_phone + '" --message "' + message.replace(/"/g, '\\"') + '"'
      });
    }

    return res.status(400).json({ error: 'unknown action: ' + action });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
