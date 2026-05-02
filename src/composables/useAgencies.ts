// Agencies management — create VIEWER accounts + assign machines
import { ref, computed } from 'vue';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/auth';
import { proxyInsert, proxyDelete } from '../services/supabaseProxy';

export function useAgencies() {
  const auth = useAuthStore();
  const agencies = ref<any[]>([]);
  const machines = ref<any[]>([]);
  const loading = ref(false);
  const selectedAgencyId = ref<string | null>(null);
  const selectedAgencyAssignments = ref<any[]>([]);
  
  // Fetch all VIEWER accounts
  const fetchAgencies = async () => {
    loading.value = true;
    try {
      const { data, error } = await supabase
        .from('app_admins')
        .select('*')
        .eq('role', 'VIEWER')
        .order('created_at', { ascending: false });
      if (error) throw error;
      agencies.value = data || [];
    } catch (err: any) {
      console.error('Error fetching agencies:', err);
    } finally {
      loading.value = false;
    }
  };

  // Fetch all machines for assignment
  const fetchMachines = async () => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('id,device_no,name,zone,address')
        .order('device_no');
      if (error) throw error;
      machines.value = data || [];
    } catch (err: any) {
      console.error('Error fetching machines:', err);
    }
  };

  // Fetch assigned machines for a specific agency
  const fetchAssignments = async (adminId: string) => {
    selectedAgencyId.value = adminId;
    try {
      const { data, error } = await supabase
        .from('viewer_machine_assignments')
        .select('machine_id')
        .eq('admin_id', adminId);
      if (error) throw error;
      selectedAgencyAssignments.value = data?.map(a => a.machine_id) || [];
    } catch (err: any) {
      console.error('Error fetching assignments:', err);
    }
  };

  // Toggle machine assignment
  const toggleMachine = async (adminId: string, machineId: number) => {
    const isAssigned = selectedAgencyAssignments.value.includes(machineId);
    
    try {
      if (isAssigned) {
        await supabase.from('viewer_machine_assignments')
          .delete()
          .eq('admin_id', adminId)
          .eq('machine_id', machineId);
        selectedAgencyAssignments.value = selectedAgencyAssignments.value.filter(id => id !== machineId);
      } else {
        await supabase.from('viewer_machine_assignments')
          .insert({ admin_id: adminId, machine_id: machineId });
        selectedAgencyAssignments.value.push(machineId);
      }
    } catch (err: any) {
      console.error('Error toggling machine:', err);
    }
  };

  // Create new agency account
  const createAgency = async (email: string) => {
    try {
      const { error } = await supabase
        .from('app_admins')
        .insert({ email, role: 'VIEWER', merchant_id: null });
      if (error) throw error;
      await fetchAgencies();
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  // Remove agency
  const removeAgency = async (id: string) => {
    try {
      // Remove all machine assignments first
      await supabase.from('viewer_machine_assignments').delete().eq('admin_id', id);
      // Remove admin
      await supabase.from('app_admins').delete().eq('id', id);
      await fetchAgencies();
      if (selectedAgencyId.value === id) {
        selectedAgencyId.value = null;
        selectedAgencyAssignments.value = [];
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  return {
    agencies,
    machines,
    loading,
    selectedAgencyId,
    selectedAgencyAssignments,
    fetchAgencies,
    fetchMachines,
    fetchAssignments,
    toggleMachine,
    createAgency,
    removeAgency,
  };
}
