// ===== Recycling Rates API =====
// Returns current rates for all waste types
// Rates can be configured via ENV variables

export { RECYCLING_RATES as default } from './vendor-live.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { RECYCLING_RATES } = await import('./vendor-live.js');
  
  return res.status(200).json({
    success: true,
    rates: RECYCLING_RATES,
    currency: 'MYR',
    unit: 'per kg',
    note: 'Points = Weight × Rate. Adjust via ENV variables.',
    updated: new Date().toISOString()
  });
}
