import { ref, onMounted } from "vue";
import { getMachineConfig, syncUser } from "../services/autogcm.js";
import { supabase, getOrCreateUser } from "../services/supabase.js";

const globalRvmList = ref([]); 
const isFirstLoad = ref(true);

export function useHomeLogic() {
  const localUser = JSON.parse(localStorage.getItem("autogcmUser") || "{}");
  
  const user = ref({ 
    name: "User", 
    avatar: "/images/profile.png", 
    totalWeight: localUser.cachedWeight || null,
    balance: localUser.cachedBalance || "0.00", 
    phone: "",
    pendingEarnings: localUser.cachedPending || "0.00"
  });
  
  const sliderImages = ref(["/images/banner1.jpg", "/images/banner2.jpg"]);
  const isLoading = ref(globalRvmList.value.length === 0);

  // ✅ 1. FALLBACK DATA (Exact copy from your DB)
  // Used if Supabase RLS blocks the read request.
  const FALLBACK_MACHINES = [
      {
        device_no: "071582000001",
        name: "RVM Meranti Apartment",
        latitude: "3.0460396612523435",
        longitude: "101.60205470543947",
        address: "Persiaran Subang Mewah, USJ 1, UEP Subang Jaya, Puchong, Selangor"
      },
      {
        device_no: "071582000007",
        name: "UCO Meranti Apartment",
        latitude: "3.0460396612523435",
        longitude: "101.60205470543947",
        address: "Persiaran Subang Mewah, USJ 1, UEP Subang Jaya, Puchong, Selangor"
      },
      {
        device_no: "071582000002",
        name: "RVM Taman Wawasan",
        latitude: "3.0345254531656796",
        longitude: "101.62379690201492",
        address: "Balai Masyarakat MBSJ MPP Zon 16, Persiaran Wawasan, Taman Tasik Wawasan, Puchong"
      },
      {
        device_no: "071582000009",
        name: "UCO Taman Wawasan",
        latitude: "3.0345254531656796",
        longitude: "101.62379690201492",
        address: "Balai Masyarakat MBSJ MPP Zon 16, Persiaran Wawasan, Taman Tasik Wawasan, Puchong"
      }
  ];

  const mapTypeToLabel = (apiName) => {
    if (!apiName) return { label: "General", color: "green" };
    const lower = apiName.toLowerCase();
    if (lower.includes("oil") || lower.includes("minyak")) return { label: "Used Cooking Oil", color: "orange" };
    if (lower.includes("paper") || lower.includes("kertas")) return { label: "Paper", color: "blue" };
    if (lower.includes("plastic") || lower.includes("botol") || lower.includes("can")) return { label: "Plastic / Aluminium", color: "green" };
    return { label: apiName, color: "gray" };
  };

  const getCompStatus = (isMachineOnline, isFull, percent) => {
    if (!isMachineOnline) return { text: "Offline", color: "red" };
    if (isFull) return { text: "Bin Full", color: "red" }; 
    if (percent >= 95) return { text: "Almost Full", color: "orange" };
    return { text: "Available", color: "green" };
  };

  // Helper: Calculate distance
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return "N/A";
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
  };

  const fetchRVMs = async () => {
    if (globalRvmList.value.length === 0) isLoading.value = true;

    // 2. Get User Location (or Default to Puchong)
    let userLat = 3.0454;
    let userLng = 101.6172;
    
    // NEW: Ask if explicitly enabled OR if it's the first visit (null)
    const storedSetting = localStorage.getItem("useLocation");
    const shouldAsk = storedSetting === "true" || storedSetting === null;

    if (shouldAsk) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve, 
            reject, 
            { 
               enableHighAccuracy: true, 
               timeout: 10000, 
               maximumAge: 0 
            }
          );
        });

        // User Allowed: Save "true" so toggle stays ON
        localStorage.setItem("useLocation", "true");
        
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;

      } catch (err) {
        console.warn("Location denied or failed:", err.message);
        
        // User Denied: Save "false" so we don't annoy them next time
        // (Only save false if it was a permission denial, code 1)
        if (err.code === 1) {
            localStorage.setItem("useLocation", "false");
        }
      }
    }

    try {
      // 3. TRY FETCHING FROM DATABASE
      let machineData = [];
      const { data: dbMachines, error } = await supabase
        .from('machines')
        .select('*')
        .eq('is_active', true);

      // 4. CHECK IF BLOCKED BY RLS OR EMPTY
      if (!error && dbMachines && dbMachines.length > 0) {
        machineData = dbMachines;
      } else {
        // RLS blocked us -> Use Fallback
        console.warn("⚠️ Supabase read failed/empty (RLS Blocked). Using Fallback Data.");
        machineData = FALLBACK_MACHINES;
      }

      // 5. PROCESS MACHINES (Fetch Live Status from API)
      const detailedMachines = await Promise.all(machineData.map(async (rvm) => {
        // Normalized fields
        const deviceNo = rvm.device_no || rvm.deviceNo; 
        const lat = rvm.latitude;
        const lng = rvm.longitude;
        
        // A. Fetch Live Status
        const configRes = await getMachineConfig(deviceNo);
        const configs = configRes?.data || [];
        const hasValidConfig = (configRes && configRes.code === 200 && configs.length > 0);

        let isOnline = hasValidConfig; 
        let computedStatus = 0; 
        if (hasValidConfig) {
             const hasFault = configs.some(c => c.status === 2 || c.status === 3);
             if (hasFault) computedStatus = 3; 
        }

        // B. Calculate Distance
        const distance = calculateDistance(userLat, userLng, lat, lng);

        return { 
            ...rvm, 
            device_no: deviceNo,
            configs, 
            isRealOnline: isOnline, 
            computedStatus,
            calculatedDistance: distance,
            finalLat: lat,
            finalLng: lng
        };
      }));

      // 6. MAP TO UI
      const mappedList = detailedMachines.map(rvm => {
        const isOnline = rvm.isRealOnline;
        
        const compartments = rvm.configs.map(conf => {
          const { label, color } = mapTypeToLabel(conf.rubbishTypeName);
          let percent = conf.rate ? Math.round(conf.rate) : 0;
          if (label === "Used Cooking Oil") {
              percent = Math.round((Number(conf.weight || 0) / 400) * 100);
          }
          
          const isBinFull = (percent >= 100 || conf.isFull);
          if (isBinFull) percent = 100;
          
          const statusObj = getCompStatus(isOnline, isBinFull, percent);
          return { label, color, statusText: statusObj.text, statusColor: statusObj.color, percent, isFull: isBinFull };
        });

        if (compartments.length === 0) {
           compartments.push({ label: "Loading...", color: "gray", percent: 0, isFull: false });
        }

        let machineStatusText = "Offline";
        if (isOnline) {
            if (rvm.computedStatus == 3 || rvm.computedStatus == 2) machineStatusText = "Maintenance";
            else if (compartments.length > 0 && compartments.every(c => c.isFull)) machineStatusText = "Bin Full";
            else machineStatusText = "Online";
        }

        return {
          deviceNo: rvm.device_no,
          status: machineStatusText,
          distance: rvm.calculatedDistance,
          address: rvm.address || rvm.location_name || rvm.name,
          latitude: rvm.finalLat, 
          longitude: rvm.finalLng,
          compartments: compartments.sort((a, b) => a.label.localeCompare(b.label))
        };
      });

      // Sort by Distance
      mappedList.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

      globalRvmList.value = mappedList;
      isFirstLoad.value = false;
      localStorage.setItem("cachedRVMList", JSON.stringify(mappedList));

    } catch (e) {
      console.error("RVM Load Failed", e);
    } finally {
      isLoading.value = false;
    }
  };

  const updateCache = () => {
      const cache = JSON.parse(localStorage.getItem("autogcmUser") || "{}");
      cache.cachedWeight = user.value.totalWeight;
      cache.cachedBalance = user.value.balance;
      cache.cachedPending = user.value.pendingEarnings;
      localStorage.setItem("autogcmUser", JSON.stringify(cache));
  };

  onMounted(async () => {
    // 1. READ LOCAL STORAGE
    const localUser = JSON.parse(localStorage.getItem("autogcmUser") || "{}");
    let displayName = localUser.nikeName || localUser.nickname || localUser.name || "User";
    
    user.value.name = displayName;
    user.value.avatar = localUser.avatarUrl || localUser.avatar || "/images/profile.png";
    user.value.phone = localUser.phone || localUser.phonenumber || localUser.phoneNumber || "";

    const isGenericName = (n) => !n || n === "User" || n === "New User";

    // 2. FETCH DB DATA
    if (user.value.phone) {
        try {
            if (isGenericName(displayName)) {
               try {
                  const { data: existingUser } = await supabase
                      .from('users')
                      .select('nickname, avatar_url')
                      .eq('phone', user.value.phone)
                      .single();

                  if (existingUser && !isGenericName(existingUser.nickname)) {
                       displayName = existingUser.nickname;
                       if (existingUser.avatar_url) user.value.avatar = existingUser.avatar_url;
                  } 
                  else {
                       const apiRes = await syncUser(user.value.phone); 
                       const remoteName = apiRes?.data?.nikeName;
                       if (remoteName && !isGenericName(remoteName)) {
                           displayName = remoteName;
                       }
                  }
               } catch (e) {
                  console.warn("Profile check failed:", e);
               }
            }

            const dbUser = await getOrCreateUser(user.value.phone, displayName, user.value.avatar);
            
            if (dbUser) {
                user.value.name = dbUser.nickname || displayName;
                user.value.avatar = dbUser.avatar_url || user.value.avatar;
                user.value.totalWeight = Number(dbUser.total_weight || 0).toFixed(2);
                
                const { data: financials } = await supabase.rpc('get_user_financial_data', { 
                    p_user_id: dbUser.id 
                });

                if (financials) {
                    // 1. Calculate Spent (Exclude Rejected withdrawals if they exist)
                    const spent = (financials.withdrawals || [])
                        .filter(w => w.status !== 'REJECTED' && w.status !== 'EXTERNAL_SYNC') 
                        .reduce((sum, w) => sum + Number(w.amount), 0);
                    
                    // 2. Calculate Pending
                    const pending = (financials.submissions || [])
                        .filter(s => s.status === 'PENDING')
                        .reduce((sum, s) => sum + Number(s.machine_given_points), 0);

                    const calculatedLifetime = (financials.submissions || [])
                        .reduce((sum, s) => sum + Number(s.calculated_value || 0), 0);
                    
                    user.value.balance = (calculatedLifetime - spent).toFixed(2);
                    user.value.pendingEarnings = pending.toFixed(2);
                    
                    updateCache();
                }
                updateCache();
            }
        } catch (err) {
            console.error("User Load Error:", err);
            if (user.value.totalWeight === null) user.value.totalWeight = "0.00";
        }
    } else {
        console.warn("⚠️ No phone found");
        user.value.totalWeight = "0.00";
    }

    await fetchRVMs();
  });

  return { user, rvmList: globalRvmList, sliderImages, isLoading };
}