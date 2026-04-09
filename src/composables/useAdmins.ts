import { ref } from 'vue';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/auth';

export interface AdminUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  created_at: string;
  merchant_id: string | null;
}

export function useAdmins() {
  const auth = useAuthStore();
  const admins = ref<AdminUser[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 1. Fetch Admins (Smart Filter)
  const fetchAdmins = async () => {
    loading.value = true;
    error.value = null;
    
    try {
        let query = supabase
            .from('app_admins')
            .select('*')
            .order('created_at', { ascending: false });

        if (auth.merchantId) {
            // Context: Merchant Admin -> Show only my staff
            query = query.eq('merchant_id', auth.merchantId);
        } else {
            // Context: Platform Owner -> Show other Global Admins (My Team)
            query = query.is('merchant_id', null);
        }

        const { data, error: err } = await query;
        if (err) throw err;
        
        admins.value = data as AdminUser[];

    } catch (err: any) {
        console.error('Error fetching admins:', err);
        error.value = err.message;
    } finally {
        loading.value = false;
    }
  };

  // 2. Add Admin
  const addAdmin = async (email: string, role: string) => {
    if (!email) return { success: false, message: 'Email is required' };
    
    try {
        // Platform Owner sends null (Global), Merchant Admin sends their ID
        const targetMerchantId = auth.merchantId || null;

        const { data, error: err } = await supabase
            .from('app_admins')
            .insert([{ 
                email, 
                role, 
                merchant_id: targetMerchantId 
            }])
            .select()
            .single();

        if (err) throw err;

        // Add to local list immediately to avoid re-fetch
        if (data) admins.value.unshift(data as AdminUser);
        return { success: true };

    } catch (err: any) {
        return { success: false, message: err.message };
    }
  };

  // 3. Remove Admin
  const removeAdmin = async (id: string) => {
    try {
        const { error: err } = await supabase
            .from('app_admins')
            .delete()
            .eq('id', id);

        if (err) throw err;

        // Remove from local list
        admins.value = admins.value.filter(a => a.id !== id);
        return { success: true };

    } catch (err: any) {
        return { success: false, message: err.message };
    }
  };

  // 4. Update Admin Role
  const updateAdminRole = async (id: string, newRole: string) => {
    try {
        const { error: err } = await supabase
            .from('app_admins')
            .update({ role: newRole })
            .eq('id', id);

        if (err) throw err;

        // Update local list
        const admin = admins.value.find(a => a.id === id);
        if (admin) {
            admin.role = newRole as 'ADMIN' | 'EDITOR' | 'VIEWER';
        }
        return { success: true };

    } catch (err: any) {
        return { success: false, message: err.message };
    }
  };

  return {
    admins,
    loading,
    error,
    fetchAdmins,
    addAdmin,
    removeAdmin,
    updateAdminRole
  };
}