import { ref } from 'vue';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/auth';
import type { ViewerMachineAssignment } from '../types';

export function useViewerAssignments() {
  const auth = useAuthStore();
  const assignments = ref<ViewerMachineAssignment[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 1. Fetch assignments for a specific viewer (by admin_id)
  const fetchAssignmentsForViewer = async (adminId: string) => {
    loading.value = true;
    error.value = null;
    
    try {
      const { data, error: err } = await supabase
        .from('viewer_machine_assignments')
        .select(`
          *,
          machines(
            device_no,
            name,
            address,
            zone
          )
        `)
        .eq('admin_id', adminId);

      if (err) throw err;
      assignments.value = data as ViewerMachineAssignment[] || [];
    } catch (err: any) {
      console.error('Error fetching viewer assignments:', err);
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  // 2. Fetch current VIEWER's own assignments
  const fetchMyAssignments = async () => {
    if (!auth.user?.email) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      // First get the admin record for current user
      const { data: adminData, error: adminError } = await supabase
        .from('app_admins')
        .select('id')
        .eq('email', auth.user.email)
        .single();
      
      if (adminError) throw adminError;
      if (!adminData) {
        assignments.value = [];
        return;
      }

      // Then get their machine assignments
      const { data, error: err } = await supabase
        .from('viewer_machine_assignments')
        .select(`
          *,
          machines(
            device_no,
            name,
            address,
            zone
          )
        `)
        .eq('admin_id', adminData.id);

      if (err) throw err;
      assignments.value = data as ViewerMachineAssignment[] || [];
    } catch (err: any) {
      console.error('Error fetching my assignments:', err);
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  // 3. Assign machines to a viewer (for Super Admins)
  const assignMachinesToViewer = async (viewerAdminId: string, machineIds: number[]) => {
    loading.value = true;
    error.value = null;
    
    try {
      // Get current admin ID for assigned_by
      const { data: currentAdmin } = await supabase
        .from('app_admins')
        .select('id')
        .eq('email', auth.user?.email)
        .single();

      // Create assignment records
      const assignments = machineIds.map(machineId => ({
        admin_id: viewerAdminId,
        machine_id: machineId,
        assigned_by: currentAdmin?.id || null
      }));

      const { error: err } = await supabase
        .from('viewer_machine_assignments')
        .upsert(assignments, { onConflict: 'admin_id,machine_id' });

      if (err) throw err;
      return { success: true };
    } catch (err: any) {
      console.error('Error assigning machines:', err);
      return { success: false, message: err.message };
    } finally {
      loading.value = false;
    }
  };

  // 4. Remove machine assignment from viewer
  const removeAssignment = async (assignmentId: string) => {
    loading.value = true;
    error.value = null;
    
    try {
      const { error: err } = await supabase
        .from('viewer_machine_assignments')
        .delete()
        .eq('id', assignmentId);

      if (err) throw err;
      
      // Update local list
      assignments.value = assignments.value.filter(a => a.id !== assignmentId);
      return { success: true };
    } catch (err: any) {
      console.error('Error removing assignment:', err);
      return { success: false, message: err.message };
    } finally {
      loading.value = false;
    }
  };

  // 5. Get assigned machine IDs for filtering
  const getAssignedMachineIds = () => {
    return assignments.value.map(a => a.machine_id);
  };

  // 6. Check if viewer has any assignments
  const hasAssignments = () => {
    return assignments.value.length > 0;
  };

  return {
    assignments,
    loading,
    error,
    fetchAssignmentsForViewer,
    fetchMyAssignments,
    assignMachinesToViewer,
    removeAssignment,
    getAssignedMachineIds,
    hasAssignments
  };
}
