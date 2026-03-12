import { ref } from 'vue';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/auth';

export function useMerchantSettings() {
    const auth = useAuthStore();
    const loading = ref(false);
    const saving = ref(false);
    const message = ref('');

    const merchant = ref<any>({});
    const machines = ref<any[]>([]);

    const currentEditId = ref<string | null>(null);


    const fetchData = async (overrideId?: string) => {
        // Priority: Override ID -> Logged in Merchant ID
        const targetId = overrideId || auth.merchantId;

        if (!targetId) return;
        
        currentEditId.value = targetId; // Set the active context
        loading.value = true;
        
        try {
            // 1. Get Merchant
            const { data: merchantData, error: mError } = await supabase
                .from('merchants')
                .select('*')
                .eq('id', targetId) // Use targetId
                .single();
            if (mError) throw mError;
            merchant.value = merchantData;

            // 2. Get Machines
            const { data: machineData, error: macError } = await supabase
                .from('machines')
                .select('*')
                .eq('merchant_id', targetId) // Use targetId
                .order('device_no');
            if (macError) throw macError;
            
            machines.value = machineData.map((m: any) => ({
                ...m,
                _comboRate: m.rate_plastic || 0
            }));

        } catch (err: any) {
            console.error("Error loading settings:", err.message);
        } finally {
            loading.value = false;
        }
    };

    const saveSettings = async () => {
        // 🔥 MODIFIED: Use currentEditId instead of auth.merchantId
        if (!currentEditId.value) return;

        saving.value = true;
        message.value = '';
        try {
            // 1. Save Merchant Profile
            const { error: mError } = await supabase
                .from('merchants')
                .update({
                    name: merchant.value.name,
                    currency_symbol: merchant.value.currency_symbol,
                    contact_email: merchant.value.contact_email,
                })
                .eq('id', currentEditId.value); // Use currentEditId

            if (mError) throw mError;

            // 2. Save Each Machine (Keep existing logic)
            for (const m of machines.value) {
                // ... (rest of the loop remains exactly the same) ...
                // Just ensuring the context is correct
                
                const plasticRate = m._comboRate; 
                const canRate = m._comboRate; 

                await supabase
                    .from('machines')
                    .update({ 
                        // ... fields ...
                        name: m.name, 
                        location_name: m.location_name,
                        address: m.address, 
                        maintenance_contact: m.maintenance_contact,
                        latitude: m.latitude,
                        longitude: m.longitude,
                        rate_plastic: plasticRate,
                        rate_can: canRate,
                        rate_paper: m.rate_paper,
                        rate_uco: m.rate_uco,
                        config_bin_1: m.config_bin_1,
                        config_bin_2: m.config_bin_2
                    })
                    .eq('id', m.id);
            }

            message.value = "All fleet settings saved successfully!";
            setTimeout(() => message.value = '', 3000);

        } catch (err: any) {
            alert("Failed to save: " + err.message);
        } finally {
            saving.value = false;
        }
    };

    const fetchAddress = async (m: any) => {
        if (!m.latitude || !m.longitude) {
            alert("Please enter Latitude and Longitude first.");
            return;
        }
        const originalText = m.address;
        m.address = "Fetching address...";
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${m.latitude}&lon=${m.longitude}`);
            const data = await res.json();
            if (data && data.display_name) m.address = data.display_name;
            else {
                m.address = originalText;
                alert("Address not found.");
            }
        } catch (err) {
            m.address = originalText;
            alert("Map service unavailable.");
        }
    };

    return {
        loading, saving, message, merchant, machines, 
        fetchData, saveSettings, fetchAddress
    };
}