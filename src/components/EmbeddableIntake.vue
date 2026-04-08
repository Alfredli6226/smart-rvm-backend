<template>
  <div class="embeddable-intake">
    <div class="intake-header">
      <h3>{{ title }}</h3>
      <p v-if="description">{{ description }}</p>
    </div>
    
    <form @submit.prevent="submitForm" class="intake-form">
      <!-- Name -->
      <div class="form-group">
        <label for="name">Name *</label>
        <input
          id="name"
          v-model="formData.name"
          type="text"
          placeholder="Your name"
          required
          :disabled="loading"
        />
      </div>
      
      <!-- Email -->
      <div class="form-group">
        <label for="email">Email *</label>
        <input
          id="email"
          v-model="formData.email"
          type="email"
          placeholder="your@email.com"
          required
          :disabled="loading"
        />
      </div>
      
      <!-- Phone -->
      <div class="form-group">
        <label for="phone">Phone</label>
        <input
          id="phone"
          v-model="formData.phone"
          type="tel"
          placeholder="+60 12 345 6789"
          :disabled="loading"
        />
      </div>
      
      <!-- Company -->
      <div class="form-group" v-if="showCompanyField">
        <label for="company">Company</label>
        <input
          id="company"
          v-model="formData.company"
          type="text"
          placeholder="Your company"
          :disabled="loading"
        />
      </div>
      
      <!-- Subject -->
      <div class="form-group">
        <label for="subject">Subject *</label>
        <input
          id="subject"
          v-model="formData.subject"
          type="text"
          :placeholder="subjectPlaceholder"
          required
          :disabled="loading"
        />
      </div>
      
      <!-- Message -->
      <div class="form-group">
        <label for="message">Message *</label>
        <textarea
          id="message"
          v-model="formData.message"
          :placeholder="messagePlaceholder"
          rows="3"
          required
          :disabled="loading"
        ></textarea>
      </div>
      
      <!-- Inquiry Type (if enabled) -->
      <div class="form-group" v-if="showInquiryType">
        <label for="inquiryType">Inquiry Type</label>
        <select
          id="inquiryType"
          v-model="formData.inquiryType"
          :disabled="loading"
        >
          <option value="">Select...</option>
          <option value="sales">Sales / Quotation</option>
          <option value="support">Support</option>
          <option value="partnership">Partnership</option>
          <option value="general">General</option>
        </select>
      </div>
      
      <!-- Hidden fields for tracking -->
      <input type="hidden" v-model="formData.source" />
      <input type="hidden" v-model="formData.campaign" />
      <input type="hidden" v-model="formData.referral" />
      
      <!-- Submit -->
      <div class="form-footer">
        <button type="submit" :disabled="loading" class="submit-btn">
          <span v-if="loading">Sending...</span>
          <span v-else>{{ submitText }}</span>
        </button>
        
        <div v-if="success" class="success-message">
          <div class="success-icon">✓</div>
          <p>{{ successMessage }}</p>
          <p v-if="referenceNumber" class="reference">
            Reference: <strong>{{ referenceNumber }}</strong>
          </p>
        </div>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
        
        <p v-if="privacyText" class="privacy-note">
          {{ privacyText }}
        </p>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';

interface Props {
  title?: string;
  description?: string;
  submitText?: string;
  subjectPlaceholder?: string;
  messagePlaceholder?: string;
  privacyText?: string;
  showCompanyField?: boolean;
  showInquiryType?: boolean;
  defaultSource?: string;
  defaultCampaign?: string;
  defaultReferral?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Contact Us',
  description: 'Send us a message and we\'ll get back to you soon.',
  submitText: 'Send Message',
  subjectPlaceholder: 'Brief summary of your inquiry',
  messagePlaceholder: 'How can we help you?',
  privacyText: 'We respect your privacy and will never share your information.',
  showCompanyField: true,
  showInquiryType: true,
  defaultSource: 'embedded_form',
  defaultCampaign: '',
  defaultReferral: '',
});

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  subject: string;
  message: string;
  inquiryType: string;
  source: string;
  campaign: string;
  referral: string;
}

const formData = reactive<FormData>({
  name: '',
  email: '',
  phone: '',
  company: '',
  subject: '',
  message: '',
  inquiryType: '',
  source: props.defaultSource,
  campaign: props.defaultCampaign,
  referral: props.defaultReferral,
});

const loading = ref(false);
const success = ref(false);
const error = ref('');
const successMessage = ref('');
const referenceNumber = ref('');

// Set tracking from URL parameters
onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search);
  formData.source = urlParams.get('source') || props.defaultSource;
  formData.campaign = urlParams.get('campaign') || props.defaultCampaign;
  formData.referral = urlParams.get('referral') || props.defaultReferral;
});

const submitForm = async () => {
  loading.value = true;
  error.value = '';

  try {
    const payload = {
      ...formData,
      channel: 'website' as const,
    };

    const response = await fetch('/api/intake', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.success) {
      successMessage.value = result.message || 'Message sent successfully!';
      referenceNumber.value = result.ticketNumber || result.leadNumber;
      success.value = true;
      
      // Reset form for next submission
      Object.assign(formData, {
        name: '',
        email: '',
        phone: '',
        company: '',
        subject: '',
        message: '',
        inquiryType: '',
        // Keep tracking fields
        source: formData.source,
        campaign: formData.campaign,
        referral: formData.referral,
      });
    } else {
      error.value = result.error || 'Failed to send message. Please try again.';
    }
  } catch (err) {
    console.error('Form submission error:', err);
    error.value = 'Network error. Please check your connection and try again.';
  } finally {
    loading.value = false;
  }
};

// Expose reset function for parent components
const resetForm = () => {
  success.value = false;
  successMessage.value = '';
  referenceNumber.value = '';
  error.value = '';
};

defineExpose({
  resetForm,
});
</script>

<style scoped>
.embeddable-intake {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  max-width: 500px;
  margin: 0 auto;
}

.intake-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.intake-header h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem;
}

.intake-header p {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
  line-height: 1.5;
}

.intake-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.375rem;
}

input, select, textarea {
  padding: 0.625rem 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: all 0.2s;
  background: white;
  font-family: inherit;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

input:disabled, select:disabled, textarea:disabled {
  background-color: #f9fafb;
  cursor: not-allowed;
}

textarea {
  resize: vertical;
  min-height: 80px;
}

.form-footer {
  margin-top: 0.5rem;
}

.submit-btn {
  width: 100%;
  background: #3b82f6;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: #2563eb;
}

.submit-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.success-message {
  margin-top: 1rem;
  padding: 1rem;
  background: #d1fae5;
  border: 1px solid #a7f3d0;
  border-radius: 6px;
  text-align: center;
}

.success-icon {
  width: 40px;
  height: 40px;
  background: #10b981;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: bold;
  margin: 0 auto 0.75rem;
}

.success-message p {
  color: #065f46;
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
}

.reference {
  font-size: 0.875rem;
  color: #065f46;
  font-weight: 500;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 0.875rem;
  text-align: center;
}

.privacy-note {
  margin-top: 1rem;
  color: #6b7280;
  font-size: 0.75rem;
  text-align: center;
  line-height: 1.4;
}
</style>