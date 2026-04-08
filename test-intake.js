#!/usr/bin/env node

/**
 * Test script for intake system
 * 
 * Usage:
 * node test-intake.js           # Run all tests
 * node test-intake.js website   # Test website intake
 * node test-intake.js whatsapp  # Test WhatsApp intake
 */

const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:5173';
const API_PATH = '/api/intake';

async function testWebsiteIntake() {
  console.log('🧪 Testing website intake...');
  
  const payload = {
    name: 'Test Customer',
    email: 'test@example.com',
    phone: '+60123456789',
    company: 'Test Company',
    subject: 'Test Quotation Request',
    message: 'I need a quotation for 3 food waste machines for my restaurant chain in KL.',
    channel: 'website',
    source: 'test_script',
    campaign: 'test_campaign',
    referral: 'test_referral',
  };

  try {
    const result = await makeRequest(`${API_PATH}`, payload);
    console.log('✅ Website intake test:', result.message);
    if (result.ticketNumber) {
      console.log('   Ticket number:', result.ticketNumber);
    }
    if (result.leadNumber) {
      console.log('   Lead number:', result.leadNumber);
    }
    return result.success;
  } catch (error) {
    console.error('❌ Website intake test failed:', error.message);
    return false;
  }
}

async function testWhatsAppIntake() {
  console.log('🧪 Testing WhatsApp intake...');
  
  const payload = {
    name: 'WhatsApp User',
    phone: '+60129876543',
    message: 'Hi, my RVM machine is not dispensing points. Can you help?',
    channel: 'whatsapp',
    source: 'whatsapp',
  };

  try {
    const result = await makeRequest(`${API_PATH}/whatsapp`, payload);
    console.log('✅ WhatsApp intake test:', result.message);
    if (result.ticketNumber) {
      console.log('   Ticket number:', result.ticketNumber);
    }
    return result.success;
  } catch (error) {
    console.error('❌ WhatsApp intake test failed:', error.message);
    return false;
  }
}

async function testGenericIntake() {
  console.log('🧪 Testing generic intake (form data)...');
  
  const formData = new URLSearchParams();
  formData.append('name', 'Form User');
  formData.append('email', 'form@example.com');
  formData.append('subject', 'Form Submission Test');
  formData.append('message', 'This is a test from a form submission.');
  formData.append('channel', 'website');
  formData.append('source', 'contact_form');

  try {
    const result = await makeRequest(`${API_PATH}`, formData.toString(), {
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    console.log('✅ Generic intake test:', result.message);
    return result.success;
  } catch (error) {
    console.error('❌ Generic intake test failed:', error.message);
    return false;
  }
}

async function testAPIEndpoint() {
  console.log('🧪 Testing API test endpoint...');
  
  try {
    const result = await makeRequest(`${API_PATH}/test`, null, {}, 'GET');
    console.log('✅ API test endpoint:', result.message);
    console.log('   Available channels:', result.channels?.join(', '));
    
    if (result.results) {
      console.log('   Test results:');
      result.results.forEach((test, index) => {
        console.log(`   ${index + 1}. ${test.result.success ? '✅' : '❌'} ${test.result.message}`);
      });
    }
    
    return result.success;
  } catch (error) {
    console.error('❌ API test endpoint failed:', error.message);
    return false;
  }
}

function makeRequest(path, data, headers = {}, method = 'POST') {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 5173,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${parsed.error || responseData}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data && method !== 'GET') {
      if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
    }
    
    req.end();
  });
}

async function runAllTests() {
  console.log('🚀 Starting intake system tests...\n');
  
  const results = {
    website: await testWebsiteIntake(),
    whatsapp: await testWhatsAppIntake(),
    generic: await testGenericIntake(),
    api: await testAPIEndpoint(),
  };
  
  console.log('\n📊 Test Summary:');
  console.log('================');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(Boolean);
  console.log(`\n${allPassed ? '🎉 All tests passed!' : '⚠️ Some tests failed.'}`);
  
  return allPassed;
}

// Main execution
const testType = process.argv[2];

if (testType === 'website') {
  testWebsiteIntake();
} else if (testType === 'whatsapp') {
  testWhatsAppIntake();
} else if (testType === 'generic') {
  testGenericIntake();
} else if (testType === 'api') {
  testAPIEndpoint();
} else {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}