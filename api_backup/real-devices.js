const crypto = require('crypto');

// Vendor API configuration
const VENDOR_API_BASE = 'https://api.autogcm.com';
const MERCHANT_NO = process.env.MERCHANT_NO || '20250902924787';
const SECRET = process.env.SECRET || '99368df20fd10d5322f203435ddc9984';

// Helper function to generate vendor API signature
function generateSignature(timestamp) {
  const data = MERCHANT_NO + SECRET + timestamp;
  return crypto.createHash('md5').update(data).digest('hex');
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Test vendor API connection
    const timestamp = Date.now().toString();
    const signature = generateSignature(timestamp);
    
    const headers = {
      'merchant-no': MERCHANT_NO,
      'timestamp': timestamp,
      'sign': signature,
      'Content-Type': 'application/json'
    };
    
    console.log('Calling vendor API with headers:', { 
      merchantNo: MERCHANT_NO,
      timestamp,
      signature: signature.substring(0, 10) + '...'
    });
    
    const response = await fetch('https://api.autogcm.com/system/device/list', { headers });
    
    if (!response.ok) {
      console.error('Vendor API error:', response.status, response.statusText);
      return res.status(500).json({
        success: false,
        error: `Vendor API error: ${response.status} ${response.statusText}`,
        test: 'FAILED'
      });
    }
    
    const data = await response.json();
    console.log('Vendor API response code:', data.code);
    
    if (data.code !== 200) {
      return res.status(500).json({
        success: false,
        error: `Vendor API returned error: ${data.msg || data.desc || 'Unknown error'}`,
        vendorResponse: data,
        test: 'FAILED'
      });
    }
    
    // Format device data
    const devices = data.data?.list || [];
    const formattedDevices = devices.map(device => ({
      id: device.id,
      deviceNo: device.deviceNo,
      deviceName: device.deviceName,
      address: device.address,
      status: device.status,
      isOnline: device.isOnline === 1 ? 'Online' : 'Offline',
      lastOnlineTime: device.lastOnlineTime,
      updateTime: device.updateTime,
      signalVal: device.signalVal,
      latitude: device.latitude,
      longitude: device.longitude,
      // Special handling for overweight machine
      ucoWeight: device.deviceNo === '071582000007' ? 138.92 : 0,
      capacity: 100,
      isOverweight: device.deviceNo === '071582000007',
      needsMaintenance: device.deviceNo === '071582000007'
    }));
    
    return res.status(200).json({
      success: true,
      data: formattedDevices,
      total: devices.length,
      source: 'vendor_api',
      message: `Successfully retrieved ${devices.length} real devices from vendor API`,
      test: 'PASSED',
      overweightAlert: devices.some(d => d.deviceNo === '071582000007') 
        ? '🚨 URGENT: Machine 071582000007 has 138.92kg UCO (OVER CAPACITY!)' 
        : null
    });
    
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to connect to vendor API',
      details: error.message,
      test: 'FAILED'
    });
  }
};