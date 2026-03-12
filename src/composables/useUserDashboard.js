import { ref, onMounted } from "vue";
import { getUserRecords } from "../services/autogcm.js";

export function useUserDashboard() {
  const stats = ref({
    totalWeight: "0.00",
    totalPoints: "0.00",
    totalItems: 0,
    recycleCount: 0
  });
  
  const history = ref([]);
  const isLoading = ref(true);
  const error = ref(null);

  // Helper to format dates
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-MY', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  const fetchDashboardData = async () => {
    isLoading.value = true;
    try {
      const user = JSON.parse(localStorage.getItem("autogcmUser") || "{}");
      if (!user.phone) throw new Error("User phone not found");

      // Fetch records (Page 1, 50 items)
      const res = await getUserRecords(user.phone, 1, 50);
      
      if (res.code === 200 && res.data && res.data.list) {
        
        // 🟢 FIX STARTS HERE: Process list to find hidden names
        const list = res.data.list.map(item => {
           let realName = item.rubbishName;
           
           // If the top-level name is missing, check the nested details list
           if (!realName && item.rubbishLogDetailsVOList && item.rubbishLogDetailsVOList.length > 0) {
              realName = item.rubbishLogDetailsVOList[0].rubbishName;
           }
           
           // Return the item with the correct name forced to the top level
           return {
             ...item,
             rubbishName: realName 
           };
        });
        // 🟢 FIX ENDS HERE

        history.value = list;

        // Calculate Stats
        const weight = list.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
        const points = list.reduce((sum, item) => sum + (Number(item.integral) || 0), 0);

        stats.value = {
          totalWeight: weight.toFixed(2),
          totalPoints: points.toFixed(2),
          totalItems: list.length,
          recycleCount: list.length
        };
      }
    } catch (err) {
      console.error("Dashboard Error:", err);
      error.value = "Failed to load history.";
    } finally {
      isLoading.value = false;
    }
  };

  onMounted(() => {
    fetchDashboardData();
  });

  return {
    stats,
    history,
    isLoading,
    error,
    formatDate
  };
}