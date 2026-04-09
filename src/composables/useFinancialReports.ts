import { ref, computed } from 'vue';
import { supabase } from '../services/supabase';

export interface FinancialSummary {
  total_revenue: number;
  total_expenses: number;
  maintenance_costs: number;
  net_profit: number;
}

export interface MonthlyBreakdown {
  month: string;
  total_revenue: number;
  total_expenses: number;
  maintenance_costs: number;
  net_profit: number;
}

export interface RevenueByMonth {
  period: string;
  revenue: number;
}

export function useFinancialReports() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  const summary = ref<FinancialSummary | null>(null);
  const monthlyBreakdown = ref<MonthlyBreakdown[]>([]);
  const revenueByMonth = ref<RevenueByMonth[]>([]);
  
  const filters = ref({
    startDate: '',
    endDate: '',
    period: 'month' as 'month' | 'year' | 'all'
  });

  const currentPage = ref(1);
  const itemsPerPage = ref(12);
  const totalRecords = ref(0);

  const paginatedMonthly = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    return monthlyBreakdown.value.slice(start, start + itemsPerPage.value);
  });

  const totalPages = computed(() => Math.ceil(monthlyBreakdown.value.length / itemsPerPage.value));

  const fetchFinancialReports = async (page = 1) => {
    console.log('[FinancialReports] Starting fetch, page:', page);
    loading.value = true;
    error.value = null;
    currentPage.value = page;
    
    try {
      console.log('[FinancialReports] Fetching revenue data...');
      
      // 1. Calculate Total Collection Revenue
      let revenueQuery = supabase
        .from('submission_reviews')
        .select('calculated_value, submitted_at');

      if (filters.value.startDate) {
        revenueQuery = revenueQuery.gte('submitted_at', filters.value.startDate);
      }
      if (filters.value.endDate) {
        revenueQuery = revenueQuery.lte('submitted_at', filters.value.endDate + 'T23:59:59');
      }

      console.log('[FinancialReports] Executing revenue query...');
      const { data: revenueData, error: revenueError } = await revenueQuery;
      console.log('[FinancialReports] Revenue result:', revenueData?.length, 'records, error:', revenueError);

      if (revenueError) {
        console.error('[FinancialReports] Revenue error:', revenueError);
        throw revenueError;
      }

      const totalCollectionRevenue = (revenueData || []).reduce((sum, r) => sum + (Number(r.calculated_value) || 0), 0);
      console.log('[FinancialReports] Total revenue:', totalCollectionRevenue);

      // 2. Calculate Total Maintenance Costs
      let maintenanceQuery = supabase
        .from('cleaning_records')
        .select('bag_weight_collected, cleaned_at');

      if (filters.value.startDate) {
        maintenanceQuery = maintenanceQuery.gte('cleaned_at', filters.value.startDate);
      }
      if (filters.value.endDate) {
        maintenanceQuery = maintenanceQuery.lte('cleaned_at', filters.value.endDate + 'T23:59:59');
      }

      const { data: maintenanceData, error: maintenanceError } = await maintenanceQuery;

      if (maintenanceError) throw maintenanceError;

      const totalMaintenanceCosts = (maintenanceData || []).reduce((sum, m) => sum + (Number(m.bag_weight_collected) || 0), 0);

      // 3. Calculate Total Expenses
      let expensesQuery = supabase
        .from('withdrawals')
        .select('amount, created_at');

      if (filters.value.startDate) {
        expensesQuery = expensesQuery.gte('created_at', filters.value.startDate);
      }
      if (filters.value.endDate) {
        expensesQuery = expensesQuery.lte('created_at', filters.value.endDate + 'T23:59:59');
      }

      const { data: expensesData, error: expensesError } = await expensesQuery;

      if (expensesError) throw expensesError;

      const totalExpenses = (expensesData || []).reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

      // 4. Calculate Net Profit
      const netProfit = totalCollectionRevenue - totalExpenses - totalMaintenanceCosts;

      // 5. Calculate Revenue by Month
      const monthlyRevenue: Record<string, { month: string; revenue: number; expenses: number; maintenance: number }> = {};

      (revenueData || []).forEach(r => {
        const date = new Date(r.submitted_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyRevenue[monthKey]) {
          monthlyRevenue[monthKey] = { month: monthKey, revenue: 0, expenses: 0, maintenance: 0 };
        }
        monthlyRevenue[monthKey].revenue += Number(r.calculated_value) || 0;
      });

      (expensesData || []).forEach(w => {
        const date = new Date(w.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyRevenue[monthKey]) {
          monthlyRevenue[monthKey] = { month: monthKey, revenue: 0, expenses: 0, maintenance: 0 };
        }
        monthlyRevenue[monthKey].expenses += Number(w.amount) || 0;
      });

      (maintenanceData || []).forEach(m => {
        const date = new Date(m.cleaned_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyRevenue[monthKey]) {
          monthlyRevenue[monthKey] = { month: monthKey, revenue: 0, expenses: 0, maintenance: 0 };
        }
        monthlyRevenue[monthKey].maintenance += Number(m.bag_weight_collected) || 0;
      });

      monthlyBreakdown.value = Object.values(monthlyRevenue).map(m => ({
        month: m.month,
        total_revenue: Math.round(m.revenue * 100) / 100,
        total_expenses: Math.round(m.expenses * 100) / 100,
        maintenance_costs: Math.round(m.maintenance * 100) / 100,
        net_profit: Math.round((m.revenue - m.expenses - m.maintenance) * 100) / 100
      })).sort((a, b) => a.month.localeCompare(b.month));

      summary.value = {
        total_revenue: Math.round(totalCollectionRevenue * 100) / 100,
        total_expenses: Math.round(totalExpenses * 100) / 100,
        maintenance_costs: Math.round(totalMaintenanceCosts * 100) / 100,
        net_profit: Math.round(netProfit * 100) / 100
      };

      revenueByMonth.value = monthlyBreakdown.value.map(m => ({
        period: m.month,
        revenue: m.total_revenue
      }));

      totalRecords.value = monthlyBreakdown.value.length;
    } catch (err: any) {
      console.error('[FinancialReports] Error:', err);
      error.value = err.message || err.error_description || 'Failed to fetch financial reports';
    } finally {
      loading.value = false;
      console.log('[FinancialReports] Loading complete, summary:', summary.value);
    }
  };

  const fetchAll = async () => {
    await fetchFinancialReports(1);
  };

  const clearFilters = () => {
    filters.value = { startDate: '', endDate: '', period: 'month' };
    fetchAll();
  };

  const applyFilters = () => {
    fetchAll();
  };

  const exportToCsv = () => {
    let csvContent = 'Financial Report Export\n';
    csvContent += `Generated: ${new Date().toISOString()}\n\n`;
    
    if (summary.value) {
      csvContent += 'Summary\n';
      csvContent += `Metric,Amount\n`;
      csvContent += `Total Revenue,${summary.value.total_revenue.toFixed(2)}\n`;
      csvContent += `Total Expenses,${summary.value.total_expenses.toFixed(2)}\n`;
      csvContent += `Maintenance Costs,${summary.value.maintenance_costs.toFixed(2)}\n`;
      csvContent += `Net Profit,${summary.value.net_profit.toFixed(2)}\n\n`;
    }
    
    csvContent += 'Monthly Breakdown\n';
    csvContent += 'Month,Revenue,Expenses,Maintenance,Net Profit\n';
    monthlyBreakdown.value.forEach(m => {
      csvContent += `${m.month},${m.total_revenue.toFixed(2)},${m.total_expenses.toFixed(2)},${m.maintenance_costs.toFixed(2)},${m.net_profit.toFixed(2)}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `financial-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return {
    loading,
    error,
    summary,
    monthlyBreakdown,
    revenueByMonth,
    filters,
    currentPage,
    itemsPerPage,
    totalRecords,
    paginatedMonthly,
    totalPages,
    fetchFinancialReports,
    fetchAll,
    clearFilters,
    applyFilters,
    exportToCsv
  };
}