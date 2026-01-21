import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { updateUserProfile } from "../services/autogcm.js"; 
import { supabase, getOrCreateUser } from "../services/supabase.js";

export function useProfileLogic() {
  const router = useRouter();

  // Load cache helper
  const localUser = JSON.parse(localStorage.getItem("autogcmUser") || "{}");

  // --- State ---
  const user = ref({
    name: localUser.nikeName || "User",
    phone: localUser.phone || "",
    // ✅ LOAD CACHE
    totalWeight: localUser.cachedWeight || null,
    points: localUser.cachedBalance || "0.00",
    avatar: localUser.avatarUrl || "/images/profile.png",
  });

  const showLogoutModal = ref(false);
  const showEditModal = ref(false);
  const isSaving = ref(false);

  const feedbackModal = reactive({
    isOpen: false,
    title: "",
    message: "",
    isError: false
  });

  const editForm = reactive({ name: "", avatar: "" });

  const presetAvatars = [
    "/images/profile.png",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Zack",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Bella",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Rocky",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo",
  ];


  const locationEnabled = ref(localStorage.getItem("useLocation") === "true");

  // Add this new function
  const toggleLocation = () => {
    if (!locationEnabled.value) {
      // User wants to turn ON -> Request Permission
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          () => {
            locationEnabled.value = true;
            localStorage.setItem("useLocation", "true");
            alert("Location enabled! Nearby machines will update on the Home page.");
          },
          (error) => {
            console.error("Permission denied", error);
            locationEnabled.value = false;
            localStorage.setItem("useLocation", "false");
            alert("Location permission denied. Please enable it in your browser settings.");
          }
        );
      }
    } else {
      // User wants to turn OFF
      locationEnabled.value = false;
      localStorage.setItem("useLocation", "false");
    }
  };

  // --- Helpers ---
  const showFeedback = (title, message, isError = false) => {
    feedbackModal.title = title;
    feedbackModal.message = message;
    feedbackModal.isError = isError;
    feedbackModal.isOpen = true;
  };

  const closeFeedback = () => {
    feedbackModal.isOpen = false;
  };

  const handleImageError = (e) => e.target.src = "/images/profile.png";

  const confirmLogout = () => showLogoutModal.value = true;

  const performLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  const openEditModal = () => {
    editForm.name = user.value.name;
    editForm.avatar = user.value.avatar;
    showEditModal.value = true;
  };

  const saveProfile = async () => {
    if (!editForm.name.trim()) return showFeedback("Error", "Nickname cannot be empty", true);

    isSaving.value = true;
    try {
      const phone = user.value.phone;

      // 1. Update Supabase (Uses Secure RPC)
      // We use getOrCreateUser because it internally calls 'upsert_user_by_phone'
      // which has the permissions to bypass RLS and update the record.
      const result = await getOrCreateUser(phone, editForm.name, editForm.avatar);
      
      if (!result) throw new Error("Database update failed");

      // 2. Update AutoGCM (Silent Best Effort)
      try { await updateUserProfile(phone, editForm.name, editForm.avatar); } catch (e) { console.warn(e); }

      // 3. Update Local State & Cache
      user.value.name = editForm.name;
      user.value.avatar = editForm.avatar;

      const localUser = JSON.parse(localStorage.getItem("autogcmUser") || "{}");
      localUser.nikeName = editForm.name;
      localUser.avatarUrl = editForm.avatar;
      localStorage.setItem("autogcmUser", JSON.stringify(localUser));
      
      showEditModal.value = false;
      showFeedback("Success!", "Profile updated successfully.");

    } catch (e) {
      console.error(e);
      showFeedback("Error", "Failed to update profile. Please try again.", true);
    } finally {
      isSaving.value = false;
    }
  };

  // --- Lifecycle ---
  onMounted(async () => {
    const localUser = JSON.parse(localStorage.getItem("autogcmUser") || "{}");
    const phone = localUser.phone;

    // We already set initial state from cache above, now we refresh
    if (phone) {
        try {
            // 1. Get/Sync User
            const dbUser = await getOrCreateUser(phone, user.value.name, user.value.avatar);
            
            if (dbUser) {
                user.value.name = dbUser.nickname || user.value.name;
                user.value.avatar = dbUser.avatar_url || user.value.avatar;
                user.value.totalWeight = Number(dbUser.total_weight || 0).toFixed(2);

                // 2. Fetch Financials (Securely via RPC)
                const { data: financials } = await supabase.rpc('get_user_financial_data', { 
                    p_user_id: dbUser.id 
                });

                if (financials) {
                    // Calculate Spent (Same logic as Home Page)
                    // We filter out 'EXTERNAL_SYNC' to avoid double-deducting migration adjustments
                    const spent = (financials.withdrawals || [])
                        .filter(w => w.status !== 'EXTERNAL_SYNC') 
                        .reduce((sum, w) => sum + Number(w.amount), 0);

                    const lifetime = Number(dbUser.lifetime_integral || 0);
                    
                    // ✅ CORRECT MATH: Lifetime - Spent = Current Balance
                    user.value.points = (lifetime - spent).toFixed(2);

                    // Update Cache
                    localUser.cachedWeight = user.value.totalWeight;
                    localUser.cachedBalance = user.value.points;
                    localStorage.setItem("autogcmUser", JSON.stringify(localUser));
                }
            }
        } catch (e) { 
            console.error("Profile Load Error:", e); 
        }
    }
    if (user.value.totalWeight === null) user.value.totalWeight = "0.00";
  });

  return {
    user,
    showLogoutModal,
    showEditModal,
    isSaving,
    editForm,
    presetAvatars,
    feedbackModal, 
    showFeedback,
    closeFeedback, 
    handleImageError,
    confirmLogout,
    performLogout,
    openEditModal,
    saveProfile,
    locationEnabled, 
    toggleLocation   
  };
}