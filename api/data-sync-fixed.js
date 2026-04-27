export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const { action = 'test' } = req.query;
  
  console.log(`Data sync requested: ${action}`);
  
  try {
    // Mock response for now - fix Supabase connection later
    switch (action) {
      case 'sync-users':
        return res.status(200).json({
          success: true,
          action: 'sync-users',
          synced: 1128,
          message: 'User sync completed (mock data)',
          timestamp: new Date().toISOString(),
          data: {
            total_users: 1128,
            new_users: 0,
            updated_users: 1128,
            errors: 0
          }
        });
        
      case 'sync-machines':
        return res.status(200).json({
          success: true,
          action: 'sync-machines',
          synced: 8,
          message: 'Machine sync completed (mock data)',
          timestamp: new Date().toISOString(),
          machines: [
            { device_no: '071582000001', status: 'online', location: 'Subang Jaya' },
            { device_no: '071582000002', status: 'online', location: 'Puchong' },
            { device_no: '071582000003', status: 'online', location: 'Sunway' },
            { device_no: '071582000004', status: 'online', location: 'KLCC' },
            { device_no: '071582000005', status: 'offline', location: 'Cheras' },
            { device_no: '071582000006', status: 'online', location: 'Damansara' },
            { device_no: '071582000007', status: 'warning', location: 'Meranti Apartment', note: 'OVER CAPACITY: 138.92kg UCO' },
            { device_no: '071582000008', status: 'online', location: 'Bangsar' }
          ]
        });
        
      case 'sync-recycling':
        return res.status(200).json({
          success: true,
          action: 'sync-recycling',
          synced: 3771,
          message: 'Recycling records sync completed (mock data)',
          timestamp: new Date().toISOString(),
          data: {
            total_records: 3771,
            today_records: 42,
            total_weight_kg: 12560.8,
            total_points: 125608
          }
        });
        
      case 'sync-points':
        return res.status(200).json({
          success: true,
          action: 'sync-points',
          synced: 1128,
          message: 'Points sync completed (mock data)',
          timestamp: new Date().toISOString(),
          data: {
            total_points: 125608,
            average_points_per_user: 111.4,
            top_user: { id: '1173008', name: 'Sindylee', points: 1256 }
          }
        });
        
      case 'full-sync':
        return res.status(200).json({
          success: true,
          action: 'full-sync',
          message: 'Full data sync completed (mock data)',
          timestamp: new Date().toISOString(),
          steps: [
            { step: 'sync-machines', status: 'completed', records: 8 },
            { step: 'sync-users', status: 'completed', records: 1128 },
            { step: 'sync-recycling', status: 'completed', records: 3771 },
            { step: 'sync-points', status: 'completed', records: 1128 }
          ],
          summary: {
            total_records_synced: 6035,
            total_time_ms: 2450,
            status: 'success'
          }
        });
        
      case 'test':
      default:
        return res.status(200).json({
          success: true,
          action: 'test',
          message: 'Data sync API is working',
          endpoints: [
            '/api/data-sync?action=sync-users',
            '/api/data-sync?action=sync-machines',
            '/api/data-sync?action=sync-recycling',
            '/api/data-sync?action=sync-points',
            '/api/data-sync?action=full-sync'
          ],
          timestamp: new Date().toISOString()
        });
    }
    
  } catch (error) {
    console.error('Data sync error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}