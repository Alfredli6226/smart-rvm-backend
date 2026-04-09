import { VercelRequest, VercelResponse } from '@vercel/node';
import { intakeService } from '../src/services/intakeService.js';

/**
 * Intake API Endpoint
 * 
 * Handles intake requests from website forms, WhatsApp webhooks, and other channels.
 * Supports both JSON payloads and form data.
 * 
 * Usage:
 * - Website form: POST /api/intake with JSON payload
 * - WhatsApp webhook: POST /api/intake/whatsapp with WhatsApp payload format
 * - Test endpoint: GET /api/intake/test for testing
 */

// Shared secret for webhook authentication (optional)
const WEBHOOK_SECRET = process.env.INTAKE_WEBHOOK_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Route based on path
  const path = req.url?.split('?')[0] || '';
  
  if (req.method === 'GET' && path === '/api/intake/test') {
    return handleTest(req, res);
  }
  
  if (req.method === 'POST' && path === '/api/intake/whatsapp') {
    return handleWhatsAppWebhook(req, res);
  }
  
  if (req.method === 'POST' && path === '/api/intake') {
    return handleGenericIntake(req, res);
  }

  // Default 404 for other routes
  return res.status(404).json({ error: 'Not found' });
}

/**
 * Handle generic intake requests (website forms, etc.)
 */
async function handleGenericIntake(req: VercelRequest, res: VercelResponse) {
  try {
    // Parse request body
    let payload: any;
    
    if (req.headers['content-type']?.includes('application/json')) {
      payload = req.body;
    } else if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      // Parse form data
      const params = new URLSearchParams(req.body as string);
      payload = {
        name: params.get('name'),
        email: params.get('email'),
        phone: params.get('phone'),
        company: params.get('company'),
        subject: params.get('subject'),
        message: params.get('message'),
        channel: params.get('channel') || 'website',
        source: params.get('source'),
        campaign: params.get('campaign'),
        referral: params.get('referral'),
      };
    } else {
      return res.status(400).json({ error: 'Unsupported content type' });
    }

    // Validate required fields
    if (!payload.message && !payload.subject) {
      return res.status(400).json({ error: 'Message or subject is required' });
    }

    // Set default channel if not provided
    if (!payload.channel) {
      payload.channel = 'website';
    }

    // Process intake
    const result = await intakeService.processIntake(payload);

    if (result.success) {
      return res.status(201).json({
        success: true,
        message: result.message,
        ticketId: result.ticketId,
        leadId: result.leadId,
        ticketNumber: result.ticket?.ticket_number,
        leadNumber: result.lead?.lead_number,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.message,
        warnings: result.warnings,
      });
    }
  } catch (error) {
    console.error('Intake API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Handle WhatsApp webhook requests
 */
async function handleWhatsAppWebhook(req: VercelRequest, res: VercelResponse) {
  try {
    // Verify webhook secret if configured
    if (WEBHOOK_SECRET) {
      const authHeader = req.headers['authorization'];
      if (!authHeader || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // Parse WhatsApp payload
    const payload = req.body;
    
    // Extract message data from common WhatsApp webhook formats
    let name, phone, message, mediaUrl;
    
    // Format 1: Standard WhatsApp Business API
    if (payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const msg = payload.entry[0].changes[0].value.messages[0];
      const contact = payload.entry[0].changes[0].value.contacts?.[0];
      
      name = contact?.profile?.name || contact?.name || 'WhatsApp User';
      phone = msg.from;
      message = msg.text?.body || 'Media message received';
      
      if (msg.type === 'image' || msg.type === 'document') {
        mediaUrl = msg[msg.type]?.link;
      }
    }
    // Format 2: Simple JSON format
    else if (payload.name || payload.phone || payload.message) {
      name = payload.name;
      phone = payload.phone;
      message = payload.message;
      mediaUrl = payload.mediaUrl;
    }
    // Format 3: Form data
    else if (typeof req.body === 'string' && req.body.includes('name=')) {
      const params = new URLSearchParams(req.body);
      name = params.get('name');
      phone = params.get('phone');
      message = params.get('message');
      mediaUrl = params.get('mediaUrl');
    }
    else {
      return res.status(400).json({ error: 'Invalid WhatsApp webhook format' });
    }

    // Create intake payload
    const intakePayload = {
      name: name || 'WhatsApp User',
      phone: phone || 'Unknown',
      subject: `WhatsApp Inquiry from ${name || phone || 'User'}`,
      message: message || 'No message provided',
      channel: 'whatsapp' as const,
      source: 'whatsapp',
      metadata: mediaUrl ? {
        attachments: [mediaUrl],
        customFields: {
          whatsappMessageType: 'text',
        },
      } : undefined,
    };

    // Process intake
    const result = await intakeService.processIntake(intakePayload);

    if (result.success) {
      return res.status(201).json({
        success: true,
        message: result.message,
        ticketId: result.ticketId,
        leadId: result.leadId,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.message,
      });
    }
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Test endpoint for intake service
 */
async function handleTest(req: VercelRequest, res: VercelResponse) {
  const testPayloads = [
    {
      name: 'Test User',
      email: 'test@example.com',
      phone: '+60123456789',
      subject: 'Quotation Request',
      message: 'I need a quotation for 5 food waste machines for my restaurants.',
      channel: 'website' as const,
      source: 'contact_form',
    },
    {
      name: 'WhatsApp Test',
      phone: '+60129876543',
      subject: 'WhatsApp Inquiry',
      message: 'Hi, I have a problem with my RVM machine.',
      channel: 'whatsapp' as const,
      source: 'whatsapp',
    },
    {
      name: 'Sales Lead',
      company: 'ABC Corporation',
      email: 'sales@abccorp.com',
      subject: 'Corporate Partnership Inquiry',
      message: 'We are interested in deploying RVMs across our retail chain.',
      channel: 'email' as const,
      source: 'email',
    },
  ];

  const results = [];
  
  for (const payload of testPayloads) {
    const result = await intakeService.processIntake(payload);
    results.push({
      payload: { ...payload, message: payload.message.substring(0, 50) + '...' },
      result,
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Intake service test completed',
    results,
    channels: intakeService.getChannels(),
  });
}
