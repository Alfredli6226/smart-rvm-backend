import { ref } from 'vue';
import { supabase } from '../services/supabase';
import type { Merchant } from '../types'; 

export interface AdminMerchant extends Merchant {
  admins?: { id: string; email: string }[]; 
  machines?: { 
      device_no: string; 
      name: string; 
      rate_plastic: number; 
      rate_paper: number; 
      rate_uco: number; 
  }[];
}

export function useMerchants() {
  const merchants = ref<AdminMerchant[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 1. Fetch All Merchants
  const fetchMerchants = async () => {
    loading.value = true;
    error.value = null;
    try {
      const { data, error: err } = await supabase
        .from('merchants')
        .select(`
            *, 
            app_admins(id, email), 
            machines(device_no, name, rate_plastic, rate_paper, rate_uco)
        `) 
        .order('created_at', { ascending: false });

      if (err) throw err;

      merchants.value = data.map((m: any) => ({
        ...m,
        admins: m.app_admins || [],
        machines: m.machines || []
      }));
    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  // 2. Create or Update Merchant
  const saveMerchant = async (form: any, isEditMode: boolean, merchantId?: string) => {
    loading.value = true;
    try {
      // A. Update Merchant Basic Info
      const payload = {
        name: form.name,
        currency_symbol: form.currency,
        is_active: form.is_active ?? true
      };

      let activeMerchantId = merchantId;

      if (isEditMode && merchantId) {
        const { error: uError } = await supabase.from('merchants').update(payload).eq('id', merchantId);
        if (uError) throw uError;
      } else {
        const { data: mData, error: iError } = await supabase.from('merchants').insert(payload).select().single();
        if (iError) throw iError;
        activeMerchantId = mData.id;
      }

      // B. Create New Admin (If provided)
      if (form.newAdminEmail && activeMerchantId) {
          const { error: aError } = await supabase.from('app_admins').insert({
            email: form.newAdminEmail,
            role: 'SUPER_ADMIN',
            merchant_id: activeMerchantId
          });
          if (aError && aError.code !== '23505') throw aError;
      }

      if (activeMerchantId) {
          // C. Assign NEW Machines (from Textarea)
          if (form.assignedMachines && form.assignedMachines.length > 0) {
              const devices = form.assignedMachines.split(',').map((s: string) => s.trim()).filter((s: string) => s);
              if (devices.length > 0) {
                  // Assign machines - this will assign them to this merchant
                  await supabase
                      .from('machines')
                      .update({ merchant_id: activeMerchantId })
                      .in('device_no', devices);
              }
          }

          // D. Update Rates for EXISTING Machines (Per Machine Logic)
          if (form.machines && form.machines.length > 0) {
              for (const m of form.machines) {
                  await supabase.from('machines').update({
                      rate_plastic: m.rate_plastic,
                      rate_paper: m.rate_paper,
                      rate_uco: m.rate_uco
                  }).eq('device_no', m.device_no);
              }
          }
      }

      await fetchMerchants();
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    } finally {
      loading.value = false;
    }
  };

  // 3. Delete Admin (Immediate Action)
  const deleteMerchantAdmin = async (adminId: string) => {
      if (!confirm("Are you sure you want to remove this admin?")) return false;
      
      const { error: err } = await supabase.from('app_admins').delete().eq('id', adminId);
      if (err) {
          alert("Error: " + err.message);
          return false;
      }
      // Refresh local data
      await fetchMerchants();
      return true;
  };

  // 4. Delete Merchant (Client)
  // Note: This requires CASCADE delete foreign keys to be set in the database
  // Run fix_all_cascade_deletes.sql in Supabase to enable cascade deletes
  const deleteMerchant = async (merchantId: string) => {
      try {
          // Let the database handle cascade delete (if foreign keys are set correctly)
          const { error: mError } = await supabase.from('merchants').delete().eq('id', merchantId);
          
          if (mError) {
              // If cascade delete isn't set up, try manual deletion
              console.log("Cascade delete not available, trying manual deletion...");
              
              // Get all users for this merchant
              const { data: merchantWallets } = await supabase
                  .from('merchant_wallets')
                  .select('user_id')
                  .eq('merchant_id', merchantId);
              const userIds = merchantWallets?.map(w => w.user_id) || [];

              // Delete wallet_transactions for these users
              if (userIds.length > 0) {
                  await supabase.from('wallet_transactions').delete().in('user_id', userIds);
              }
              await supabase.from('wallet_transactions').delete().eq('merchant_id', merchantId);
              await supabase.from('merchant_wallets').delete().eq('merchant_id', merchantId);
              await supabase.from('app_admins').delete().eq('merchant_id', merchantId);
              await supabase.from('machines').delete().eq('merchant_id', merchantId);
              await supabase.from('withdrawals').delete().eq('merchant_id', merchantId);
              await supabase.from('submission_reviews').delete().eq('merchant_id', merchantId);
              await supabase.from('cleaning_records').delete().eq('merchant_id', merchantId);
              await supabase.from('autogcm_records').delete().eq('merchant_id', merchantId);
              
              // Final attempt to delete merchant
              const { error: retryError } = await supabase.from('merchants').delete().eq('id', merchantId);
              if (retryError) throw retryError;
          }

          await fetchMerchants();
          return { success: true };
      } catch (err: any) {
          console.error("Delete merchant error:", err);
          return { success: false, message: err.message };
      }
  };

  // 4. Toggle Status
  const toggleStatus = async (merchant: AdminMerchant) => {
    try {
      const newVal = !merchant.is_active;
      const { error: err } = await supabase
        .from('merchants')
        .update({ is_active: newVal })
        .eq('id', merchant.id);
      
      if (!err) merchant.is_active = newVal;
    } catch (e) {
      console.error(e);
    }
  };

  return { 
    merchants, 
    loading, 
    error,
    fetchMerchants, 
    saveMerchant, 
    deleteMerchantAdmin,
    deleteMerchant,
    toggleStatus 
  };
}
