import { ref, onMounted } from "vue";
import { getNearbyRVMs, getMachineConfig } from "../services/autogcm.js";
import { supabase, getOrCreateUser } from "../services/supabase.js";

// Keep global state to share across components if needed
const globalRvmList = ref([]); 
const isFirstLoad = ref(true);

export function useHomeLogic() {
  // 1. Initialize State with Cache immediately
  const localUser = JSON.parse(localStorage.getItem("autogcmUser") || "{}");
  const cachedRVMs = JSON.parse(localStorage.getItem("cachedRVMList") || "[]");

  // Populate global list from cache if empty
  if (globalRvmList.value.length === 0 && cachedRVMs.length > 0) {
    globalRvmList.value = cachedRVMs;
    isFirstLoad.value = false; // We have data, so we aren't "loading" visually
  }

  const user = ref({ 
    name: "User", 
    avatar: "/images/profile.png", 
    // ✅ LOAD CACHE: Use cached values if available, otherwise default
    totalWeight: localUser.cachedWeight || null,
    balance: localUser.cachedBalance || "0.00", 
    phone: "",
    pendingEarnings: localUser.cachedPending || "0.00"
  });
  
  const sliderImages = ref(["/images/banner1.jpg", "/images/banner2.jpg"]);
  
  // Only show skeleton if we have NO data in memory AND NO data in cache
  const isLoading = ref(globalRvmList.value.length === 0);

  const HIDDEN_MACHINES = ["071582000008"];
  const FALLBACK_MACHINES = [
    { deviceNo: "071582000002", address: "Taman Wawasan Recreational Park, Puchong", isonline: 0, status: 0, distance: 1200 },
    { deviceNo: "071582000009", address: "Taman Wawasan Recreational Park, Puchong", isonline: 0, status: 0, distance: 1200 }
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

  const fetchRVMs = async () => {
    // Note: We do NOT set isLoading = true here if we already have data.
    // This creates a "silent update" experience.
    if (globalRvmList.value.length === 0) isLoading.value = true;

    try {
      const nearby = await getNearbyRVMs(3.0454, 101.6172); 
      let allMachines = nearby?.data && Array.isArray(nearby.data) ? [...nearby.data] : [];

      FALLBACK_MACHINES.forEach(fallback => {
        if (!allMachines.find(m => m.deviceNo === fallback.deviceNo)) allMachines.push(fallback);
      });
      allMachines = allMachines.filter(m => !HIDDEN_MACHINES.includes(m.deviceNo));

      const detailedMachines = await Promise.all(allMachines.map(async (rvm) => {
        const configRes = await getMachineConfig(rvm.deviceNo);
        const configs = configRes?.data || [];
        const hasValidConfig = (configRes && configRes.code === 200 && configs.length > 0);
        
        let computedOnline = false;
        if (rvm.isonline == 1) computedOnline = true;
        if (rvm.status == 0 || rvm.status == 1) computedOnline = true;
        if (hasValidConfig) computedOnline = true;
        if (FALLBACK_MACHINES.find(f => f.deviceNo === rvm.deviceNo)) computedOnline = true;

        let computedStatus = rvm.status;
        if (hasValidConfig) {
             const hasFault = configs.some(c => c.status === 2 || c.status === 3);
             if (hasFault) computedStatus = 3; 
        }

        return { ...rvm, configs, isRealOnline: computedOnline, computedStatus };
      }));

      const mappedList = detailedMachines.map(rvm => {
        const isOnline = rvm.isRealOnline;
        
        const compartments = rvm.configs.map(conf => {
          const { label, color } = mapTypeToLabel(conf.rubbishTypeName);
          let percent = conf.rate ? Math.round(conf.rate) : 0;
          if (label === "Used Cooking Oil") percent = Math.round((Number(conf.weight || 0) / 400) * 100);
          
          const isBinFull = (percent >= 100 || conf.isFull);
          if (isBinFull) percent = 100;
          
          const statusObj = getCompStatus(isOnline, isBinFull, percent);
          return { label, color, statusText: statusObj.text, statusColor: statusObj.color, percent, isFull: isBinFull };
        });

        if (compartments.length === 0) compartments.push({ label: "Loading...", color: "gray", percent: 0, isFull: false });

        let machineStatusText = "Offline";
        if (isOnline) {
            if (rvm.computedStatus == 3 || rvm.computedStatus == 2) machineStatusText = "Maintenance";
            else if (compartments.length > 0 && compartments.every(c => c.isFull)) machineStatusText = "Bin Full";
            else machineStatusText = "Online";
        }

        return {
          deviceNo: rvm.deviceNo,
          status: machineStatusText,
          distance: (rvm.distance / 1000).toFixed(2),
          address: rvm.address,
          compartments: compartments.sort((a, b) => a.label.localeCompare(b.label))
        };
      });

      globalRvmList.value = mappedList;
      isFirstLoad.value = false;
      
      // ✅ SAVE CACHE: Store the fresh list so next time it loads instantly
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
    // 1. READ LOCAL STORAGE (Immediate Display)
    const localUser = JSON.parse(localStorage.getItem("autogcmUser") || "{}");
    const displayName = localUser.nikeName || localUser.nickname || localUser.name || "User";
    
    user.value.name = displayName;
    user.value.avatar = localUser.avatarUrl || localUser.avatar || "/images/profile.png";
    user.value.phone = localUser.phone || localUser.phonenumber || localUser.phoneNumber || "";

    // 2. FETCH DB DATA (Background Update)
    if (user.value.phone) {
        try {
            const dbUser = await getOrCreateUser(user.value.phone, displayName, user.value.avatar);
            
            if (dbUser) {
                user.value.name = dbUser.nickname || displayName;
                user.value.avatar = dbUser.avatar_url || user.value.avatar;
                
                // Stats
                user.value.totalWeight = Number(dbUser.total_weight || 0).toFixed(2);
                
                const lifetime = Number(dbUser.lifetime_integral || 0);
                // New Code (Uses Secure RPC)
                const { data: financials } = await supabase.rpc('get_user_financial_data', { 
                    p_user_id: dbUser.id 
                });

                if (financials) {
                    // 1. Calculate Spent (IGNORE 'EXTERNAL_SYNC' / MIGRATION records)
                    // We only want to subtract money the user withdrew using THIS app.
                    const spent = (financials.withdrawals || [])
                        .filter(w => w.status !== 'EXTERNAL_SYNC') // ✅ FIX: Ignore migration adjustments
                        .reduce((sum, w) => sum + Number(w.amount), 0);
                    
                    // 2. Calculate Pending Earnings
                    const pending = (financials.submissions || [])
                        .filter(s => s.status === 'PENDING')
                        .reduce((sum, s) => sum + Number(s.machine_given_points), 0);

                    const lifetime = Number(dbUser.lifetime_integral || 0);
                    
                    // Logic: Lifetime (63.99) is the "Balance at Migration".
                    // We only subtract NEW spending.
                    user.value.balance = (lifetime - spent).toFixed(2);
                    user.value.pendingEarnings = pending.toFixed(2);
                    
                    updateCache();
                }

                // ✅ UPDATE CACHE: Save new values for next time
                updateCache();
            }
        } catch (err) {
            console.error("User Load Error:", err);
            if (user.value.totalWeight === null) user.value.totalWeight = "0.00";
        }
    } else {
        console.warn("⚠️ No phone number found in localStorage 'autogcmUser'");
        user.value.totalWeight = "0.00";
    }

    await fetchRVMs();
  });

  return { user, rvmList: globalRvmList, sliderImages, isLoading };
}