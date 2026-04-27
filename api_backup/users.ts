import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Vendor API configuration
const VENDOR_API_BASE = 'https://api.autogcm.com';
const MERCHANT_NO = process.env.MERCHANT_NO || '20250902924787';
const SECRET = process.env.SECRET || '99368df20fd10d5322f203435ddc9984';

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Mock data for demonstration (when vendor API has no data)
const MOCK_USERS = [
  { id: '1173008', nickName: 'Sindylee', phone: 'N/A', total_weight: 125.6, total_points: 1256, status: '0', createTime: '2026-03-10 14:30:00' },
  { id: '1404752', nickName: 'EcoWarrior', phone: 'N/A', total_weight: 98.3, total_points: 983, status: '0', createTime: '2026-03-11 09:15:00' },
  { id: '1378848', nickName: 'GreenHero', phone: 'N/A', total_weight: 87.2, total_points: 872, status: '0', createTime: '2026-03-12 11:45:00' },
  { id: '1378850', nickName: 'RecycleKing', phone: 'N/A', total_weight: 76.5, total_points: 765, status: '0', createTime: '2026-03-13 16:20:00' },
  { id: '1380001', nickName: 'EarthSaver', phone: 'N/A', total_weight: 65.8, total_points: 658, status: '0', createTime: '2026-03-14 08:30:00' },
  { id: '1380002', nickName: 'PlasticFree', phone: 'N/A', total_weight: 54.3, total_points: 543, status: '0', createTime: '2026-03-15 13:10:00' },
  { id: '1380003', nickName: 'GreenMachine', phone: 'N/A', total_weight: 43.7, total_points: 437, status: '0', createTime: '2026-03-16 10:25:00' },
  { id: '1380004', nickName: 'EcoFriendly', phone: 'N/A', total_weight: 32.9, total_points: 329, status: '0', createTime: '2026-03-17 15:40:00' },
  { id: '1380005', nickName: 'WasteWarrior', phone: 'N/A', total_weight: 21.5, total_points: 215, status: '0', createTime: '2026-03-18 12:05:00' },
  { id: '1380006', nickName: 'RecyclePro', phone: 'N/A', total_weight: 15.2, total_points: 152, status: '0', createTime: '2026-03-19 17:30:00' }
];

// Helper function to generate vendor API signature
function generateSignature(timestamp: string): string {
  const data = MERCHANT_NO + SECRET + timestamp;
  return crypto.createHash('md5').update(data).digest('hex');
}

// Call vendor API for user data
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
      throw new Error(`Vendor API returned error: ${data.msg || 'Unknown error'}`);
    }
    
    return data.data || data;
  } catch (error) {
    console.error(`Failed to call vendor API ${endpoint}:`, error);
    throw error;
  }
}

// Get users from vendor API
async function getUsersFromVendorAPI(pageNum: number = 1, pageSize: number = 20): Promise<any> {
  try {
    const data = await callVendorAPI('/system/user/list', {
      pageNum,
      pageSize
    });
    
    return {
      success: true,
      source: 'vendor_api',
      data: data?.rows || [],
      total: data?.total || 0,
      pages: data?.pages || 1,
      hasNextPage: data?.hasNextPage || false
    };
  } catch (error) {
    console.error('Failed to get users from vendor API, using mock data:', error);
    return {
      success: true,
      source: 'mock_data',
      data: MOCK_USERS,
      total: MOCK_USERS.length,
      pages: 1,
      hasNextPage: false
    };
  }
}

// Get specific user from vendor API
async function getUserFromVendorAPI(userId: string): Promise<any> {
  try {
    const data = await callVendorAPI(`/system/user/${userId}`);
    
    return {
      success: true,
      source: 'vendor_api',
      data: data || null
    };
  } catch (error) {
    console.error(`Failed to get user ${userId} from vendor API:`, error);
    
    // Find in mock data
    const mockUser = MOCK_USERS.find(user => user.id === userId);
    return {
      success: true,
      source: 'mock_data',
      data: mockUser || null
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

  // Check if Supabase is configured
  let supabase = null;
  if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }

  const { method, url, body } = req;
  
  const pathWithoutQuery = (url || '').split('?')[0];
  const pathParts = pathWithoutQuery.replace('/api/users', '').split('/').filter(Boolean);
  const pathId = pathParts[0] || null;
  const pathAction = pathParts[1] || null;

  try {
    // ==========================================
    // GET /api/users - Get all users (combined backend)
    // ==========================================
    if (method === 'GET' && !pathId) {
      const filterType = req.query.filter_type as string || 'all';
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const pageNum = Math.floor(offset / limit) + 1;
      const pageSize = limit;

      // Get users from vendor API (our combined backend)
      const vendorUsers = await getUsersFromVendorAPI(pageNum, pageSize);
      
      // Also get from Supabase if available
      let supabaseUsers = { data: [], count: 0 };
      if (supabase) {
        try {
          const { data, count, error } = await supabase
            .from('users')
            .select('*', { count: 'exact' })
            .range(offset, offset + limit - 1);
          
          if (!error) {
            supabaseUsers = { data: data || [], count: count || 0 };
          }
        } catch (error) {
          console.error('Supabase error:', error);
        }
      }

      // Combine results
      const combinedUsers = [...vendorUsers.data];
      const totalUsers = vendorUsers.total + supabaseUsers.count;

      // Return in format frontend expects
      return res.status(200).json({
        success: true,
        data: combinedUsers,  // Direct array, not nested in 'rows'
        pagination: {
          filter_type: filterType || 'all',
          limit: limit,
          offset: offset,
          total: totalUsers
        },
        message: `Users retrieved from ${vendorUsers.source}`
      });
    }

    // ==========================================
    // GET /api/users/{userId} - Get specific user
    // ==========================================
    if (method === 'GET' && pathId && !pathAction) {
      const userId = pathId;

      // Try vendor API first
      const vendorUser = await getUserFromVendorAPI(userId);
      
      // Also check Supabase if available
      let supabaseUser = null;
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
          
          if (!error && data) {
            supabaseUser = data;
          }
        } catch (error) {
          console.error('Supabase error:', error);
        }
      }

      const userData = vendorUser.data || supabaseUser;
      
      if (!userData) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: userData,
        sources: {
          vendor_api: vendorUser.source === 'vendor_api',
          supabase: !!supabaseUser
        }
      });
    }

    // ==========================================
    // GET /api/users/filter - Filter users
    // ==========================================
    if (method === 'GET' && pathId === 'filter') {
      const filterType = req.query.filter_type as string || 'all';
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      // Get all users from vendor API
      const vendorUsers = await getUsersFromVendorAPI(1, 100); // Get first 100 for filtering
      
      let filteredUsers = vendorUsers.data;

      // Apply filters
      switch (filterType) {
        case 'top_recyclers':
          filteredUsers = filteredUsers
            .filter((user: any) => user.total_weight > 0)
            .sort((a: any, b: any) => b.total_weight - a.total_weight);
          break;
        case 'new_registers':
          filteredUsers = filteredUsers
            .sort((a: any, b: any) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
          break;
        case 'active':
          filteredUsers = filteredUsers
            .filter((user: any) => user.status === '0');
          break;
        // 'all' - no filter needed
      }

      // Apply pagination
      const paginatedUsers = filteredUsers.slice(offset, offset + limit);

      // Return in format frontend expects
      return res.status(200).json({
        success: true,
        data: paginatedUsers,  // Direct array, not nested in 'rows'
        pagination: {
          filter_type: filterType,
          limit: limit,
          offset: offset,
          total: filteredUsers.length
        },
        source: vendorUsers.source
      });
    }

    // ==========================================
    // GET /api/users/stats - User statistics
    // ==========================================
    if (method === 'GET' && pathId === 'stats') {
      const vendorUsers = await getUsersFromVendorAPI(1, 100);
      
      const stats = {
        total_users: vendorUsers.total,
        active_users: vendorUsers.data.filter((user: any) => user.status === '0').length,
        total_weight: vendorUsers.data.reduce((sum: number, user: any) => sum + (user.total_weight || 0), 0),
        total_points: vendorUsers.data.reduce((sum: number, user: any) => sum + (user.total_points || 0), 0),
        average_weight: vendorUsers.data.length > 0 
          ? vendorUsers.data.reduce((sum: number, user: any) => sum + (user.total_weight || 0), 0) / vendorUsers.data.length 
          : 0,
        average_points: vendorUsers.data.length > 0 
          ? vendorUsers.data.reduce((sum: number, user: any) => sum + (user.total_points || 0), 0) / vendorUsers.data.length 
          : 0,
        top_users: vendorUsers.data
          .filter((user: any) => user.total_weight > 0)
          .sort((a: any, b: any) => b.total_weight - a.total_weight)
          .slice(0, 5)
          .map((user: any) => ({
            id: user.id,
            name: user.nickName,
            weight: user.total_weight,
            points: user.total_points
          }))
      };

      return res.status(200).json({
        success: true,
        data: stats,
        source: vendorUsers.source,
        last_updated: new Date().toISOString()
      });
    }

    // ==========================================
    // Default - Method not allowed
    // ==========================================
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });

  } catch (error) {
    console.error('Users API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}