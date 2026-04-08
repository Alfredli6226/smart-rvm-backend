# Intake Integration Guide

## Overview
This guide explains how to integrate the intake system for website forms and WhatsApp webhooks into the RVM merchant platform customer service backend.

## Architecture

### 1. **Intake Service** (`src/services/intakeService.ts`)
- **Purpose**: Unified intake processing for all channels
- **Features**:
  - Multi-channel support (website, WhatsApp, email, phone, social, in-person)
  - Automatic classification based on content and channel
  - Lead/ticket routing logic
  - Payload validation and processing
  - Channel-specific classification rules
- **Input**: `IntakePayload` interface
- **Output**: Creates tickets in `customer_service_tickets` or leads in `customer_service_leads`

### 2. **API Endpoints** (`api/intake.ts`)
- **`POST /api/intake`**: Generic intake endpoint for website forms
- **`POST /api/intake/whatsapp`**: WhatsApp webhook endpoint
- **`GET /api/intake/test`**: Test endpoint for verification
- **Authentication**: Optional webhook secret via `INTAKE_WEBHOOK_SECRET`

### 3. **Frontend Components**
- **`IntakeForm.vue`**: Standalone form component
- **`EmbeddableIntake.vue`**: Lightweight form for embedding in existing pages
- **`IntakePage.vue`**: Complete contact page with form

### 4. **Database Schema**
- **`customer_service_tickets`**: Stores customer service inquiries
- **`customer_service_leads`**: Stores sales/potential business leads
- **`customer_service_messages`**: Stores conversation history
- **`ai_suggestions`**: Stores AI-generated content

## Integration Steps

### 1. **Website Form Integration**

#### Option A: Use Standalone Contact Page
```html
<!-- Link to the built-in contact page -->
<a href="/contact">Contact Us</a>
```

#### Option B: Embed Form in Existing Page
```vue
<template>
  <div>
    <EmbeddableIntake 
      title="Get in Touch"
      description="Send us a message"
      submitText="Send Message"
      :showCompanyField="true"
      :showInquiryType="true"
    />
  </div>
</template>

<script setup>
import EmbeddableIntake from '../components/EmbeddableIntake.vue';
</script>
```

#### Option C: Custom Form with API Call
```javascript
// Submit form data to intake API
const submitForm = async (formData) => {
  const response = await fetch('/api/intake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      subject: formData.subject,
      message: formData.message,
      channel: 'website',
      source: 'your_website_form',
      campaign: 'optional_campaign_name',
      referral: 'optional_referral_source',
    }),
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('Ticket created:', result.ticketNumber);
  }
};
```

### 2. **WhatsApp Webhook Integration**

#### Step 1: Configure WhatsApp Business API
1. Set up WhatsApp Business API account
2. Configure webhook URL: `https://your-domain.com/api/intake/whatsapp`
3. Set webhook secret in environment: `INTAKE_WEBHOOK_SECRET`

#### Step 2: Test Webhook
```bash
# Test with curl
curl -X POST https://your-domain.com/api/intake/whatsapp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -d '{
    "name": "Test User",
    "phone": "+60123456789",
    "message": "Test WhatsApp message"
  }'
```

#### Step 3: Handle WhatsApp Payloads
The system supports multiple WhatsApp webhook formats:
- **Standard WhatsApp Business API format**
- **Simple JSON format** (name, phone, message)
- **Form data format**

### 3. **Environment Configuration**

#### Required Environment Variables
```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env with your values
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: WhatsApp webhook security
INTAKE_WEBHOOK_SECRET=your_shared_secret

# Optional: Telegram alerts
VITE_TELEGRAM_BOT_TOKEN=your_bot_token
VITE_TELEGRAM_ALERT_CHAT_ID=your_chat_id
```

### 4. **Database Setup**
```bash
# Run the SQL schema
psql -f create_customer_service_tables.sql
```

## Testing

### 1. **Test Website Form**
1. Navigate to `/contact`
2. Fill out the form
3. Submit and verify success message
4. Check database for created ticket/lead

### 2. **Test API Endpoint**
```bash
# Test generic intake
curl -X POST http://localhost:5173/api/intake \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "subject": "Test Inquiry",
    "message": "This is a test message",
    "channel": "website"
  }'

# Test WhatsApp webhook
curl -X POST http://localhost:5173/api/intake/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "name": "WhatsApp User",
    "phone": "+60123456789",
    "message": "Test WhatsApp message"
  }'
```

### 3. **Test Classification**
```javascript
// Test classification logic
import { intakeService } from './src/services/intakeService';

const testPayload = {
  name: 'Business Owner',
  company: 'ABC Restaurant',
  subject: 'Quotation Request',
  message: 'Need prices for 5 food waste machines',
  channel: 'website'
};

const classification = intakeService.testClassification(testPayload);
console.log('Classification:', classification);
// Output: { category: 'Sales', priority: 'High', leadScore: 'hot', ... }
```

## Monitoring & Debugging

### 1. **Check Created Records**
```sql
-- Check tickets
SELECT * FROM customer_service_tickets ORDER BY created_at DESC LIMIT 10;

-- Check leads  
SELECT * FROM customer_service_leads ORDER BY created_at DESC LIMIT 10;

-- Check messages
SELECT * FROM customer_service_messages ORDER BY created_at DESC LIMIT 10;
```

### 2. **View in Admin Interface**
1. Login to admin panel
2. Navigate to **Customer Service Inbox** (`/customer-service`)
3. Check for new tickets in the inbox
4. Navigate to **Leads Manager** (`/leads`) for sales leads

### 3. **Error Logging**
- Check browser console for frontend errors
- Check server logs for API errors
- Check Supabase logs for database errors

## Advanced Configuration

### 1. **Custom Classification Rules**
Modify `src/services/intakeService.ts` to add custom classification logic:

```typescript
private classifyWebsiteInquiry(payload: IntakePayload) {
  const classification = this.defaultClassification(payload);
  
  // Add custom rules
  if (payload.message.includes('your_keyword')) {
    classification.category = 'Custom Category';
    classification.priority = 'High';
  }
  
  return classification;
}
```

### 2. **Custom Channel Support**
Add new channel classifiers:

```typescript
private channelClassifiers: Record<string, ChannelClassifier> = {
  // Existing channels...
  'custom-channel': this.classifyCustomChannel.bind(this),
};

private classifyCustomChannel(payload: IntakePayload) {
  return {
    category: 'Custom',
    priority: 'Medium',
    leadScore: 'warm',
    tags: ['custom-channel'],
    isLead: false,
  };
}
```

### 3. **Webhook Security**
```typescript
// Add additional security checks
async handleWhatsAppWebhook(req: VercelRequest, res: VercelResponse) {
  // IP whitelisting
  const allowedIPs = ['192.168.1.1', '10.0.0.1'];
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  if (!allowedIPs.includes(clientIP as string)) {
    return res.status(403).json({ error: 'IP not allowed' });
  }
  
  // Rate limiting
  // ... implement rate limiting logic
  
  // Process webhook...
}
```

## Troubleshooting

### Common Issues

#### 1. **Form Submission Fails**
- Check browser console for errors
- Verify API endpoint is accessible
- Check CORS configuration
- Verify required fields are provided

#### 2. **No Records in Database**
- Check Supabase connection
- Verify table permissions (RLS policies)
- Check for database errors in logs
- Verify payload matches expected format

#### 3. **WhatsApp Webhook Not Working**
- Verify webhook URL is correct
- Check authentication header
- Verify payload format matches expected
- Check server logs for errors

#### 4. **Classification Not Working**
- Check classification rules in intakeService.ts
- Verify message content is being analyzed correctly
- Test with different message types

## Performance Considerations

### 1. **Rate Limiting**
- Implement rate limiting for API endpoints
- Consider using a CDN for static assets
- Cache frequently accessed data

### 2. **Database Optimization**
- Add indexes for frequently queried columns
- Consider partitioning for large datasets
- Implement connection pooling

### 3. **Error Handling**
- Implement retry logic for failed requests
- Add circuit breaker pattern for external services
- Log errors for monitoring and debugging

## Security Best Practices

### 1. **Input Validation**
- Validate all incoming data
- Sanitize user input
- Use parameterized queries

### 2. **Authentication & Authorization**
- Use webhook secrets for external integrations
- Implement proper RLS policies in Supabase
- Regularly rotate secrets and tokens

### 3. **Data Protection**
- Encrypt sensitive data
- Implement data retention policies
- Regular security audits

## Support & Maintenance

### 1. **Monitoring**
- Set up alerts for failed submissions
- Monitor database performance
- Track intake volume and trends

### 2. **Updates**
- Regularly update dependencies
- Review and update classification rules
- Test integrations after updates

### 3. **Backup**
- Regular database backups
- Backup configuration files
- Document customizations

## Next Steps

### 1. **Production Deployment**
1. Configure production environment variables
2. Set up SSL certificates
3. Configure monitoring and alerts
4. Perform load testing

### 2. **Integration with External Systems**
1. Connect to CRM systems
2. Integrate with email marketing platforms
3. Set up SMS notifications
4. Connect to analytics platforms

### 3. **Advanced Features**
1. Implement AI-powered response suggestions
2. Add multilingual support
3. Implement chatbot integration
4. Add file upload support

## Conclusion
The intake system provides a robust foundation for handling customer inquiries from multiple channels. Follow this guide to integrate the system into your existing infrastructure and customize it to meet your specific needs.