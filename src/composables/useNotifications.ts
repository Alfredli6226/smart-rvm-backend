import { ref, onMounted, onUnmounted } from 'vue';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/auth';

// Shared reactive state across all component instances
export const notificationCount = ref(0);
export const issueCount = ref(0);  // Count of unresolved issue reports
let pollInterval: ReturnType<typeof setInterval> | null = null;
let isFetching = false;

export function useNotifications() {
  const auth = useAuthStore();

  const fetchUnreadCount = async () => {
    if (!auth.user?.email || isFetching) return;
    
    isFetching = true;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_email', auth.user.email)
        .eq('is_read', false);
      
      if (error) {
        console.error('Error fetching unread count:', error);
        return;
      }
      
      notificationCount.value = data?.length || 0;
    } catch (err) {
      console.error('Error fetching unread count:', err);
    } finally {
      isFetching = false;
    }
  };

  // Fetch unresolved issue reports count (for SUPER_ADMIN)
  const fetchIssueCount = async () => {
    // Only fetch for SUPER_ADMIN
    if (auth.role !== 'SUPER_ADMIN') {
      issueCount.value = 0;
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('cleaning_logs')
        .select('id', { count: 'exact' })
        .eq('status', 'ISSUE_REPORTED');
      
      if (error) {
        console.error('Error fetching issue count:', error);
        return;
      }
      
      issueCount.value = data?.length || 0;
    } catch (err) {
      console.error('Error fetching issue count:', err);
    }
  };

  const startPolling = () => {
    if (pollInterval) return; // Already polling
    pollInterval = setInterval(() => {
      fetchUnreadCount();
      fetchIssueCount();
    }, 30000);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  onMounted(() => {
    fetchUnreadCount();
    fetchIssueCount();
    startPolling();
  });

  onUnmounted(() => {
    // Don't stop polling - keep it running for other components
  });

  return {
    unreadCount: notificationCount,
    fetchUnreadCount
  };
}
