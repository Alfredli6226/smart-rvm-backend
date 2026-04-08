# Intake Integration - RVM Merchant Platform

## Quick Start

### 1. **Database Setup**
```bash
# Run the customer service tables SQL
psql -f create_customer_service_tables.sql
```

### 2. **Environment Configuration**
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
# Required: Supabase credentials
# Optional: WhatsApp webhook secret, Telegram alerts
```

### 3. **Start Development Server**
```bash
npm run dev
```

### 4. **Test the Integration**
```bash
# Run all tests
node test-intake.js

# Test specific endpoints
node test-intake.js website
node test-intake.js whatsapp
node test-intake.js api
```

## What's Implemented

### ✅ **Website Intake Flow**
- **Component**: `IntakeForm.vue` - Standalone form component
- **Page**: `IntakePage.vue` - Complete contact page (`/contact`)
- **Embeddable**: `EmbeddableIntake.vue` - Lightweight form for embedding
- **API**: `POST /api/intake` - Handles form submissions

### ✅ **WhatsApp Intake Path**
- **API**: `POST /api/intake/whatsapp` - Webhook-ready handler
- **Formats**: Supports multiple WhatsApp payload formats
- **Security**: Optional webhook secret authentication
- **Normalization**: Converts WhatsApp payloads to unified intake format

### ✅ **Unified Intake Creation**
- **Service**: `intakeService.ts` - Processes all intake channels
- **Classification**: Automatic category/priority/lead scoring
- **Routing**: Creates tickets or leads based on inquiry type
- **Database**: Stores in `customer_service_tickets` or `customer_service_leads`

### ✅ **Admin Visibility**
- **Inbox**: `/customer-service` - View all customer service tickets
- **Leads**: `/leads` - View all sales leads
- **Thread Detail**: `/customer-service/:id` - View individual ticket conversations
- **Real-time**: Updates appear immediately in admin interfaces

### ✅ **Mock-Safe Fallback**
- **Graceful Degradation**: Works without external APIs
- **Mock Data**: Uses sample data when database unavailable
- **Error Handling**: Comprehensive error handling at all levels

## Usage Examples

### 1. **Embed Form in Existing Page**
```vue
<template>
  <div>
    <EmbeddableIntake 
      title="Contact Sales"
      description="Get a quotation for RVM or food waste machines"
      submitText="Request Quote"
      :showCompanyField="true"
      :showInquiryType="true"
    />
  </div>
</template>

<script setup>
import EmbeddableIntake from './components/EmbeddableIntake.vue';
</script>
```

### 2. **Submit Form via JavaScript**
```javascript
const submitInquiry = async (formData) => {
  const response = await fetch('/api/intake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: formData.name,
      email: formData.email,
      subject: formData.subject,
      message: formData.message,
      channel: 'website',
      source: 'your_website',
    }),
  });
  
  const result = await response.json();
  if (result.success) {
    alert(`Thank you! Reference: ${result.ticketNumber || result.leadNumber}`);
  }
};
```

### 3. **Configure WhatsApp Webhook**
```bash
# Set webhook secret
export INTAKE_WEBHOOK_SECRET="your-secret-key"

# Configure WhatsApp Business API webhook
Webhook URL: https://your-domain.com/api/intake/whatsapp
Authentication: Bearer your-secret-key
```

### 4. **Test Webhook with curl**
```bash
curl -X POST http://localhost:5173/api/intake/whatsapp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-key" \
  -d '{
    "name": "John Doe",
    "phone": "+60123456789",
    "message": "Need help with machine installation"
  }'
```

## Database Schema

### Tables Created
```sql
-- Customer service tickets
CREATE TABLE customer_service_tickets (...);

-- Ticket messages
CREATE TABLE customer_service_messages (...);

-- Sales leads  
CREATE TABLE customer_service_leads (...);

-- AI suggestions
CREATE TABLE ai_suggestions (...);
```

### Key Fields
- **Tickets**: `ticket_number`, `category`, `priority`, `status`, `channel`, `source`
- **Leads**: `lead_number`, `status`, `lead_score`, `source`, `inquiry_type`
- **Messages**: `message_type`, `sender_type`, `is_internal`

## Classification Logic

### Automatic Classification
- **Sales/Quotation**: Detects words like "quote", "price", "quotation"
- **Support**: Detects words like "problem", "issue", "help", "not working"
- **Priority**: "urgent", "emergency", "asap" trigger high priority
- **Lead Score**: Business inquiries get "hot" score

### Channel-Specific Rules
- **Website**: Medium priority, warm lead score by default
- **WhatsApp**: High priority (assumed urgent)
- **Phone**: High priority, hot lead score
- **In-person**: Hot lead score (high intent)

## Monitoring & Debugging

### Check Database
```sql
-- Recent tickets
SELECT ticket_number, subject, category, priority, channel 
FROM customer_service_tickets 
ORDER BY created_at DESC 
LIMIT 10;

-- Recent leads
SELECT lead_number, company_name, status, lead_score, source
FROM customer_service_leads 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Admin Interface
1. Login to admin panel
2. Navigate to **Customer Service Inbox** (`/customer-service`)
3. Check for new tickets
4. Navigate to **Leads Manager** (`/leads`) for sales inquiries

### Test Endpoints
```bash
# Test API is working
curl http://localhost:5173/api/intake/test

# Test form submission
curl -X POST http://localhost:5173/api/intake \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","subject":"Test","message":"Test","channel":"website"}'
```

## Customization

### Modify Classification Rules
Edit `src/services/intakeService.ts`:
```typescript
private classifyWebsiteInquiry(payload: IntakePayload) {
  // Add custom rules
  if (payload.message.includes('your_keyword')) {
    return {
      category: 'Custom Category',
      priority: 'High',
      leadScore: 'hot',
      tags: ['custom'],
      isLead: true,
    };
  }
  // ... existing logic
}
```

### Add New Channel
```typescript
// Add to channelClassifiers
'new-channel': this.classifyNewChannel.bind(this),

// Implement classifier
private classifyNewChannel(payload: IntakePayload) {
  return {
    category: 'General',
    priority: 'Medium',
    leadScore: 'warm',
    tags: ['new-channel'],
    isLead: false,
  };
}
```

### Custom Form Fields
Modify `EmbeddableIntake.vue` or `IntakeForm.vue` to add:
- Additional input fields
- Custom validation
- Specialized submission logic

## Next Steps

### 1. **Production Deployment**
- Configure production environment variables
- Set up SSL certificates
- Implement rate limiting
- Configure monitoring and alerts

### 2. **Integration Enhancements**
- Connect to CRM system (Salesforce, HubSpot)
- Add email notifications
- Implement SMS alerts
- Add file upload support

### 3. **Advanced Features**
- AI-powered response suggestions
- Multilingual support
- Chatbot integration
- Advanced analytics and reporting

## Support

### Documentation
- Full guide: `INTAKE_INTEGRATION_GUIDE.md`
- API reference: Check `api/intake.ts`
- Component docs: Check Vue component files

### Testing
- Test script: `test-intake.js`
- Manual testing: Visit `/contact` and submit form
- API testing: Use `curl` commands above

### Issues
1. Check browser console for errors
2. Check server logs for API errors  
3. Verify database connection and permissions
4. Test with sample payloads using test script

## License & Credits
Part of the RVM Merchant Platform. Built with Vue 3, TypeScript, and Supabase.