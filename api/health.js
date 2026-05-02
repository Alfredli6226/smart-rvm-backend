export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.query.action === 'rates') {
    const { RECYCLING_RATES } = await import('./vendor-live.js');
    return res.status(200).json({
      success: true,
      rates: RECYCLING_RATES,
      currency: 'MYR',
      unit: 'per kg',
      note: 'Points = Weight × Rate. Set via ENV vars: RATE_DEFAULT, RATE_UCO, etc.',
      updated: new Date().toISOString()
    });
  }
  
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: ['users', 'analytics', 'notifications', 'reports', 'data-sync']
  });
};
