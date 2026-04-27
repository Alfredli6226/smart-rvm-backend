/**
 * User Statistics API
 * 
 * Provides statistics and analytics for RVM users:
 * 1. User growth trends
 * 2. Recycling activity analysis
 * 3. Points distribution
 * 4. Top recyclers ranking
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action } = req.query;

    switch (action) {
      case 'growth':
        return await getUserGrowthStats(supabase, req, res);
      case 'top-recyclers':
        return await getTopRecyclers(supabase, req, res);
      case 'activity':
        return await getUserActivityStats(supabase, req, res);
      case 'summary':
        return await getSummaryStats(supabase, req, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('User stats error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

/**
 * Get user growth statistics
 */
async function getUserGrowthStats(supabase, req, res) {
  try {
    // Get users grouped by registration date
    const { data: users, error } = await supabase
      .from('users')
      .select('created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by date
    const growthByDate = {};
    users.forEach(user => {
      if (user.created_at) {
        const date = user.created_at.split('T')[0]; // YYYY-MM-DD
        growthByDate[date] = (growthByDate[date] || 0) + 1;
      }
    });

    // Convert to array and calculate cumulative
    const dates = Object.keys(growthByDate).sort();
    const growthData = [];
    let cumulative = 0;

    dates.forEach(date => {
      const daily = growthByDate[date];
      cumulative += daily;
      growthData.push({
        date,
        dailyNewUsers: daily,
        cumulativeUsers: cumulative
      });
    });

    // Calculate growth rates
    const totalUsers = users.length;
    const last30Days = growthData.slice(-30);
    const monthlyGrowth = last30Days.length > 0 
      ? last30Days.reduce((sum, day) => sum + day.dailyNewUsers, 0)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        growthData,
        monthlyGrowth,
        growthRate: totalUsers > 0 ? (monthlyGrowth / totalUsers * 100).toFixed(1) : 0,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Failed to get growth stats:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}

/**
 * Get top recyclers ranking
 */
async function getTopRecyclers(supabase, req, res) {
  const limit = parseInt(req.query.limit) || 10;
  
  try {
    // Get users with their recycling data
    const { data: recyclingData, error } = await supabase
      .from('recycling_submissions')
      .select(`
        user_id,
        weight_kg,
        points_awarded,
        created_at,
        users (nick_name, phone, avatar)
      `)
      .order('created_at', { ascending: false })
      .limit(1000); // Get recent data

    if (error) throw error;

    // Aggregate by user
    const userStats = {};
    recyclingData.forEach(record => {
      const userId = record.user_id;
      if (!userStats[userId]) {
        userStats[userId] = {
          userId,
          nickName: record.users?.nick_name || 'Unknown',
          phone: record.users?.phone || '',
          avatar: record.users?.avatar || '',
          totalWeight: 0,
          totalPoints: 0,
          submissionCount: 0,
          lastActivity: record.created_at
        };
      }

      userStats[userId].totalWeight += parseFloat(record.weight_kg) || 0;
      userStats[userId].totalPoints += parseFloat(record.points_awarded) || 0;
      userStats[userId].submissionCount++;
      
      if (new Date(record.created_at) > new Date(userStats[userId].lastActivity)) {
        userStats[userId].lastActivity = record.created_at;
      }
    });

    // Convert to array and sort by points
    const topRecyclers = Object.values(userStats)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit)
      .map((user, index) => ({
        rank: index + 1,
        ...user,
        totalWeight: Math.round(user.totalWeight * 100) / 100,
        totalPoints: Math.round(user.totalPoints * 100) / 100
      }));

    return res.status(200).json({
      success: true,
      data: {
        topRecyclers,
        totalRecyclers: Object.keys(userStats).length,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Failed to get top recyclers:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}

/**
 * Get user activity statistics
 */
async function getUserActivityStats(supabase, req, res) {
  const period = req.query.period || '7d'; // 7d, 30d, 90d
  
  try {
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // Get activity data
    const { data: activityData, error } = await supabase
      .from('recycling_submissions')
      .select('created_at, user_id, weight_kg')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by date
    const activityByDate = {};
    const uniqueUsersByDate = {};
    
    activityData.forEach(record => {
      const date = record.created_at.split('T')[0];
      
      // Count submissions
      activityByDate[date] = (activityByDate[date] || 0) + 1;
      
      // Count unique users
      if (!uniqueUsersByDate[date]) {
        uniqueUsersByDate[date] = new Set();
      }
      uniqueUsersByDate[date].add(record.user_id);
    });

    // Convert to arrays
    const dates = Object.keys(activityByDate).sort();
    const activityStats = dates.map(date => ({
      date,
      submissions: activityByDate[date],
      uniqueUsers: uniqueUsersByDate[date]?.size || 0,
      avgSubmissionsPerUser: activityByDate[date] / (uniqueUsersByDate[date]?.size || 1)
    }));

    // Calculate totals
    const totalSubmissions = activityData.length;
    const totalUniqueUsers = new Set(activityData.map(r => r.user_id)).size;
    const totalWeight = activityData.reduce((sum, r) => sum + (parseFloat(r.weight_kg) || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        activityStats,
        totals: {
          submissions: totalSubmissions,
          uniqueUsers: totalUniqueUsers,
          totalWeight: Math.round(totalWeight * 100) / 100,
          avgSubmissionsPerUser: totalSubmissions / totalUniqueUsers || 0
        },
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Failed to get activity stats:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}

/**
 * Get summary statistics
 */
async function getSummaryStats(supabase, req, res) {
  try {
    // Get all stats in parallel
    const [
      usersCount,
      recyclingCount,
      recentActivity,
      topRecyclers
    ] = await Promise.all([
      // Total users
      supabase.from('users').select('*', { count: 'exact', head: true }),
      
      // Total recycling submissions
      supabase.from('recycling_submissions').select('*', { count: 'exact', head: true }),
      
      // Recent activity (last 24h)
      supabase.from('recycling_submissions')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      
      // Top 5 recyclers
      supabase.from('recycling_submissions')
        .select('user_id, weight_kg, points_awarded')
        .order('points_awarded', { ascending: false })
        .limit(5)
    ]);

    // Calculate metrics
    const totalUsers = usersCount.count || 0;
    const totalSubmissions = recyclingCount.count || 0;
    const recentSubmissions = recentActivity.data?.length || 0;
    
    // Calculate total weight and points
    let totalWeight = 0;
    let totalPoints = 0;
    
    if (recentActivity.data) {
      recentActivity.data.forEach(record => {
        totalWeight += parseFloat(record.weight_kg) || 0;
        totalPoints += parseFloat(record.points_awarded) || 0;
      });
    }

    // Calculate growth (placeholder - would need historical data)
    const userGrowth = totalUsers > 0 ? 12.5 : 0; // Example growth rate
    const activityGrowth = totalSubmissions > 0 ? 8.3 : 0;

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalSubmissions,
          recentActivity: recentSubmissions,
          totalWeight: Math.round(totalWeight * 100) / 100,
          totalPoints: Math.round(totalPoints * 100) / 100
        },
        growth: {
          users: `${userGrowth}%`,
          activity: `${activityGrowth}%`
        },
        engagement: {
          avgSubmissionsPerUser: totalUsers > 0 ? (totalSubmissions / totalUsers).toFixed(1) : 0,
          activeUsersRate: totalUsers > 0 ? ((recentSubmissions > 0 ? 1 : 0) * 100).toFixed(1) : 0
        },
        topRecyclers: topRecyclers.data?.slice(0, 3) || [],
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Failed to get summary stats:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}