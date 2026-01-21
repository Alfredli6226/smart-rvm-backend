import axios from "axios";

// 🟢 VITE PROXY: Points to relative path so vite.config.js handles the forwarding
const PROXY_URL = '/api/proxy';

// Generic Wrapper
async function callApi(endpoint, method = 'GET', data = {}) {
  try {
    const payload = {
      endpoint,
      method,
      [method === 'GET' ? 'params' : 'body']: data
    };
    
    const res = await axios.post(PROXY_URL, payload);
    return res.data; 
  } catch (error) {
    console.error(`❌ API Error [${endpoint}]:`, error.message);
    throw error;
  }
} 

// 1. Register / Sync User (FIXED to be Non-Destructive)
export async function syncUser(phone, nickname = undefined, avatarUrl = undefined) {
  console.log(`📡 Syncing User: "${phone}"`);

  // 1. Start with base payload
  const payload = { phone };

  // 2. UPDATED LOGIC (REPLACE THIS BLOCK):
  // If nickname is real, send it (Update Mode).
  // If nickname is missing/generic, send "" (Fetch Mode) to satisfy API requirements.
  if (nickname && nickname.trim() !== "" && nickname !== "New User" && nickname !== "User") {
      payload.nikeName = nickname; 
  } else {
      payload.nikeName = ""; // <--- CRITICAL FIX: Send empty string instead of undefined
  }

  // 3. ONLY add avatar if it exists
  if (avatarUrl && avatarUrl.trim() !== "") {
      payload.avatarUrl = avatarUrl;
  }

  // 4. Send Request
  return await callApi('/api/open/v1/user/account/sync', 'POST', payload);
}

// Alias for registration flow - keeps compatibility with your other files
export async function registerUserWithAutoGCM(token, phone, nickname = undefined, avatarUrl = undefined) {
  // Token is unused by machine API, we just pass the rest
  return await syncUser(phone, nickname, avatarUrl);
}

// ✅ 2. Get User Records
export async function getUserRecords(phone, pageNum = 1, pageSize = 10) {
  return await callApi('/api/open/v1/put', 'GET', {
    phone: phone,
    pageNum,
    pageSize
  });
}

// ✅ 3. Get Nearby RVMs
export async function getNearbyRVMs(latitude, longitude) {
  return await callApi('/api/open/video/v2/nearby', 'GET', {
    latitude,
    longitude
  });
}

// ✅ 4. Get Machine Config
export async function getMachineConfig(deviceNo) {
  return await callApi('/api/open/v1/device/position', 'GET', {
    deviceNo
  });
}

// ✅ 5. Open Rubbish Port
export async function openRubbishPort(deviceNo, phone, positionNo) {
  return await callApi('/api/open/v1/open', 'POST', {
    deviceNo,
    phone: phone,
    positionNo: parseInt(positionNo)
  });
}

// ✅ 6. Bind Card
export async function bindCard(deviceNo, phone) {
  return await callApi('/api/open/v1/code/auth/bindCard', 'GET', {
    deviceNo,
    phone: phone
  });
} 

// ✅ 7. Update User Profile
export async function updateUserProfile(phone, newNickname, newAvatarUrl) {
  if (!phone) throw new Error("Phone number is required for update");
  // We can reuse syncUser here since it handles the logic perfectly
  return await syncUser(phone, newNickname, newAvatarUrl);
}

// ✅ 8. Get Public Machine Records
export async function getMachinePublicRecords(deviceNo, pageNum = 1, pageSize = 20) {
  return await callApi('/api/open/v1/put', 'GET', {
    deviceNo: deviceNo,
    pageNum,
    pageSize
  });
}

// 9. Get User Stats
export async function getUserStats(phone) {
  try {
    const res = await getUserRecords(phone, 1, 100);
    if (res.code === 200 && res.data && res.data.list) {
      const records = res.data.list;
      const totalWeight = records.reduce((sum, item) => sum + (item.weight || 0), 0);
      const totalPoints = records.reduce((sum, item) => sum + (item.integral || 0), 0);
      const totalItems = records.length;
      return {
        totalWeight: totalWeight.toFixed(2),
        totalPoints: totalPoints.toFixed(2),
        totalItems,
        recentHistory: records.slice(0, 5)
      };
    }
    return { totalWeight: 0, totalPoints: 0, totalItems: 0, recentHistory: [] };
  } catch (err) {
    console.error("Failed to calculate stats:", err);
    return null;
  }
}

// NEW: Onboarding / Migration Helper
export async function runOnboarding(phone) {
  try {
    // Ensure this URL matches your Backend deployment
    const BACKEND_URL = "https://rvm-merchant-platform.vercel.app/api/onboard"; 
    
    console.log("🔄 Triggering User Migration...");
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    
    const result = await response.json();
    console.log("✅ Migration Result:", result);
    return result;
  } catch (error) {
    console.error("⚠️ Migration trigger failed:", error);
    return null;
  }
}