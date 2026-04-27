) => b.engagementScore - a.engagementScore);
    
    // Group by engagement level
    const engagementLevels = {
      high: userEngagement.filter(u => u.engagementLevel === 'high'),
      medium: userEngagement.filter(u => u.engagementLevel === 'medium'),
      low: userEngagement.filter(u => u.engagementLevel === 'low'),
      inactive: userEngagement.filter(u => u.engagementLevel === 'inactive')
    };
    
    // Calculate cohort retention
    const cohorts = {};
    users?.forEach(user => {
      const registrationMonth = new Date(user.createTime).toISOString().slice(0, 7); // YYYY-MM
      if (!cohorts[registrationMonth]) {
        cohorts[registrationMonth] = { total: 0, active: 0 };
      }
      cohorts[registrationMonth].total++;
      
      // Check if active in last 30 days
      if (user.last_active_at) {
        const daysSinceActive = Math.floor(
          (new Date() - new Date(user.last_active_at)) / (24 * 60 * 60 * 1000)
        );
        if (daysSinceActive <= 30) {
          cohorts[registrationMonth].active++;
        }
      }
    });
    
    const cohortRetention = Object.entries(cohorts).map(([month, stats]) => ({
      month,
      totalUsers: stats.total,
      activeUsers: stats.active,
      retentionRate: ((stats.active / stats.total) * 100).toFixed(1)
    }));
    
    return res.status(200).json({
      totalUsers: userEngagement.length,
      engagementDistribution: {
        high: engagementLevels.high.length,
        medium: engagementLevels.medium.length,
        low: engagementLevels.low.length,
        inactive: engagementLevels.inactive.length
      },
      topEngagedUsers: userEngagement.slice(0, 20),
      cohortRetention,
      averageEngagementScore: (userEngagement.reduce((sum, u) => sum + u.engagementScore, 0) / userEngagement.length).toFixed(2),
      recommendations: generateEngagementRecommendations(engagementLevels)
    });
  } catch (error) {
    console.error('User engagement error:', error);
    return res.status(500).json({ error: 'Failed to generate user engagement report' });
  }
}

async function getRevenueProjections(supabase, req, res) {
  try {
    // Get historical data for projections
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const { data: historicalSubmissions } = await supabase
      .from('rubbish_records')
      .select('createTime, weight, waste_type')
      .gte('createTime', sixMonthsAgo.toISOString())
      .order('createTime', { ascending: true });
    
    // Group by month
    const monthlyData = {};
    historicalSubmissions?.forEach(submission => {
      const month = new Date(submission.createTime).toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = {
          weight: 0,
          submissions: 0,
          revenue: 0
        };
      }
      monthlyData[month].weight += parseFloat(submission.weight || 0);
      monthlyData[month].submissions++;
      
      // Calculate revenue based on waste type
      const wasteType = submission.waste_type;
      let pricePerKg = 0.5; // Default price
      
      if (wasteType === 'UCO') pricePerKg = 2.5; // Used Cooking Oil
      else if (wasteType === 'Plastic') pricePerKg = 0.8;
      else if (wasteType === 'Aluminum') pricePerKg = 1.2;
      else if (wasteType === 'Paper') pricePerKg = 0.3;
      
      monthlyData[month].revenue += parseFloat(submission.weight || 0) * pricePerKg;
    });
    
    // Format monthly data
    const monthlyStats = Object.entries(monthlyData)
      .map(([month, stats]) => ({
        month,
        weight: stats.weight.toFixed(2),
        submissions: stats.submissions,
        revenue: stats.revenue.toFixed(2)
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
    
    // Calculate growth rates
    const growthRates = {
      weight: calculateMonthlyGrowth(monthlyStats.map(m => parseFloat(m.weight))),
      submissions: calculateMonthlyGrowth(monthlyStats.map(m => m.submissions)),
      revenue: calculateMonthlyGrowth(monthlyStats.map(m => parseFloat(m.revenue)))
    };
    
    // Project next 3 months
    const projections = [];
    const lastMonth = monthlyStats[monthlyStats.length - 1];
    
    for (let i = 1; i <= 3; i++) {
      const projectedMonth = new Date();
      projectedMonth.setMonth(projectedMonth.getMonth() + i);
      const monthStr = projectedMonth.toISOString().slice(0, 7);
      
      const projectedWeight = parseFloat(lastMonth.weight) * Math.pow(1 + growthRates.weight, i);
      const projectedSubmissions = Math.round(lastMonth.submissions * Math.pow(1 + growthRates.submissions, i));
      const projectedRevenue = parseFloat(lastMonth.revenue) * Math.pow(1 + growthRates.revenue, i);
      
      projections.push({
        month: monthStr,
        projectedWeight: projectedWeight.toFixed(2),
        projectedSubmissions,
        projectedRevenue: projectedRevenue.toFixed(2),
        confidence: calculateConfidence(i, growthRates)
      });
    }
    
    // Calculate annual projections
    const annualProjection = {
      weight: (parseFloat(lastMonth.weight) * 12).toFixed(2),
      submissions: lastMonth.submissions * 12,
      revenue: (parseFloat(lastMonth.revenue) * 12).toFixed(2)
    };
    
    // ROI calculation (assuming machine cost, maintenance, etc.)
    const machineCost = 15000; // Per machine
    const maintenanceCost = 500; // Monthly per machine
    const totalMachines = 10;
    
    const monthlyCosts = totalMachines * maintenanceCost;
    const monthlyProfit = parseFloat(lastMonth.revenue) - monthlyCosts;
    const roiMonths = (machineCost * totalMachines) / monthlyProfit;
    
    return res.status(200).json({
      historicalData: monthlyStats,
      growthRates,
      projections,
      annualProjection,
      financialMetrics: {
        monthlyRevenue: parseFloat(lastMonth.revenue).toFixed(2),
        monthlyCosts: monthlyCosts.toFixed(2),
        monthlyProfit: monthlyProfit.toFixed(2),
        profitMargin: ((monthlyProfit / parseFloat(lastMonth.revenue)) * 100).toFixed(1),
        roiMonths: roiMonths.toFixed(1),
        breakEvenDate: new Date(Date.now() + roiMonths * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      recommendations: generateRevenueRecommendations({
        currentRevenue: parseFloat(lastMonth.revenue),
        growthRate: growthRates.revenue,
        profitMargin: monthlyProfit / parseFloat(lastMonth.revenue)
      })
    });
  } catch (error) {
    console.error('Revenue projections error:', error);
    return res.status(500).json({ error: 'Failed to generate revenue projections' });
  }
}

async function getMachineEfficiency(supabase, req, res) {
  try {
    const { data: machines } = await supabase
      .from('machines')
      .select('*');
    
    const { data: submissions } = await supabase
      .from('rubbish_records')
      .select('*');
    
    const { data: cleaningRecords } = await supabase
      .from('cleaning_records')
      .select('*');
    
    // Calculate machine efficiency
    const machineEfficiency = machines?.map(machine => {
      const machineSubmissions = submissions?.filter(s => s.deviceNo === machine.device_no) || [];
      const machineCleanings = cleaningRecords?.filter(c => c.device_no === machine.device_no) || [];
      
      // Calculate uptime (assuming machine is active if has submissions in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentSubmissions = machineSubmissions.filter(s => 
        new Date(s.createTime) >= sevenDaysAgo
      );
      
      const uptimePercentage = machine.is_active ? 
        (recentSubmissions.length > 0 ? 95 : 50) : 0;
      
      // Calculate utilization (submissions per day)
      const firstSubmission = machineSubmissions[0]?.createTime;
      const daysActive = firstSubmission ? 
        Math.floor((new Date() - new Date(firstSubmission)) / (24 * 60 * 60 * 1000)) : 1;
      
      const submissionsPerDay = daysActive > 0 ? machineSubmissions.length / daysActive : 0;
      
      // Calculate cleaning efficiency
      const lastCleaning = machineCleanings
        .filter(c => c.status === 'COMPLETED')
        .sort((a, b) => new Date(b.cleaned_at) - new Date(a.cleaned_at))[0];
      
      const daysSinceCleaning = lastCleaning ? 
        Math.floor((new Date() - new Date(lastCleaning.cleaned_at)) / (24 * 60 * 60 * 1000)) : 999;
      
      const cleaningEfficiency = daysSinceCleaning <= 3 ? 'Excellent' :
                                daysSinceCleaning <= 7 ? 'Good' :
                                daysSinceCleaning <= 14 ? 'Fair' : 'Poor';
      
      // Calculate revenue generated
      const revenue = machineSubmissions.reduce((sum, s) => {
        const weight = parseFloat(s.weight || 0);
        const wasteType = s.waste_type;
        let pricePerKg = 0.5;
        
        if (wasteType === 'UCO') pricePerKg = 2.5;
        else if (wasteType === 'Plastic') pricePerKg = 0.8;
        else if (wasteType === 'Aluminum') pricePerKg = 1.2;
        else if (wasteType === 'Paper') pricePerKg = 0.3;
        
        return sum + (weight * pricePerKg);
      }, 0);
      
      // Overall efficiency score
      const efficiencyScore = calculateEfficiencyScore({
        uptimePercentage,
        submissionsPerDay,
        cleaningEfficiency,
        revenue,
        currentWeight: parseFloat(machine.current_bag_weight || 0)
      });
      
      return {
        device: machine.device_no,
        name: machine.name,
        location: machine.address,
        status: machine.is_active ? 'Active' : 'Inactive',
        uptime: `${uptimePercentage}%`,
        submissions: machineSubmissions.length,
        submissionsPerDay: submissionsPerDay.toFixed(1),
        totalWeight: machineSubmissions.reduce((sum, s) => sum + parseFloat(s.weight || 0), 0).toFixed(2),
        revenue: revenue.toFixed(2),
        lastCleaning: lastCleaning?.cleaned_at || 'Never',
        cleaningEfficiency,
        currentWeight: machine.current_bag_weight,
        efficiencyScore: efficiencyScore.toFixed(1),
        efficiencyLevel: getEfficiencyLevel(efficiencyScore),
        recommendations: generateMachineRecommendations({
          uptimePercentage,
          submissionsPerDay,
          cleaningEfficiency,
          currentWeight: parseFloat(machine.current_bag_weight || 0)
        })
      };
    }) || [];
    
    // Sort by efficiency score
    machineEfficiency.sort((a, b) => b.efficiencyScore - a.efficiencyScore);
    
    // Calculate overall metrics
    const overallMetrics = {
      totalMachines: machineEfficiency.length,
      averageUptime: (machineEfficiency.reduce((sum, m) => sum + parseFloat(m.uptime), 0) / machineEfficiency.length).toFixed(1),
      averageSubmissionsPerDay: (machineEfficiency.reduce((sum, m) => sum + parseFloat(m.submissionsPerDay), 0) / machineEfficiency.length).toFixed(1),
      totalRevenue: machineEfficiency.reduce((sum, m) => sum + parseFloat(m.revenue), 0).toFixed(2),
      highEfficiency: machineEfficiency.filter(m => m.efficiencyLevel === 'High').length,
      mediumEfficiency: machineEfficiency.filter(m => m.efficiencyLevel === 'Medium').length,
      lowEfficiency: machineEfficiency.filter(m => m.efficiencyLevel === 'Low').length
    };
    
    return res.status(200).json({
      machines: machineEfficiency,
      overallMetrics,
      topPerformers: machineEfficiency.slice(0, 5),
      needAttention: machineEfficiency.filter(m => m.efficiencyLevel === 'Low').slice(0, 5)
    });
  } catch (error) {
    console.error('Machine efficiency error:', error);
    return res.status(500).json({ error: 'Failed to generate machine efficiency report' });
  }
}

// Helper functions
function calculateGrowth(data) {
  if (data.length < 2) return 0;
  const first = data[0];
  const last = data[data.length - 1];
  return ((last - first) / first) / (data.length - 1);
}

function calculateMonthlyGrowth(data) {
  if (data.length < 2) return 0;
  const growthRates = [];
  for (let i = 1; i < data.length; i++) {
    growthRates.push((data[i] - data[i - 1]) / data[i - 1]);
  }
  return growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
}

function calculateConfidence(monthsAhead, growthRates) {
  // Confidence decreases with time and volatility
  const baseConfidence = 0.8;
  const timeDecay = 0.1 * monthsAhead;
  const volatilityPenalty = Math.abs(growthRates.revenue) > 0.3 ? 0.2 : 0;
  return Math.max(0.3, baseConfidence - timeDecay - volatilityPenalty);
}

function calculateEngagementScore(user) {
  let score = 0;
  
  // Weight contribution (40%)
  score += Math.min(user.totalWeight / 10, 40);
  
  // Points contribution (20%)
  score += Math.min(user.totalPoints / 5, 20);
  
  // Frequency contribution (30%)
  score += Math.min((user.submissionDays / user.daysSinceRegistration) * 100, 30);
  
  // Recency contribution (10%)
  if (user.lastActive) {
    const daysSinceActive = Math.floor(
      (new Date() - new Date(user.lastActive)) / (24 * 60 * 60 * 1000)
    );
    if (daysSinceActive <= 7) score += 10;
    else if (daysSinceActive <= 30) score += 5;
  }
  
  return score;
}

function getEngagementLevel(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'inactive';
}

function calculateEfficiencyScore(metrics) {
  let score = 0;
  
  // Uptime contribution (30%)
  score += metrics.uptimePercentage * 0.3;
  
  // Utilization contribution (30%)
  score += Math.min(metrics.submissionsPerDay * 10, 30);
  
  // Cleaning contribution (20%)
  const cleaningScore = {
    'Excellent': 20,
    'Good': 15,
    'Fair': 10,
    'Poor': 5
  }[metrics.cleaningEfficiency] || 0;
  score += cleaningScore;
  
  // Weight management contribution (20%)
  const weightScore = metrics.currentWeight > 80 ? 5 :
                     metrics.currentWeight > 50 ? 15 : 20;
  score += weightScore;
  
  return score;
}

function getEfficiencyLevel(score) {
  if (score >= 80) return 'High';
  if (score >= 60) return 'Medium';
  return 'Low';
}

function generateRecommendations(metrics) {
  const recommendations = [];
  
  if (metrics.submissions < 100) {
    recommendations.push('Increase marketing efforts to attract more users');
  }
  
  if (metrics.weight / metrics.submissions < 0.5) {
    recommendations.push('Consider incentives for larger recycling amounts');
  }
  
  if (metrics.weeklyStats.some(week => week.submissions < 10)) {
    recommendations.push('Focus on increasing weekend recycling activity');
  }
  
  return recommendations;
}

function generateEngagementRecommendations(levels) {
  const recommendations = [];
  
  if (levels.high.length > 0) {
    recommendations.push(`Reward ${levels.high.length} highly engaged users with bonus points`);
  }
  
  if (levels.medium.length > levels.high.length * 2) {
    recommendations.push('Create engagement campaigns to move medium users to high engagement');
  }
  
  if (levels.inactive.length > levels.active * 0.3) {
    recommendations.push(`Re-engage ${levels.inactive.length} inactive users with special offers`);
  }
  
  return recommendations;
}

function generateRevenueRecommendations(metrics) {
  const recommendations = [];
  
  if (metrics.growthRate < 0.1) {
    recommendations.push('Implement growth strategies to increase monthly revenue growth');
  }
  
  if (metrics.profitMargin < 0.2) {
    recommendations.push('Optimize operational costs to improve profit margin');
  }
  
  if (metrics.currentRevenue < 1000) {
    recommendations.push('Focus on increasing recycling