import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// Vendor API configuration
const VENDOR_API_BASE = 'https://api.autogcm.com';
const MERCHANT_NO = process.env.MERCHANT_NO || '20250902924787';
const SECRET = process.env.SECRET || '99368df20fd10d5322f203435ddc9984';

// Helper function to generate vendor API signature
function generateSignature(timestamp: string): string {
  const data = MERCHANT_NO + SECRET + timestamp;
  return crypto.createHash('md5').update(data).digest('hex');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    
    const response = await fetch('https://api.autogcm.com/system/device/list', { headers });
    
    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: `Vendor API error: ${response.status} ${response.statusText}`,
        headers: Object.fromEntries(response.headers.entries())
      });
    }
    
    const data = await response.json();
    
    return res.status(200).json({
      success: true,
      vendorApiResponse: data,
      connectionTest: 'SUCCESS',
      devicesCount: data.data?.list?.length || 0,
      message: `Successfully connected to vendor API. Found ${data.data?.list?.length || 0} devices.`
    });
    
  } catch (error) {
    console.error('Test error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to connect to vendor API',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}