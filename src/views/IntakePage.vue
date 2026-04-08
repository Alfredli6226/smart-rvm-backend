<template>
  <div class="intake-page">
    <!-- Header -->
    <header class="page-header">
      <div class="container">
        <div class="header-content">
          <div class="logo">
            <h1>MyGreenPlus</h1>
            <p class="tagline">Sustainable Solutions for a Better Tomorrow</p>
          </div>
          <nav class="nav-links">
            <a href="/">Home</a>
            <a href="/about">About</a>
            <a href="/solutions">Solutions</a>
            <a href="/contact" class="active">Contact</a>
          </nav>
        </div>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="hero">
      <div class="container">
        <div class="hero-content">
          <h2>Get in Touch</h2>
          <p class="hero-description">
            Interested in our AI-powered Reverse Vending Machines, Food Waste Solutions, 
            or Sustainable Technology? Fill out the form below and our team will contact you.
          </p>
          <div class="hero-stats">
            <div class="stat">
              <div class="stat-number">24h</div>
              <div class="stat-label">Response Time</div>
            </div>
            <div class="stat">
              <div class="stat-number">95%</div>
              <div class="stat-label">Satisfaction Rate</div>
            </div>
            <div class="stat">
              <div class="stat-number">1000+</div>
              <div class="stat-label">Machines Deployed</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Main Content -->
    <main class="main-content">
      <div class="container">
        <div class="content-grid">
          <!-- Form Section -->
          <div class="form-section">
            <div class="form-card">
              <IntakeForm />
            </div>
            
            <!-- Alternative Contact Methods -->
            <div class="contact-methods">
              <h3>Other Ways to Reach Us</h3>
              <div class="methods-grid">
                <div class="method">
                  <div class="method-icon">📱</div>
                  <h4>WhatsApp</h4>
                  <p>+60 12 345 6789</p>
                  <p class="method-note">Fast response for urgent inquiries</p>
                </div>
                <div class="method">
                  <div class="method-icon">📧</div>
                  <h4>Email</h4>
                  <p>info@mygreenplus.com</p>
                  <p class="method-note">For detailed proposals and documents</p>
                </div>
                <div class="method">
                  <div class="method-icon">🏢</div>
                  <h4>Office</h4>
                  <p>Kuala Lumpur, Malaysia</p>
                  <p class="method-note">By appointment only</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Info Section -->
          <div class="info-section">
            <!-- What Happens Next -->
            <div class="info-card">
              <h3>What Happens After You Submit?</h3>
              <div class="process-steps">
                <div class="step">
                  <div class="step-number">1</div>
                  <div class="step-content">
                    <h4>Immediate Confirmation</h4>
                    <p>You'll receive a reference number and confirmation email.</p>
                  </div>
                </div>
                <div class="step">
                  <div class="step-number">2</div>
                  <div class="step-content">
                    <h4>AI Classification</h4>
                    <p>Our system automatically categorizes and prioritizes your inquiry.</p>
                  </div>
                </div>
                <div class="step">
                  <div class="step-number">3</div>
                  <div class="step-content">
                    <h4>Team Assignment</h4>
                    <p>The right specialist is assigned based on your inquiry type.</p>
                  </div>
                </div>
                <div class="step">
                  <div class="step-number">4</div>
                  <div class="step-content">
                    <h4>First Response</h4>
                    <p>You'll hear from us within 24 hours (often much sooner).</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Common Inquiries -->
            <div class="info-card">
              <h3>Common Inquiry Types</h3>
              <div class="inquiry-types">
                <div class="inquiry-type">
                  <h4>🤖 RVM Quotations</h4>
                  <p>Get pricing for AI-powered reverse vending machines for your location.</p>
                </div>
                <div class="inquiry-type">
                  <h4>🗑️ Food Waste Solutions</h4>
                  <p>Inquire about our food waste processing machines for restaurants and malls.</p>
                </div>
                <div class="inquiry-type">
                  <h4>🔧 Technical Support</h4>
                  <p>Get help with existing machines, maintenance, or troubleshooting.</p>
                </div>
                <div class="inquiry-type">
                  <h4>🤝 Partnerships</h4>
                  <p>Explore business partnerships, dealerships, or corporate deployments.</p>
                </div>
              </div>
            </div>

            <!-- FAQ -->
            <div class="info-card">
              <h3>Frequently Asked Questions</h3>
              <div class="faq-list">
                <details class="faq-item">
                  <summary>How quickly will I get a response?</summary>
                  <p>We aim to respond within 24 hours, but urgent inquiries often get same-day responses.</p>
                </details>
                <details class="faq-item">
                  <summary>Do you provide quotations?</summary>
                  <p>Yes! Provide details about your requirements and we'll send a customized quotation.</p>
                </details>
                <details class="faq-item">
                  <summary>What information should I include?</summary>
                  <p>Location, number of machines needed, business type, and any specific requirements.</p>
                </details>
                <details class="faq-item">
                  <summary>Is there a cost for consultation?</summary>
                  <p>Initial consultations are free. We only charge for actual deployments and services.</p>
                </details>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="page-footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-logo">
            <h3>MyGreenPlus</h3>
            <p>AI-powered sustainability solutions</p>
          </div>
          <div class="footer-links">
            <div class="link-group">
              <h4>Solutions</h4>
              <a href="/rvm">Reverse Vending Machines</a>
              <a href="/food-waste">Food Waste Solutions</a>
              <a href="/sustainability">Sustainability Consulting</a>
            </div>
            <div class="link-group">
              <h4>Company</h4>
              <a href="/about">About Us</a>
              <a href="/careers">Careers</a>
              <a href="/news">News & Updates</a>
            </div>
            <div class="link-group">
              <h4>Support</h4>
              <a href="/support">Customer Support</a>
              <a href="/docs">Documentation</a>
              <a href="/contact">Contact Us</a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <p>© 2026 MyGreenPlus. All rights reserved.</p>
          <p>Kuala Lumpur, Malaysia | <a href="mailto:info@mygreenplus.com">info@mygreenplus.com</a></p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import IntakeForm from '../components/IntakeForm.vue';
</script>

<style scoped>
.intake-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* Header */
.page-header {
  background: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #10b981;
  margin: 0;
}

.tagline {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.25rem 0 0;
}

.nav-links {
  display: flex;
  gap: 2rem;
  align-items: center;
}

.nav-links a {
  text-decoration: none;
  color: #4b5563;
  font-weight: 500;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: #10b981;
}

.nav-links a.active {
  color: #10b981;
  font-weight: 600;
}

/* Hero Section */
.hero {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 4rem 0;
  text-align: center;
}

.hero h2 {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.hero-description {
  font-size: 1.25rem;
  max-width: 800px;
  margin: 0 auto 3rem;
  opacity: 0.9;
  line-height: 1.6;
}

.hero-stats {
  display: flex;
  justify-content: center;
  gap: 4rem;
  margin-top: 3rem;
}

.stat {
  text-align: center;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 1rem;
  opacity: 0.9;
}

/* Main Content */
.main-content {
  padding: 4rem 0;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 3rem;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.form-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.contact-methods {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
}

.contact-methods h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1.5rem;
  text-align: center;
}

.methods-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.method {
  text-align: center;
  padding: 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.method:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.method-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.method h4 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.method p {
  color: #6b7280;
  margin: 0.25rem 0;
  font-size: 0.875rem;
}

.method-note {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.5rem;
}

/* Info Section */
.info-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.info-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
}

.info-card h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1.5rem;
}

/* Process Steps */
.process-steps {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.step {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.step-number {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  background: #10b981;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
}

.step-content h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.25rem;
}

.step-content p {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
  line-height: 1.5;
}

/* Inquiry Types */
.inquiry-types {
  display: grid;
  gap: 1rem;
}

.inquiry-type {
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: background 0.2s;
}

.inquiry-type:hover {
  background: #f9fafb;
}

.inquiry-type h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.inquiry-type p {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
  line-height: 1.5;
}

/* FAQ */
.faq-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.faq-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.faq-item summary {
  padding: 1rem;
  font-weight: 500;
  color: #1f2937;
  cursor: pointer;
  list-style: none;
  position: relative;
}

.faq-item summary::after {
  content: '+';
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.25rem;
  color: #9ca3af;
}

.faq-item[open] summary::after {
  content: '−';
}

.faq-item p {
  padding: 0 1rem 1rem;
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
  line-height: 1.5;
}

/* Footer */
.page-footer {
  background: #1f2937;
  color: white;
  padding: 3rem 0 2rem;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  margin-bottom: 3rem;
}

.footer-logo h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin: 0 0 0.5rem;
}

.footer-logo p {
  color: #9ca3af;
  margin: 0;
}

.footer-links {
  display: flex;
  gap: 4rem;
}

.link-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.link-group h4 {
  font-size: 1rem;
  font-weight: 600;
  color: white;
  margin: 0 0 0.5rem;
}

.link-group a {
  color: #9ca3af;
  text-decoration: none;
  font-size: 0.875rem;
  transition: color 0.2s;
}

.link-group a:hover {
  color: white;
}

.footer-bottom {
  border-top: 1px solid #374151;
  padding-top: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: #9ca3af;
}

.footer-bottom a {
  color: #9ca3af;
  text-decoration: none;
}

.footer-bottom a:hover {
  color: white;
}

/* Responsive */
@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
  
  .methods-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .footer-content {
    flex-direction: column;
    gap: 2rem;
  }
  
  .footer-links {
    flex-wrap: wrap;
    gap: 2rem;
  }
}

@media (max-width: 768px) {
  .hero h2 {
    font-size: 2rem;
  }
  
  .hero-description {
    font-size: 1rem;
  }
  
  .hero-stats {
    flex-direction: column;
    gap: 2rem;
  }
  
  .methods-grid {
    grid-template-columns: 1fr;
  }
  
  .nav-links {
    display: none;
  }
  
  .footer-bottom {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
}
</style>
