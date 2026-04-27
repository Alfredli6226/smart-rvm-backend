import { createClient } from '@supabase/supabase-js';

// Machine capacity configuration
const MACHINE_CAPACITIES = {
  '071582000001': 800,   // Meranti Apartment, Subang Jaya
  '071582000002': 600,   // Taman Wawasan Recreational Park, Puchong
  '071582000003': 500,   // Dataran Banting, Banting
  '071582000004': 700,   // Puchong Prima, Puchong
  '071582000005': 800,   // Subang Jaya SS15
  '071582000006': 600,   // Putra Heights, Subang Jaya
  '071582000007': 1000,  // Meranti Apartment (high traffic)
  '071582000008': 900,   // Bandar Sunway, Petaling Jaya
  '071582000009': 700,   // Klang
  '071582000010': 800    // Shah Alam
};

// Default capacity for unconfigured machines
const DEFAULT_CAPACITY = 600;

// Alert thresholds (percentage based)
const ALERT_THRESHOLDS = {
  WARNING: 70,    // Yellow alert at 70% full
  CRITICAL: 85,   // Orange alert at 85% full  
  EMERGENCY: 95   // Red alert at 95% full
};

// Helper functions for capacity management
function getMachineCapacity(machineNo) {
  return MACHINE_CAPACITIES[machineNo] || DEFAULT_CAPACITY;
}

function getAlertLevel(machineNo, currentWeight) {
  const capacity = getMachineCapacity(machineNo);
  const percentage = (currentWeight / capacity) * 100;
  
  if (percentage >= ALERT_THRESHOLDS.EMERGENCY) return 'EMERGENCY';
  if (percentage >= ALERT_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (percentage >= ALERT_THRESHOLDS.WARNING) return 'WARNING';
  return 'NORMAL';
}

function getPercentageFull(machineNo, currentWeight) {
  const capacity = getMachineCapacity(machineNo);
  return Math.round((currentWeight / capacity) * 100);
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Get Supabase credentials
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { action } = req.query;
    
    switch (action) {
      case 'check-alerts':
        return await checkAlerts(supabase, req, res);
      
      case 'send-notification':
        return await sendNotification(supabase, req, res);
      
      case 'get-notifications':
        return await getNotifications(supabase, req, res);
      
      case 'mark-read':
        return await markNotificationRead(supabase, req, res);
      
      default:
        return res.status(404).json({ error: 'Action not found' });
    }
  } catch (error) {
    console.error('Notifications error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

async function checkAlerts(supabase, req, res) {
  try {
    const alerts = [];
    
    // 1. Check for overweight machines
    const { data: machines } = await supabase
      .from('machines')
      .select('device_no, current_bag_weight, current_weight_2, config_bin_1, config_bin_2, address');
    
    machines?.forEach(machine => {
      const bin1Weight = parseFloat(machine.current_bag_weight || 0);
      const bin2Weight = parseFloat(machine.current_weight_2 || 0);
      const totalWeight = bin1Weight + bin2Weight;
      
      // Get machine-specific capacity
      const machineCapacity = getMachineCapacity(machine.device_no);
      const percentageFull = getPercentageFull(machine.device_no, totalWeight);
      const alertLevel = getAlertLevel(machine.device_no, totalWeight);
      
      // Check if machine needs attention based on alert level
      if (alertLevel !== 'NORMAL') {
        let alertType, alertTitle, alertMessage;
        
        switch (alertLevel) {
          case 'EMERGENCY':
            alertType = 'urgent';
            alertTitle = '🚨 EMERGENCY: Machine Over Capacity!';
            alertMessage = `Machine ${machine.device_no} is ${percentageFull}% full (${totalWeight}kg/${machineCapacity}kg). ` +
                          `IMMEDIATE collection required!`;
            break;
          case 'CRITICAL':
            alertType = 'urgent';
            alertTitle = '🔴 CRITICAL: Machine Nearly Full';
            alertMessage = `Machine ${machine.device_no} is ${percentageFull}% full (${totalWeight}kg/${machineCapacity}kg). ` +
                          `Urgent collection needed within 24 hours.`;
            break;
          case 'WARNING':
            alertType = 'warning';
            alertTitle = '⚠️ WARNING: Machine Approaching Capacity';
            alertMessage = `Machine ${machine.device_no} is ${percentageFull}% full (${totalWeight}kg/${machineCapacity}kg). ` +
                          `Schedule collection soon.`;
            break;
        }
        
        alerts.push({
          type: alertType,
          title: alertTitle,
          message: alertMessage + ` Location: ${machine.address || 'Unknown location'}`,
          device: machine.device_no,
          weight: totalWeight,
          capacity: machineCapacity,
          percentage: percentageFull,
          alertLevel: alertLevel,
          timestamp: new Date().toISOString(),
          action: 'send_maintenance_team'
        });
      }
    });
    
    // 2. Check for inactive machines (no submissions in 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: recentSubmissions } = await supabase
      .from('rubbish_records')
      .select('deviceNo, createTime')
      .gte('createTime', sevenDaysAgo.toISOString());
    
    const activeMachines = new Set(recentSubmissions?.map(s => s.deviceNo) || []);
    
    machines?.forEach(machine => {
      if (!activeMachines.has(machine.device_no) && machine.is_active) {
        alerts.push({
          type: 'warning',
          title: '⚠️ Inactive Machine',
          message: `Machine ${machine.device_no} has no recycling activity in the last 7 days`,
          device: machine.device_no,
          timestamp: new Date().toISOString(),
          action: 'check_machine_status'
        });
      }
    });
    
    // 3. Check for high-performing users (opportunity for rewards)
    const { data: topUsers } = await supabase
      .from('users')
      .select('user_id, nickName, total_weight, total_points')
      .order('total_weight', { ascending: false })
      .limit(5);
    
    topUsers?.forEach((user, index) => {
      if (user.total_weight > 50) { // More than 50kg recycled
        alerts.push({
          type: 'info',
          title: '🏆 Top Recycler Alert',
          message: `${user.nickName || `User ${user.user_id}`} has recycled ${user.total_weight}kg ` +
                   `and earned ${user.total_points} points. Consider a reward!`,
          userId: user.user_id,
          weight: user.total_weight,
          points: user.total_points,
          timestamp: new Date().toISOString(),
          action: 'send_reward_notification'
        });
      }
    });
    
    // 4. Check for cleaning schedule
    const { data: cleaningRecords } = await supabase
      .from('cleaning_records')
      .select('device_no, cleaned_at, status')
      .eq('status', 'PENDING')
      .order('cleaned_at', { ascending: true });
    
    cleaningRecords?.forEach(record => {
      const cleanedDate = new Date(record.cleaned_at);
      const daysSinceCleaning = Math.floor((new Date() - cleanedDate) / (1000 * 60 * 60 * 24));
      
      if (daysSinceCleaning > 3) {
        alerts.push({
          type: 'warning',
          title: '🧹 Pending Cleaning',
          message: `Machine ${record.device_no} has pending cleaning for ${daysSinceCleaning} days`,
          device: record.device_no,
          days: daysSinceCleaning,
          timestamp: new Date().toISOString(),
          action: 'schedule_cleaning'
        });
      }
    });
    
    return res.status(200).json({
      alerts,
      total: alerts.length,
      urgent: alerts.filter(a => a.type === 'urgent').length,
      warnings: alerts.filter(a => a.type === 'warning').length,
      info: alerts.filter(a => a.type === 'info').length
    });
  } catch (error) {
    console.error('Check alerts error:', error);
    return res.status(500).json({ error: 'Failed to check alerts' });
  }
}

async function sendNotification(supabase, req, res) {
  try {
    const { userId, type, title, message, action } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }
    
    // Store notification in database
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId || null,
        title,
        message,
        type: type || 'info',
        action: action || null,
        is_read: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // In production, this would also:
    // 1. Send email if user has email
    // 2. Send SMS if user has phone
    // 3. Send push notification if mobile app installed
    // 4. Send to Telegram bot for admin alerts
    
    return res.status(200).json({
      success: true,
      notification: data,
      message: 'Notification sent successfully'
    });
  } catch (error) {
    console.error('Send notification error:', error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}

async function getNotifications(supabase, req, res) {
  try {
    const { userId, limit = 50, unreadOnly = false } = req.query;
    
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    
    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }
    
    if (unreadOnly === 'true') {
      query = query.eq('is_read', false);
    }
    
    const { data: notifications, error } = await query;
    
    if (error) throw error;
    
    return res.status(200).json({
      notifications,
      total: notifications.length,
      unread: notifications.filter(n => !n.is_read).length
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ error: 'Failed to get notifications' });
  }
}

async function markNotificationRead(supabase, req, res) {
  try {
    const { notificationId } = req.body;
    
    if (!notificationId) {
      return res.status(400).json({ error: 'Notification ID is required' });
    }
    
    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .select()
      .single();
    
    if (error) throw error;
    
    return res.status(200).json({
      success: true,
      notification: data,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
}

// Helper function to send Telegram alert (for admin notifications)
async function sendTelegramAlert(message) {
  // This would be implemented with Telegram Bot API
  // For now, just log it
  console.log('📱 Telegram Alert:', message);
  
  // Example implementation:
  // const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  // const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  
  // if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
  //   await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       chat_id: TELEGRAM_CHAT_ID,
  //       text: message,
  //       parse_mode: 'HTML'
  //     })
  //   });
  // }
}

// Helper function to send SMS (for urgent alerts)
async function sendSMS(phoneNumber, message) {
  // This would be implemented with SMS gateway API
  // For now, just log it
  console.log('📞 SMS Alert to', phoneNumber, ':', message);
  
  // Example implementation with Twilio:
  // const accountSid = process.env.TWILIO_ACCOUNT_SID;
  // const authToken = process.env.TWILIO_AUTH_TOKEN;
  // const client = require('twilio')(accountSid, authToken);
  
  // await client.messages.create({
  //   body: message,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   to: phoneNumber
  // });
}

// Helper function to send email
async function sendEmail(email, subject, message) {
  // This would be implemented with email service
  // For now, just log it
  console.log('📧 Email to', email, ':', subject, '-', message);
  
  // Example implementation with SendGrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  
  // await sgMail.send({
  //   to: email,
  //   from: process.env.EMAIL_FROM,
  //   subject: subject,
  //   text: message,
  //   html: `<p>${message}</p>`
  // });
}