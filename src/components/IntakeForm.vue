<template>
  <div class="intake-form">
    <div v-if="success" class="success-message">
      <div class="success-icon">✓</div>
      <h3>Thank You!</h3>
      <p>{{ successMessage }}</p>
      <p v-if="referenceNumber" class="reference">
        Reference: <strong>{{ referenceNumber }}</strong>
      </p>
      <button @click="resetForm" class="btn-secondary">
        Submit Another Inquiry
      </button>
    </div>

    <form v-else @submit.prevent="submitForm" class="form-container">
      <div class="form-header">
        <h2>Contact Us</h2>
        <p>Fill out the form below and we'll get back to you soon.</p>
      </div>

      <div class="form-grid">
        <!-- Personal Information -->
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

        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="formData.email"
            type="email"
            placeholder="your@email.com"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="phone">Phone *</label>
          <input
            id="phone"
            v-model="formData.phone"
            type="tel"
            placeholder="+60 12 345 6789"
            required
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="company">Company</label>
          <input
            id="company"
            v-model="formData.company"
            type="text"
            placeholder="Your company name"
            :disabled="loading"
          />
        </div>

        <!-- Inquiry Details -->
        <div class="form-group col-span-2">
          <label for="subject">Subject *</label>
          <input
            id="subject"
            v-model="formData.subject"
            type="text"
            placeholder="Brief summary of your inquiry"
            required
            :disabled="loading"
          />
        </div>

        <div class="form-group col-span-2">
          <label for="message">Message *</label>
          <textarea
            id="message"
            v-model="formData.message"
            placeholder="Please provide details about your inquiry..."
            rows="4"
            required
            :disabled="loading"
          ></textarea>
        </div>

        <!-- Inquiry Type -->
        <div class="form-group col-span-2">
          <label for="inquiryType">Inquiry Type</label>
          <select
            id="inquiryType"
            v-model="formData.inquiryType"
            :disabled="loading"
          >
            <option value="">Select an option</option>
            <option value="sales">Sales / Quotation</option>
            <option value="support">Technical Support</option>
            <option value="partnership">Business Partnership</option>
            <option value="general">General Inquiry</option>
            <option value="complaint">Complaint</option>
          </select>
        </div>

        <!-- Source Tracking (Hidden by default) -->
        <input type="hidden" v-model="formData.source" />
        <input type="hidden" v-model="formData.campaign" />
        <input type="hidden" v-model="formData.referral" />
      </div>

      <!-- Submit Button -->
      <div class="form-footer">
        <button type="submit" :disabled="loading" class="btn-primary">
          <span v-if="loading">Sending...</span>
          <span v-else>Submit Inquiry</span>
        </button>
        
        <p v-if="error" class="error-message">{{ error }}</p>
        <p class="form-note">
          We typically respond within 24 hours. For urgent matters, please call us directly.
        </p>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';

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
  source: 'website_form',
  campaign: '',
  referral: '',
});

const loading = ref(false);
const success = ref(false);
const error = ref('');
const successMessage = ref('');
const referenceNumber = ref('');

// Set source from URL parameters
onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search);
  formData.source = urlParams.get('source') || 'website_form';
  formData.campaign = urlParams.get('campaign') || '';
  formData.referral = urlParams.get('referral') || '';
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
      successMessage.value = result.message;
      referenceNumber.value = result.ticketNumber || result.leadNumber;
      success.value = true;
      
      // Reset form data for next submission
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
      error.value = result.error || 'Failed to submit form. Please try again.';
    }
  } catch (err) {
    console.error('Form submission error:', err);
    error.value = 'Network error. Please check your connection and try again.';
  } finally {
    loading.value = false;
  }
};

const resetForm = () => {
  success.value = false;
  successMessage.value = '';
  referenceNumber.value = '';
  error.value = '';
};
</script>

<style scoped>
.intake-form {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.form-header {
  margin-bottom: 2rem;
  text-align: center;
}

.form-header h2 {
  font-size: 1.875rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.form-header p {
  color: #6b7280;
  font-size: 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group.col-span-2 {
  grid-column: span 2;
}

label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

input, select, textarea {
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;
  background: white;
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
  min-height: 100px;
}

.form-footer {
  text-align: center;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  padding: 0.875rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  min-width: 200px;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6b7280;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 1rem;
}

.btn-secondary:hover {
  background: #4b5563;
}

.error-message {
  color: #dc2626;
  font-size: 0.875rem;
  margin-top: 1rem;
}

.form-note {
  color: #6b7280;
  font-size: 0.875rem;
  margin-top: 1rem;
}

.success-message {
  text-align: center;
  padding: 3rem 2rem;
}

.success-icon {
  width: 64px;
  height: 64px;
  background: #10b981;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
  margin: 0 auto 1.5rem;
}

.success-message h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 1rem;
}

.success-message p {
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.reference {
  font-size: 1.125rem;
  color: #1f2937;
  margin: 1.5rem 0;
}

/* Responsive */
@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .form-group.col-span-2 {
    grid-column: span 1;
  }
  
  .intake-form {
    padding: 1.5rem;
  }
}
</style>