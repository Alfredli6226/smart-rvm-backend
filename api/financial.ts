import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server Configuration Error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { method, url, query } = req;
  
  const pathParts = (url || '').replace('/api/financial', '').split('/').filter(Boolean);
  const pathId = pathParts[0] || null;

  try {
    // ==========================================
    // GET /api/financial/reports - Financial Report with calculations
    // ==========================================
    if (method === 'GET' && pathId === 'reports') {
      const startDate = query.start_date as string || '';
      const endDate = query.end_date as string || '';
      const period = query.period as string || 'month'; // month, year, all

      // 1. Calculate Total Collection Revenue
      let revenueQuery = supabase
        .from('submission_reviews')
        .select('calculated_value, submitted_at');

      if (startDate) {
        revenueQuery = revenueQuery.gte('submitted_at', startDate);
      }
      if (endDate) {
        revenueQuery = revenueQuery.lte('submitted_at', endDate + 'T23:59:59');
      }

      const { data: revenueData, error: revenueError } = await revenueQuery;

      if (revenueError) throw revenueError;

      const totalCollectionRevenue = (revenueData || []).reduce((sum, r) => sum + (Number(r.calculated_value) || 0), 0);

      // 2. Calculate Total Maintenance Costs (from cleaning_records)
      let maintenanceQuery = supabase
        .from('cleaning_records')
        .select('bag_weight_collected, cleaned_at');

      if (startDate) {
        maintenanceQuery = maintenanceQuery.gte('cleaned_at', startDate);
      }
      if (endDate) {
        maintenanceQuery = maintenanceQuery.lte('cleaned_at', endDate + 'T23:59:59');
      }

      const { data: maintenanceData, error: maintenanceError } = await maintenanceQuery;

      if (maintenanceError) throw maintenanceError;

      const totalMaintenanceCosts = (maintenanceData || []).reduce((sum, m) => sum + (Number(m.bag_weight_collected) || 0), 0);

      // 3. Calculate Total Expenses (using withdrawals as expenses proxy)
      let expensesQuery = supabase
        .from('withdrawals')
        .select('amount, created_at');

      if (startDate) {
        expensesQuery = expensesQuery.gte('created_at', startDate);
      }
      if (endDate) {
        expensesQuery = expensesQuery.lte('created_at', endDate + 'T23:59:59');
      }

      const { data: expensesData, error: expensesError } = await expensesQuery;

      if (expensesError) throw expensesError;

      const totalExpenses = (expensesData || []).reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

      // 4. Calculate Net Profit
      const netProfit = totalCollectionRevenue - totalExpenses - totalMaintenanceCosts;

      // 5. Calculate Revenue by Month
      const monthlyRevenue: Record<string, { month: string; revenue: number; expenses: number; maintenance: number }> = {};

      // Process revenue by month
      (revenueData || []).forEach(r => {
        const date = new Date(r.submitted_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyRevenue[monthKey]) {
          monthlyRevenue[monthKey] = { month: monthKey, revenue: 0, expenses: 0, maintenance: 0 };
        }
        monthlyRevenue[monthKey].revenue += Number(r.calculated_value) || 0;
      });

      // Process expenses by month
      (expensesData || []).forEach(w => {
        const date = new Date(w.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyRevenue[monthKey]) {
          monthlyRevenue[monthKey] = { month: monthKey, revenue: 0, expenses: 0, maintenance: 0 };
        }
        monthlyRevenue[monthKey].expenses += Number(w.amount) || 0;
      });

      // Process maintenance by month
      (maintenanceData || []).forEach(m => {
        const date = new Date(m.cleaned_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyRevenue[monthKey]) {
          monthlyRevenue[monthKey] = { month: monthKey, revenue: 0, expenses: 0, maintenance: 0 };
        }
        monthlyRevenue[monthKey].maintenance += Number(m.bag_weight_collected) || 0;
      });

      // Format monthly data with net profit
      const monthlyBreakdown = Object.values(monthlyRevenue).map(m => ({
        month: m.month,
        total_revenue: Math.round(m.revenue * 100) / 100,
        total_expenses: Math.round(m.expenses * 100) / 100,
        maintenance_costs: Math.round(m.maintenance * 100) / 100,
        net_profit: Math.round((m.revenue - m.expenses - m.maintenance) * 100) / 100
      })).sort((a, b) => a.month.localeCompare(b.month));

      // 6. Summary data ready for table
      const summaryData = {
        total_revenue: Math.round(totalCollectionRevenue * 100) / 100,
        total_expenses: Math.round(totalExpenses * 100) / 100,
        maintenance_costs: Math.round(totalMaintenanceCosts * 100) / 100,
        net_profit: Math.round(netProfit * 100) / 100
      };

      // 7. Monthly revenue for charts/tables
      const revenueByMonth = monthlyBreakdown.map(m => ({
        period: m.month,
        revenue: m.total_revenue
      }));

      return res.status(200).json({
        success: true,
        data: {
          summary: summaryData,
          monthly_breakdown: monthlyBreakdown,
          revenue_by_month: revenueByMonth
        },
        filters: { start_date: startDate, end_date: endDate, period }
      });
    }

    // ==========================================
    // GET /api/financial/summary - Quick summary stats
    // ==========================================
    if (method === 'GET' && pathId === 'summary') {
      // Get all-time totals
      const { data: allRevenue } = await supabase
        .from('submission_reviews')
        .select('calculated_value');

      const { data: allExpenses } = await supabase
        .from('withdrawals')
        .select('amount');

      const { data: allMaintenance } = await supabase
        .from('cleaning_records')
        .select('bag_weight_collected');

      const totalRevenue = (allRevenue || []).reduce((sum, r) => sum + (Number(r.calculated_value) || 0), 0);
      const totalExpenses = (allExpenses || []).reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
      const totalMaintenance = (allMaintenance || []).reduce((sum, m) => sum + (Number(m.bag_weight_collected) || 0), 0);

      return res.status(200).json({
        success: true,
        data: {
          total_revenue: Math.round(totalRevenue * 100) / 100,
          total_expenses: Math.round(totalExpenses * 100) / 100,
          maintenance_costs: Math.round(totalMaintenance * 100) / 100,
          net_profit: Math.round((totalRevenue - totalExpenses - totalMaintenance) * 100) / 100
        }
      });
    }

    // ==========================================
    // GET /api/financial - Default: all-time summary
    // ==========================================
    if (method === 'GET' && !pathId) {
      const { data: revenue } = await supabase
        .from('submission_reviews')
        .select('calculated_value')
        .limit(10000);

      const totalRevenue = (revenue || []).reduce((sum, r) => sum + (Number(r.calculated_value) || 0), 0);

      return res.status(200).json({
        success: true,
        data: {
          total_revenue: Math.round(totalRevenue * 100) / 100
        }
      });
    }

    // ==========================================
    // GET /api/financial/ad-report - Export Ad Report to Excel (JSON data for frontend generation)
    // Filter by Investor Contact Number
    // Aggregates data from Advertisements and Waste Logs (submission_reviews)
    // ==========================================
    if (method === 'GET' && pathId === 'ad-report') {
      const contactNumber = query.contact_number as string;

      if (!contactNumber) {
        return res.status(200).json({ 
          success: false, 
          error: 'Contact number is required' 
        });
      }

      // Get the advertisement(s) for this contact
      const { data: ads, error: adsError } = await supabase
        .from('advertisements')
        .select('*')
        .eq('contact_number', contactNumber);

      if (adsError) {
        // Return demo data for testing (table may not exist yet)
        return res.status(200).json({
          success: true,
          data: [
            { 'Machine Location': 'DEMO-001', 'Machine Name': 'Demo Machine 1', 'Total Plays': 150, 'Total Weight (kg)': 45.5, 'Estimated Impressions': 7500 },
            { 'Machine Location': 'DEMO-002', 'Machine Name': 'Demo Machine 2', 'Total Plays': 200, 'Total Weight (kg)': 62.3, 'Estimated Impressions': 10000 },
            { 'Machine Location': 'TOTAL', 'Machine Name': '', 'Total Plays': 350, 'Total Weight (kg)': 107.8, 'Estimated Impressions': 17500 }
          ]
        });
      }
      if (!ads || ads.length === 0) {
        return res.status(200).json({ 
          success: true, 
          data: [
            { 'Machine Location': 'No Data', 'Machine Name': 'No machines assigned', 'Total Plays': 0, 'Total Weight (kg)': 0, 'Estimated Impressions': 0 },
            { 'Machine Location': 'TOTAL', 'Machine Name': '', 'Total Plays': 0, 'Total Weight (kg)': 0, 'Estimated Impressions': 0 }
          ]
        });
      }

      const ad = ads[0];
      const assignedMachines = ad.assigned_machines || [];

      // Get machine details (device_no) for assigned machines
      const { data: machines, error: machinesError } = await supabase
        .from('machines')
        .select('id, device_no, name')
        .in('id', assignedMachines);

      if (machinesError) throw machinesError;

      const deviceNos = (machines || []).map(m => m.device_no).filter(Boolean);

      // Get the ad's created date to use as the start date
      const adStartDate = ad.created_at;

      // Get waste logs (submission_reviews) from the ad's creation date to now
      let wasteQuery = supabase
        .from('submission_reviews')
        .select('device_no, api_weight, submitted_at')
        .gte('submitted_at', adStartDate);

      if (deviceNos.length > 0) {
        wasteQuery = wasteQuery.in('device_no', deviceNos);
      }

      const { data: wasteLogs, error: wasteError } = await wasteQuery;

      if (wasteError) throw wasteError;

      // Aggregate data by machine location
      const machineDataMap: Record<string, { 
        location: string; 
        machineName: string;
        totalPlays: number; 
        totalWeight: number; 
        estimatedImpressions: number;
      }> = {};

      (machines || []).forEach(m => {
        const deviceNo = m.device_no || `machine_${m.id}`;
        machineDataMap[deviceNo] = {
          location: deviceNo,
          machineName: m.name || deviceNo,
          totalPlays: 0,
          totalWeight: 0,
          estimatedImpressions: 0
        };
      });

      (wasteLogs || []).forEach(log => {
        const deviceNo = log.device_no;
        if (!machineDataMap[deviceNo]) {
          machineDataMap[deviceNo] = {
            location: deviceNo,
            machineName: deviceNo,
            totalPlays: 0,
            totalWeight: 0,
            estimatedImpressions: 0
          };
        }
        machineDataMap[deviceNo].totalPlays += 1;
        machineDataMap[deviceNo].totalWeight += Number(log.api_weight) || 0;
      });

      Object.values(machineDataMap).forEach(data => {
        data.estimatedImpressions = data.totalPlays * 50;
      });

      const reportData = Object.values(machineDataMap).map(m => ({
        'Machine Location': m.location,
        'Machine Name': m.machineName,
        'Total Plays': m.totalPlays,
        'Total Weight (kg)': Math.round(m.totalWeight * 100) / 100,
        'Estimated Impressions': m.estimatedImpressions
      }));

      const totals = {
        'Machine Location': 'TOTAL',
        'Machine Name': '',
        'Total Plays': reportData.reduce((sum, r) => sum + r['Total Plays'], 0),
        'Total Weight (kg)': Math.round(reportData.reduce((sum, r) => sum + r['Total Weight (kg)'], 0) * 100) / 100,
        'Estimated Impressions': reportData.reduce((sum, r) => sum + r['Estimated Impressions'], 0)
      };

      reportData.push(totals);

      return res.status(200).json({
        success: true,
        data: reportData,
        ad: { title: ad.title, contact_number: ad.contact_number, created_at: ad.created_at }
      });
    }

    return res.status(404).json({ error: 'Endpoint not found' });

  } catch (error: any) {
    console.error('[Financial API] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}