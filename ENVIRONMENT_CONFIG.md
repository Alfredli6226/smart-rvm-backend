# Environment Configuration Guide

This document outlines the environment variables and configuration needed for the enhanced customer service features.

## Required Environment Variables

### Supabase Configuration
These should already be configured for the base application:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### AI Features Configuration
For AI-powered customer service features:

```env
# Enable/disable AI features (default: false)
VITE_AI_ENABLED=true

# AI model to use (options: 'mock', 'openai', 'anthropic', 'google')
VITE_AI_MODEL=mock

# OpenAI Configuration (if using OpenAI)
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_OPENAI_MODEL=gpt-4-turbo-preview

# Anthropic Configuration (if using Anthropic)
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key
VITE_ANTHROPIC_MODEL=claude-3-opus-20240229

# Google AI Configuration (if using Google)
VITE_GOOGLE_AI_API_KEY=your_google_ai_api_key
VITE_GOOGLE_AI_MODEL=gemini-pro
```

### Telegram Alert Configuration
For Telegram alerts on hot leads/critical tickets:

```env
# Telegram Bot Token (from @BotFather)
VITE_TELEGRAM_BOT_TOKEN=your_bot_token_here

# Telegram Chat ID (where alerts will be sent)
VITE_TELEGRAM_ALERT_CHAT_ID=your_chat_id_here

# Enable/disable specific alert types
VITE_TELEGRAM_ALERT_HOT_LEADS=true
VITE_TELEGRAM_ALERT_CRITICAL_TICKETS=true
VITE_TELEGRAM_ALERT_NEW_HIGH_PRIORITY=true
```

### Intake Webhook Configuration
For receiving intake from website/WhatsApp/social:

```env
# Intake API endpoint (for external systems to POST to)
VITE_INTAKE_API_ENABLED=true
VITE_INTAKE_API_SECRET=your_shared_secret_for_webhooks

# Webhook URLs for different channels
VITE_WHATSAPP_WEBHOOK_URL=/api/intake/whatsapp
VITE_WEBSITE_WEBHOOK_URL=/api/intake/website
VITE_SOCIAL_WEBHOOK_URL=/api/intake/social
```

## Feature Flags

### AI Features
- **Summary Generation**: Automatically generates AI summaries for tickets
- **Suggested Replies**: Provides AI-generated reply suggestions
- **Sentiment Analysis**: Analyzes customer sentiment from messages
- **Action Recommendations**: Suggests next actions based on ticket context

### Telegram Alerts
- **Hot Lead Alerts**: Sends Telegram alerts for leads marked as 'hot'
- **Critical Ticket Alerts**: Alerts for tickets with 'Critical' priority
- **New High Priority Alerts**: Alerts for new tickets with 'High' priority
- **Escalation Alerts**: Alerts when tickets are escalated

### Intake System
- **Multi-channel Support**: Website, WhatsApp, Email, Phone, Social, In-person
- **Automatic Classification**: Classifies inquiries based on content and channel
- **Lead/Ticket Routing**: Automatically creates tickets or leads based on inquiry type
- **AI Processing**: Optional AI processing for summaries and classification

## Database Schema Updates

The following tables have been added or enhanced:

### New Tables
1. `ai_suggestions` - Stores AI-generated suggestions for tickets
   - `ticket_id` (UUID, references customer_service_tickets)
   - `type` (enum: 'summary', 'reply', 'action', 'sentiment')
   - `content` (text)
   - `confidence` (numeric)
   - `created_at` (timestamptz)

### Enhanced Tables
1. `customer_service_tickets` - Added new fields:
   - `channel` (text) - Source channel (website, whatsapp, email, etc.)
   - `ai_suggested_reply` (text) - AI-generated reply suggestion
   - `ai_recommended_action` (text) - AI-recommended next action
   - `ai_escalation_reason` (text) - Reason for escalation
   - `next_action` (text) - Next action to take
   - `last_message_at` (timestamptz) - Timestamp of last message

## API Endpoints

### Intake API (POST endpoints)
```
POST /api/intake/website
POST /api/intake/whatsapp  
POST /api/intake/email
POST /api/intake/social
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+60123456789",
  "company": "ABC Corp",
  "subject": "Quotation Request",
  "message": "I need a quotation for 10 food waste machines",
  "channel": "website",
  "source": "contact_form",
  "campaign": "spring_promo_2024",
  "metadata": {
    "url": "https://example.com/contact",
    "userAgent": "Mozilla/5.0...",
    "ipAddress": "192.168.1.1"
  }
}
```

### AI Processing API (Internal)
```
POST /api/ai/summary/:ticketId
POST /api/ai/reply/:ticketId
POST /api/ai/action/:ticketId
```

## Setup Instructions

### 1. Database Setup
Run the SQL migration:
```bash
psql -h your-db-host -U your-user -d your-database -f create_customer_service_tables.sql
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Telegram Bot Setup
1. Create a bot with [@BotFather](https://t.me/botfather)
2. Get the bot token
3. Add the bot to your alert channel/group
4. Get the chat ID (use @getidsbot or similar)
5. Add token and chat ID to environment variables

### 4. AI Service Setup (Optional)
For production AI features:
1. Choose an AI provider (OpenAI, Anthropic, Google)
2. Get API key from provider
3. Set `VITE_AI_MODEL` to provider name
4. Set corresponding API key environment variable

## Testing

### Test AI Features
1. Create a new ticket
2. Add some messages
3. Click "Regenerate" in AI Summary section
4. Verify AI suggestions appear

### Test Telegram Alerts
1. Create a ticket with 'Critical' priority
2. Check Telegram for alert (if configured)
3. Or check browser console for mock alert message

### Test Intake System
```javascript
// Example test request
fetch('/api/intake/website', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Test User',
    email: 'test@example.com',
    subject: 'Test Inquiry',
    message: 'This is a test message',
    channel: 'website'
  })
})
```

## Troubleshooting

### AI Features Not Working
1. Check `VITE_AI_ENABLED` is set to `true`
2. Check browser console for errors
3. Verify database connection

### Telegram Alerts Not Sending
1. Check `VITE_TELEGRAM_BOT_TOKEN` and `VITE_TELEGRAM_ALERT_CHAT_ID`
2. Verify bot has permission to send messages
3. Check browser console for API errors

### Intake API Failing
1. Check database connection
2. Verify required fields in request
3. Check CORS configuration if calling from external domain

## Security Notes

1. **API Keys**: Never commit API keys to version control
2. **Webhook Security**: Use shared secrets for webhook authentication
3. **Rate Limiting**: Implement rate limiting for public endpoints
4. **Input Validation**: Always validate and sanitize intake data
5. **RLS Policies**: Ensure Row Level Security is properly configured

## Monitoring

Recommended monitoring points:
1. AI API call success rates
2. Telegram alert delivery rates
3. Intake processing latency
4. Database query performance
5. Error rates by feature