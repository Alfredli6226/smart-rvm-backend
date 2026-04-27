export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const { action = 'get-alerts' } = req.query;
  
  console.log(`Notifications requested: ${action}`);
  
  try {
    switch (action) {
      case 'get-alerts':
        return res.status(200).json({
          success: true,
          action: 'get-alerts',
          timestamp: new Date().toISOString(),
          alerts: [
            {
              id: 'alert-001',
              machine_no: '071582000007',
              machine_name: 'Meranti Apartment, Subang Jaya',
              alert_level: 'EMERGENCY',
              alert_type: 'OVER_CAPACITY',
              message: '机器超载: 138.92kg UCO (容量: 100kg) - 超载38.92kg!',
              current_weight: 138.92,
              capacity: 100,
              percentage_full: 138.9,
              priority: 'HIGH',
              created_at: new Date().toISOString(),
              requires_action: true,
              action_required: '立即派维护团队清空机器'
            },
            {
              id: 'alert-002',
              machine_no: '071582000005',
              machine_name: 'Subang Jaya SS15',
              alert_level: 'WARNING',
              alert_type: 'HIGH_USAGE',
              message: '机器使用率高: 85% (425/500kg)',
              current_weight: 425,
              capacity: 500,
              percentage_full: 85,
              priority: 'MEDIUM',
              created_at: new Date(Date.now() - 3600000).toISOString(), // 1小时前
              requires_action: false,
              action_required: '计划维护'
            },
            {
              id: 'alert-003',
              machine_no: '071582000003',
              machine_name: 'Dataran Banting, Banting',
              alert_level: 'INFO',
              alert_type: 'SCHEDULED_MAINTENANCE',
              message: '预定维护: 明天上午10点',
              current_weight: 320,
              capacity: 500,
              percentage_full: 64,
              priority: 'LOW',
              created_at: new Date(Date.now() - 7200000).toISOString(), // 2小时前
              requires_action: true,
              action_required: '确认维护时间'
            }
          ],
          summary: {
            total_alerts: 3,
            emergency: 1,
            warning: 1,
            info: 1,
            requires_action: 2
          }
        });
        
      case 'get-machine-status':
        const { machine_no } = req.query;
        if (!machine_no) {
          return res.status(400).json({
            success: false,
            error: 'Machine number required',
            message: 'Please provide machine_no parameter'
          });
        }
        
        // Mock machine status
        const machineStatus = {
          '071582000001': { status: 'online', weight: 450, capacity: 800, percentage: 56 },
          '071582000002': { status: 'online', weight: 380, capacity: 600, percentage: 63 },
          '071582000003': { status: 'online', weight: 320, capacity: 500, percentage: 64 },
          '071582000004': { status: 'online', weight: 480, capacity: 700, percentage: 69 },
          '071582000005': { status: 'warning', weight: 425, capacity: 500, percentage: 85 },
          '071582000006': { status: 'online', weight: 350, capacity: 600, percentage: 58 },
          '071582000007': { status: 'emergency', weight: 138.92, capacity: 100, percentage: 138.9 },
          '071582000008': { status: 'online', weight: 620, capacity: 900, percentage: 69 }
        };
        
        const status = machineStatus[machine_no] || { 
          status: 'unknown', 
          weight: 0, 
          capacity: 600, 
          percentage: 0 
        };
        
        return res.status(200).json({
          success: true,
          action: 'get-machine-status',
          machine_no,
          timestamp: new Date().toISOString(),
          status
        });
        
      case 'send-test-alert':
        return res.status(200).json({
          success: true,
          action: 'send-test-alert',
          message: '测试警报已发送',
          timestamp: new Date().toISOString(),
          alert: {
            type: 'TEST',
            message: '这是测试警报 - 系统通知功能正常',
            sent_to: ['telegram', 'email'],
            status: 'delivered'
          }
        });
        
      case 'check-capacities':
        return res.status(200).json({
          success: true,
          action: 'check-capacities',
          timestamp: new Date().toISOString(),
          machines: [
            { machine_no: '071582000001', location: 'Subang Jaya', capacity: 800, current: 450, percentage: 56, status: 'normal' },
            { machine_no: '071582000002', location: 'Puchong', capacity: 600, current: 380, percentage: 63, status: 'normal' },
            { machine_no: '071582000003', location: 'Banting', capacity: 500, current: 320, percentage: 64, status: 'normal' },
            { machine_no: '071582000004', location: 'Puchong Prima', capacity: 700, current: 480, percentage: 69, status: 'normal' },
            { machine_no: '071582000005', location: 'Subang Jaya SS15', capacity: 500, current: 425, percentage: 85, status: 'warning' },
            { machine_no: '071582000006', location: 'Putra Heights', capacity: 600, current: 350, percentage: 58, status: 'normal' },
            { machine_no: '071582000007', location: 'Meranti Apartment', capacity: 100, current: 138.92, percentage: 138.9, status: 'emergency' },
            { machine_no: '071582000008', location: 'Bandar Sunway', capacity: 900, current: 620, percentage: 69, status: 'normal' }
          ],
          summary: {
            total_machines: 8,
            normal: 6,
            warning: 1,
            emergency: 1,
            average_percentage: 70.4
          }
        });
        
      default:
        return res.status(200).json({
          success: true,
          action: 'help',
          message: 'Notifications API endpoints',
          timestamp: new Date().toISOString(),
          endpoints: [
            '/api/notifications?action=get-alerts',
            '/api/notifications?action=get-machine-status&machine_no=071582000001',
            '/api/notifications?action=send-test-alert',
            '/api/notifications?action=check-capacities'
          ],
          parameters: {
            'action': 'get-alerts, get-machine-status, send-test-alert, check-capacities',
            'machine_no': 'Required for get-machine-status (e.g., 071582000001)'
          }
        });
    }
    
  } catch (error) {
    console.error('Notifications error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}