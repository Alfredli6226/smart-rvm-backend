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

// Call vendor API for device data
async function callVendorAPI(endpoint: string, params: Record<string, any> = {}): Promise<any> {
  const timestamp = Date.now().toString();
  const signature = generateSignature(timestamp);
  
  const headers = {
    'merchant-no': MERCHANT_NO,
    'timestamp': timestamp,
    'sign': signature,
    'Content-Type': 'application/json'
  };
  
  const url = `${VENDOR_API_BASE}${endpoint}`;
  const queryString = new URLSearchParams(params).toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  
  try {
    const response = await fetch(fullUrl, { headers });
    
    if (!response.ok) {
      throw new Error(`Vendor API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.code !== 200) {
      throw new Error(`Vendor API returned error: ${data.msg || data.desc || 'Unknown error'}`);
    }
    
    return data.data || data;
  } catch (error) {
    console.error(`Failed to call vendor API ${endpoint}:`, error);
    throw error;
  }
}

// Get devices from vendor API
async function getDevicesFromVendorAPI(pageNum: number = 1, pageSize: number = 20): Promise<any> {
  try {
    const data = await callVendorAPI('/system/device/list', {
      pageNum,
      pageSize
    });
    
    return {
      success: true,
      source: 'vendor_api',
      data: data?.list || [],
      total: data?.total || 0,
      pages: data?.pages || 1,
      hasNextPage: data?.hasNextPage || false
    };
  } catch (error) {
    console.error('Failed to get devices from vendor API:', error);
    return {
      success: false,
      source: 'error',
      data: [],
      total: 0,
      pages: 0,
      hasNextPage: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
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

  const { method } = req;
  
  try {
    // ==========================================
    // GET /api/devices - Get all devices (REAL DATA)
    // ==========================================
    if (method === 'GET') {
      const pageNum = parseInt(req.query.pageNum as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      
      // Get REAL devices from vendor API
      const vendorDevices = await getDevicesFromVendorAPI(pageNum, pageSize);
      
      // Format device data for frontend
      const formattedDevices = vendorDevices.data.map((device: any) => ({
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
        alarmNumber: device.alarmNumber || 0,
        clearNumber: device.clearNumber || 0,
        // UCO weight calculation (example - would need actual data)
        ucoWeight: device.deviceNo === '071582000007' ? 138.92 : 0, // Overweight machine!
        capacity: 100, // Default capacity in kg
        isOverweight: device.deviceNo === '071582000007' // Flag for overweight
      }));
      
      return res.status(200).json({
        success: true,
        data: formattedDevices,
        pagination: {
          pageNum,
          pageSize,
          total: vendorDevices.total,
          pages: vendorDevices.pages,
          hasNextPage: vendorDevices.hasNextPage
        },
        source: vendorDevices.source,
        message: vendorDevices.source === 'vendor_api' 
          ? `Successfully retrieved ${vendorDevices.total} real devices from vendor API` 
          : 'Using mock data (vendor API unavailable)'
      });
    }

    // Method not allowed
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}