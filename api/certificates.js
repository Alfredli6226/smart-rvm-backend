// ===== CO2 & Tree Certificate API — Live Vendor Data =====
import { fetchAllIntegralRecords, fetchVendorDevices, integralToWeight, classifyWasteType } from './vendor-live.js';

// ESG Impact Factors
const IMPACT = {
  CO2_PER_KG_PLASTIC: 1.5,
  CO2_PER_KG_ALUMINUM: 9.0,
  CO2_PER_KG_PAPER: 1.0,
  CO2_PER_KG_UCO: 2.5,
  CO2_PER_TREE_YEAR: 20,
  DEFAULT_MIX: { plastic: 0.60, aluminum: 0.20, paper: 0.10, uco: 0.10 }
};

function calcImpact(weight) {
  const { plastic, aluminum, paper, uco } = IMPACT.DEFAULT_MIX;
  const co2 = {
    plastic: weight * plastic * IMPACT.CO2_PER_KG_PLASTIC,
    aluminum: weight * aluminum * IMPACT.CO2_PER_KG_ALUMINUM,
    paper: weight * paper * IMPACT.CO2_PER_KG_PAPER,
    uco: weight * uco * IMPACT.CO2_PER_KG_UCO,
    total: 0
  };
  co2.total = co2.plastic + co2.aluminum + co2.paper + co2.uco;
  return {
    totalCo2: parseFloat(co2.total.toFixed(1)),
    treesEquivalent: Math.round(co2.total / IMPACT.CO2_PER_TREE_YEAR),
    breakdown: { plastic: +co2.plastic.toFixed(1), aluminum: +co2.aluminum.toFixed(1), paper: +co2.paper.toFixed(1), uco: +co2.uco.toFixed(1) }
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || 'overview';

  try {
    const [records, devices] = await Promise.all([
      fetchAllIntegralRecords(70),
      fetchVendorDevices()
    ]);

    const totalWeight = records.reduce((s, r) => s + integralToWeight(r.integralNum), 0);
    const totalPoints = records.reduce((s, r) => s + parseFloat(r.integralNum || 0), 0);
    const userCount = new Set(records.map(r => r.userId)).size;

    // Today's stats
    const today = new Date().toISOString().slice(0, 10);
    const todayRecords = records.filter(r => (r.recordedTime || r.createTime || '').startsWith(today));
    const todayWeight = todayRecords.reduce((s, r) => s + integralToWeight(r.integralNum), 0);

    // CO2 / Tree calculations
    const overall = calcImpact(totalWeight);
    const todayImpact = calcImpact(todayWeight);

    if (action === 'overview') {
      return res.status(200).json({
        success: true,
        data: {
          totalWeight: +totalWeight.toFixed(1),
          totalPoints: +totalPoints.toFixed(1),
          totalUsers: userCount,
          totalSubmissions: records.length,
          todayWeight: +todayWeight.toFixed(1),
          todaySubmissions: todayRecords.length,
          carbonSaved: overall.totalCo2,
          treesEquivalent: overall.treesEquivalent,
          todayCarbonSaved: todayImpact.totalCo2,
          todayTreesEquivalent: todayImpact.treesEquivalent,
          machineCount: devices.length,
          onlineCount: devices.filter(d => d.is_online).length
        },
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'certificate') {
      const userId = req.query.user_id || req.query.userId || '';
      const userName = req.query.name || 'Recycling Hero';

      if (!userId) {
        // Generate platform-wide certificate
        return res.status(200).json({
          success: true,
          certificate: {
            type: 'PLATFORM_IMPACT',
            title: '🌍 Environmental Impact Certificate',
            issuedTo: 'MyGreenPlus Community',
            totalWeightRecycled: +totalWeight.toFixed(1),
            totalSubmissions: records.length,
            activeUsers: userCount,
            carbonSaved: overall.totalCo2,
            treesEquivalent: overall.treesEquivalent,
            co2Breakdown: overall.breakdown,
            period: { from: records.length > 0 ? records[records.length - 1].recordedTime : 'N/A', to: records[0]?.recordedTime || 'N/A' },
            issuedAt: new Date().toISOString(),
            certificateId: `MGP-CERT-${Date.now().toString(36).toUpperCase()}`,
            verified: true
          }
        });
      }

      // Individual user certificate
      const userRecords = records.filter(r => r.userId === userId || r.userId?.toString() === userId);
      const userWeight = userRecords.reduce((s, r) => s + integralToWeight(r.integralNum), 0);
      const userImpact = calcImpact(userWeight);

      return res.status(200).json({
        success: true,
        certificate: {
          type: 'USER_IMPACT',
          title: '♻️ Recycling Impact Certificate',
          issuedTo: userName,
          userId: userId,
          totalWeightRecycled: +userWeight.toFixed(1),
          totalSubmissions: userRecords.length,
          carbonSaved: userImpact.totalCo2,
          treesEquivalent: userImpact.treesEquivalent,
          co2Breakdown: userImpact.breakdown,
          issuedAt: new Date().toISOString(),
          certificateId: `MGP-CERT-${userId}-${Date.now().toString(36).toUpperCase()}`,
          verified: true
        }
      });
    }

    // Detailed breakdown by material
    if (action === 'breakdown') {
      const breakdown = records.reduce((acc, r) => {
        const type = classifyWasteType(r);
        const wt = integralToWeight(r.integralNum);
        if (!acc[type]) acc[type] = { weight: 0, count: 0, submissions: 0 };
        acc[type].weight += wt;
        acc[type].count++;
        acc[type].submissions++;
        return acc;
      }, {});

      Object.keys(breakdown).forEach(k => {
        breakdown[k].weight = +breakdown[k].weight.toFixed(1);
        const impact = calcImpact(breakdown[k].weight);
        breakdown[k].carbonSaved = impact.totalCo2;
        breakdown[k].treesEquivalent = impact.treesEquivalent;
      });

      return res.status(200).json({
        success: true,
        data: {
          breakdown,
          total: { weight: +totalWeight.toFixed(1), carbonSaved: overall.totalCo2, treesEquivalent: overall.treesEquivalent }
        }
      });
    }

    return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
