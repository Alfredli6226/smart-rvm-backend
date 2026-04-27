/**
 * Verify Deployment Success
 * 
 * This script tests that the deployed platform is working correctly
 */

const https = require('https');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const BASE_URL = 'https://rvm-merchant-platform-main.vercel.app';
const ENDPOINTS = [
  '/',
  '/api/health',
  '/ai-verification-dashboard-complete.html',
  '/simple-devices.html',
  '/user_analytics.html',
  '/simple-dashboard.html'
];

console.log('🔍 VERIFYING DEPLOYMENT SUCCESS');
console.log('=' .repeat(60));
console.log(`Base URL: ${BASE_URL}`);
console.log('');

async function testEndpoint(url) {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      const status = res.statusCode;
      const isSuccess = status >= 200 && status < 400;
      
      resolve({
        url,
        status,
        success: isSuccess,
        message: isSuccess ? '✅ OK' : `❌ Failed (${status})`
      });
    });
    
    req.on('error', (error) => {
      resolve({
        url,
        status: 0,
        success: false,
        message: `❌ Error: ${error.message}`
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        url,
        status: 0,
        success: false,
        message: '❌ Timeout'
      });
    });
  });
}

async function runTests() {
  console.log('📡 TESTING ENDPOINTS:');
  console.log('-' .repeat(40));
  
  const results = [];
  
  for (const endpoint of ENDPOINTS) {
    const fullUrl = `${BASE_URL}${endpoint}`;
    const result = await testEndpoint(fullUrl);
    results.push(result);
    
    console.log(`${result.message.padEnd(20)} ${endpoint}`);
  }
  
  console.log('');
  console.log('📊 TEST RESULTS SUMMARY:');
  console.log('-' .repeat(40));
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  const successRate = (successful / total) * 100;
  
  console.log(`Successful: ${successful}/${total} (${successRate.toFixed(1)}%)`);
  
  if (successful === total) {
    console.log('🎉 ALL TESTS PASSED! Deployment successful.');
  } else {
    console.log('⚠️ Some tests failed. Check the failed endpoints:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   ${r.url} - ${r.message}`);
    });
  }
  
  console.log('');
  console.log('🚀 DEPLOYED FEATURES:');
  console.log('-' .repeat(40));
  console.log('1. 🤖 AI Image Verification System');
  console.log('   - Fraud detection & user trust scoring');
  console.log('   - Dashboard: /ai-verification-dashboard-complete.html');
  console.log('   - API: /api/image-verification');
  console.log('');
  console.log('2. ⚙️ Machine Capacity Management');
  console.log('   - Dynamic capacities (500-1000kg per machine)');
  console.log('   - Smart alerts (70%/85%/95% thresholds)');
  console.log('   - API: /api/notifications');
  console.log('');
  console.log('3. 📊 Enhanced Dashboards');
  console.log('   - Real device monitoring');
  console.log('   - User analytics');
  console.log('   - Business intelligence');
  console.log('');
  console.log('4. 🔧 Consolidated APIs (7 essential APIs)');
  console.log('   - Health: /api/health');
  console.log('   - Users: /api/users');
  console.log('   - Notifications: /api/notifications');
  console.log('   - Image Verification: /api/image-verification');
  console.log('   - Data Sync: /api/data-sync');
  console.log('   - Reports: /api/reports');
  console.log('   - User Analytics: /api/user-analytics');
  console.log('');
  console.log('🌐 ACCESS LINKS:');
  console.log('-' .repeat(40));
  console.log(`Main Platform: ${BASE_URL}/`);
  console.log(`AI Dashboard: ${BASE_URL}/ai-verification-dashboard-complete.html`);
  console.log(`Device Dashboard: ${BASE_URL}/simple-devices.html`);
  console.log(`User Analytics: ${BASE_URL}/user_analytics.html`);
  console.log(`Simple Dashboard: ${BASE_URL}/simple-dashboard.html`);
  console.log('');
  console.log('🎯 NEXT STEPS:');
  console.log('1. Test mobile app integration');
  console.log('2. Integrate real AI services (Google Vision/Clarifai)');
  console.log('3. Set up monitoring and alerts');
  console.log('4. Prepare for ASEAN expansion');
  console.log('');
  console.log('✅ DEPLOYMENT VERIFICATION COMPLETE');
}

// Run tests
runTests().catch(console.error);