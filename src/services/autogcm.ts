import axios from "axios";
import type { ApiNearbyMachine, Machine } from "../types";

// 1. Define Proxy URL
// If Localhost: Use Live Vercel Backend to avoid CORS issues
// If Production: Use relative path '/api/proxy'
const PROXY_URL = '/api/proxy';

// FIXED: Changed return type from Promise<any> to Promise<T>
async function callApi<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', data: any = {}): Promise<T> {
  try {
    const payload = {
      endpoint,
      method,
      [method === 'GET' ? 'params' : 'body']: data
    };
    
    const res = await axios.post(PROXY_URL, payload);
    return res.data as T; // Explicitly cast the result to T
  } catch (error: any) {
    console.error(`❌ API Error [${endpoint}]:`, error.message);
    throw error;
  }
}

// ✅ 3. Get Nearby RVMs
// Used to find machines near a coordinate (GPS-based)
export async function getNearbyRVMs(latitude: number = 3.14, longitude: number = 101.68): Promise<ApiNearbyMachine[]> {
  try {
    const res = await callApi<any>('/api/open/video/v2/nearby', 'GET', { latitude, longitude });
    
    if (res && res.code === 200 && Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch machine list", error);
    return [];
  }
}

export async function getMachineStatusSnapshot(latitude: number = 3.14, longitude: number = 101.68): Promise<Record<string, ApiNearbyMachine>> {
  const machines = await getNearbyRVMs(latitude, longitude);
  return machines.reduce<Record<string, ApiNearbyMachine>>((acc, machine) => {
    const deviceNo = String(machine.deviceNo || '').trim();
    if (deviceNo) acc[deviceNo] = machine;
    return acc;
  }, {});
}

// 4. Sync User / Get User Info
// Improved to handle both "Fetching" (just phone) and "Updating" (phone + data)
export async function syncUserAccount(
  phone: string, 
  details?: { nikeName?: string; avatarUrl?: string }
): Promise<any> {
  try {
    // 1. Construct the base payload (always required)
    const payload: any = { phone };

    // 2. Only add optional fields if they exist. 
    // This prevents overwriting existing data with empty strings.
    if (details?.nikeName) {
      payload.nikeName = details.nikeName; // Note: API uses typo 'nikeName'
    }
    
    if (details?.avatarUrl) {
      payload.avatarUrl = details.avatarUrl;
    }

    const res = await callApi<any>('/api/open/v1/user/account/sync', 'POST', payload);
    
    // We return res.data directly so components can access .integral immediately
    if (res && res.code === 200 && res.data) {
      return res.data; 
    }
    
    throw new Error(res.msg || "Invalid response from API");
  } catch (error) {
    console.error("Failed to sync user account", error);
    throw error;
  }
}

// 5. Get Individual Machine Status
// Used by the Store to check bin config/weights
export async function getMachineConfig(deviceNo: string): Promise<any> {
  try {
    const res = await callApi<any>('/api/open/v1/device/position', 'GET', { deviceNo });
    return res;
  } catch (error) {
    console.error(`Failed to fetch config for ${deviceNo}`, error);
    return null;
  }
}

export function normalizeMachineStatus(snapshot?: ApiNearbyMachine | null) {
  if (!snapshot) {
    return {
      isOnline: false,
      vendorStatus: null as number | null,
      vendorStatusText: 'Offline'
    };
  }

  const online = Number(snapshot.isOnline) === 1;
  const status = Number(snapshot.status);
  const statusMap: Record<number, string> = {
    0: 'Waiting',
    1: 'In Use',
    2: 'Disabled',
    3: 'Fault',
    4: 'Unpaid'
  };

  return {
    isOnline: online,
    vendorStatus: Number.isFinite(status) ? status : null,
    vendorStatusText: statusMap[status] || (online ? 'Online' : 'Offline')
  };
}

// ✅ 6. Get User Disposal Records
// Used in User Details to show Recycling History
export async function getUserRecords(phone: string, pageNum = 1, pageSize = 20): Promise<any[]> {
  try {
    const res = await callApi<any>('/api/open/v1/put', 'GET', { 
        phone, 
        pageNum, 
        pageSize 
    });
    
    // The API wraps the list inside data.list
    if (res && res.code === 200 && res.data && Array.isArray(res.data.list)) {
      return res.data.list;
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch user recycling records", error);
    return [];
  }
}