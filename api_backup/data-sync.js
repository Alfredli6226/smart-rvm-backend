          last_online_time: machine.lastOnlineTime,
          sync_at: new Date().toISOString()
        };
        
        // Check if machine exists
        const { data: existingMachine } = await supabase
          .from('machines')
          .select('device_no')
          .eq('device_no', machineRecord.device_no)
          .single();
        
        if (existingMachine) {
          // Update existing machine
          const { error } = await supabase
            .from('machines')
            .update(machineRecord)
            .eq('device_no', machineRecord.device_no);
          
          if (error) throw error;
          syncedMachines.push({ device_no: machineRecord.device_no, action: 'updated' });
        } else {
          // Insert new machine
          const { error } = await supabase
            .from('machines')
            .insert(machineRecord);
          
          if (error) throw error;
          syncedMachines.push({ device_no: machineRecord.device_no, action: 'created' });
        }
      } catch (error) {
        errors.push({
          device_no: machine.deviceNo,
          error: error.message
        });
        console.error(`Error syncing machine ${machine.deviceNo}:`, error);
      }
    }
    
    // Update sync status
    await supabase
      .from('sync_logs')
      .insert({
        sync_type: 'machines',
        records_synced: syncedMachines.length,
        errors: errors.length,
        started_at: new Date(Date.now() - 60000).toISOString(),
        completed_at: new Date().toISOString(),
        status: errors.length > 0 ? 'partial' : 'complete'
      });
    
    return res.status(200).json({
      success: true,
      synced: syncedMachines.length,
      errors: errors.length,
      details: {
        syncedMachines: syncedMachines.slice(0, 10),
        errors: errors.slice(0, 5)
      },
      message: `Machine sync completed: ${syncedMachines.length} machines synced, ${errors.length} errors`
    });
  } catch (error) {
    console.error('Machine sync error:', error);
    
    // Log sync failure
    await supabase
      .from('sync_logs')
      .insert({
        sync_type: 'machines',
        records_synced: 0,
        errors: 1,
        started_at: new Date(Date.now() - 60000).toISOString(),
        completed_at: new Date().toISOString(),
        status: 'failed',
        error_message: error.message
      });
    
    return res.status(500).json({ 
      error: 'Failed to sync machines',
      details: error.message 
    });
  }
}

async function fullSync(supabase, req, res) {
  try {
    console.log('Starting full data sync...');
    
    const startTime = Date.now();
    
    // Run all syncs in sequence
    const results = {
      machines: null,
      users: null,
      recycling: null,
      points: null
    };
    
    // 1. Sync machines first (fastest)
    try {
      const machineRes = await syncMachines(supabase, { query: {} }, {
        status: () => ({ json: (data) => data })
      });
      results.machines = machineRes;
    } catch (error) {
      results.machines = { error: error.message };
    }
    
    // 2. Sync users
    try {
      const userRes = await syncUsers(supabase, { query: {} }, {
        status: () => ({ json: (data) => data })
      });
      results.users = userRes;
    } catch (error) {
      results.users = { error: error.message };
    }
    
    // 3. Sync recycling data (first page only for full sync)
    try {
      const recyclingRes = await syncRecycling(supabase, { query: { page: 1, limit: 50 } }, {
        status: () => ({ json: (data) => data })
      });
      results.recycling = recyclingRes;
    } catch (error) {
      results.recycling = { error: error.message };
    }
    
    // 4. Sync points data (first page only for full sync)
    try {
      const pointsRes = await syncPoints(supabase, { query: { page: 1, limit: 50 } }, {
        status: () => ({ json: (data) => data })
      });
      results.points = pointsRes;
    } catch (error) {
      results.points = { error: error.message };
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // Calculate totals
    const totalSynced = [
      results.machines?.synced || 0,
      results.users?.synced || 0,
      results.recycling?.synced || 0,
      results.points?.synced || 0
    ].reduce((sum, count) => sum + count, 0);
    
    const totalErrors = [
      results.machines?.errors || 0,
      results.users?.errors || 0,
      results.recycling?.errors || 0,
      results.points?.errors || 0
    ].reduce((sum, count) => sum + count, 0);
    
    // Log full sync
    await supabase
      .from('sync_logs')
      .insert({
        sync_type: 'full',
        records_synced: totalSynced,
        errors: totalErrors,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date(endTime).toISOString(),
        duration_seconds: parseFloat(duration),
        status: totalErrors > 0 ? 'partial' : 'complete',
        details: {
          machines: results.machines?.synced || 0,
          users: results.users?.synced || 0,
          recycling: results.recycling?.synced || 0,
          points: results.points?.synced || 0
        }
      });
    
    return res.status(200).json({
      success: true,
      duration: `${duration} seconds`,
      totals: {
        synced: totalSynced,
        errors: totalErrors
      },
      results,
      message: `Full sync completed in ${duration}s: ${totalSynced} records synced, ${totalErrors} errors`
    });
  } catch (error) {
    console.error('Full sync error:', error);
    
    // Log sync failure
    await supabase
      .from('sync_logs')
      .insert({
        sync_type: 'full',
        records_synced: 0,
        errors: 1,
        started_at: new Date(Date.now() - 60000).toISOString(),
        completed_at: new Date().toISOString(),
        status: 'failed',
        error_message: error.message
      });
    
    return res.status(500).json({ 
      error: 'Failed to perform full sync',
      details: error.message 
    });
  }
}

async function getSyncStatus(supabase, req, res) {
  try {
    // Get latest sync logs
    const { data: syncLogs } = await supabase
      .from('sync_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);
    
    // Get sync statistics
    const { data: stats } = await supabase
      .from('sync_logs')
      .select('sync_type, status, count(*)')
      .group('sync_type, status');
    
    // Get record counts
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    const { count: submissionCount } = await supabase
      .from('rubbish_records')
      .select('*', { count: 'exact', head: true });
    
    const { count: transactionCount } = await supabase
      .from('wallet_transactions')
      .select('*', { count: 'exact', head: true });
    
    const { count: machineCount } = await supabase
      .from('machines')
      .select('*', { count: 'exact', head: true });
    
    // Calculate sync health
    const lastSync = syncLogs?.[0];
    const syncHealth = lastSync ? {
      status: lastSync.status,
      lastSync: lastSync.completed_at,
      ageHours: Math.floor((new Date() - new Date(lastSync.completed_at)) / (1000 * 60 * 60)),
      recommendation: getSyncRecommendation(lastSync)
    } : {
      status: 'never',
      recommendation: 'Run initial sync'
    };
    
    return res.status(200).json({
      syncHealth,
      recordCounts: {
        users: userCount || 0,
        submissions: submissionCount || 0,
        transactions: transactionCount || 0,
        machines: machineCount || 0
      },
      recentSyncs: syncLogs || [],
      statistics: stats || [],
      nextSync: calculateNextSyncTime(lastSync)
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    return res.status(500).json({ error: 'Failed to get sync status' });
  }
}

function getSyncRecommendation(lastSync) {
  if (!lastSync) return 'Run initial sync';
  
  const ageHours = Math.floor((new Date() - new Date(lastSync.completed_at)) / (1000 * 60 * 60));
  
  if (lastSync.status === 'failed') {
    return 'Fix sync errors and retry';
  }
  
  if (ageHours > 24) {
    return 'Sync is stale - run sync now';
  }
  
  if (ageHours > 6) {
    return 'Sync due soon - schedule within 2 hours';
  }
  
  return 'Sync is up to date';
}

function calculateNextSyncTime(lastSync) {
  if (!lastSync) return 'ASAP';
  
  const lastSyncTime = new Date(lastSync.completed_at);
  const nextSyncTime = new Date(lastSyncTime.getTime() + 6 * 60 * 60 * 1000); // 6 hours later
  
  if (nextSyncTime < new Date()) {
    return 'Overdue - run now';
  }
  
  const hoursUntil = Math.floor((nextSyncTime - new Date()) / (1000 * 60 * 60));
  const minutesUntil = Math.floor(((nextSyncTime - new Date()) % (1000 * 60 * 60)) / (1000 * 60));
  
  return `In ${hoursUntil}h ${minutesUntil}m`;
}

// Export for cron job
export async function runScheduledSync() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing Supabase credentials for scheduled sync');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  
  try {
    console.log('Running scheduled sync...');
    
    // Run incremental sync (machines only for speed)
    const result = await syncMachines(supabase, { query: {} }, {
      status: () => ({ json: (data) => data })
    });
    
    console.log('Scheduled sync completed:', result.message);
    
    // Send notification if there were errors
    if (result.errors > 0) {
      await supabase
        .from('notifications')
        .insert({
          title: '⚠️ Sync Errors Detected',
          message: `Scheduled sync completed with ${result.errors} errors`,
          type: 'warning',
          created_at: new Date().toISOString()
        });
    }
    
    return result;
  } catch (error) {
    console.error('Scheduled sync failed:', error);
    
    // Log failure
    await supabase
      .from('notifications')
      .insert({
        title: '🚨 Sync Failed',
        message: `Scheduled sync failed: ${error.message}`,
        type: 'urgent',
        created_at: new Date().toISOString()
      });
    
    throw error;
  }
}