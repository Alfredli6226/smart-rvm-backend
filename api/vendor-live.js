// Vendor API Live Data — shared utility for real-time data fetching
import crypto from 'crypto';

const MERCHANT_NO = process.env.MERCHANT_NO || process.env.VITE_MERCHANT_NO;
const API_SECRET = process.env.API_SECRET || process.env.SECRET || process.env.VITE_API_SECRET;
const VENDOR_BASE = 'https://api.autogcm.com';

function md5(s) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

function vHeaders() {
  const ts = Date.now();
  const sign = md5(`${MERCHANT_NO}${API_SECRET}${ts}`);
  return { 'merchant-no': MERCHANT_NO, timestamp: String(ts), sign };
}

async function vGet(path, params = {}) {
  const url = new URL(path, VENDOR_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), { headers: vHeaders() });
  const text = await res.text();
  try {
    return { ok: res.ok, data: JSON.parse(text) };
  } catch {
    return { ok: false, data: null, body: text };
  }
}

// Fetch ALL integral records from vendor API (paginated, in parallel)
export async function fetchAllIntegralRecords(maxPages = 70) {
  // First, get total count
  const first = await vGet('/system/integral/list', { page: 1, pageSize: 50, userType: 11 });
  if (!first.ok || !first.data) return [];
  
  const total = parseInt(first.data.total || '0');
  const firstRows = first.data.rows || [];
  if (total <= 50) return firstRows;
  
  const totalPages = Math.ceil(total / 50);
  const pagesToFetch = Math.min(totalPages, maxPages);
  
  // Fetch remaining pages in parallel
  const pagePromises = [];
  for (let p = 2; p <= pagesToFetch; p++) {
    pagePromises.push(
      vGet('/system/integral/list', { page: p, pageSize: 50, userType: 11 })
        .then(r => r.ok && r.data ? (r.data.rows || []) : [])
        .catch(() => [])
    );
  }
  
  const remainingPages = await Promise.all(pagePromises);
  return [...firstRows, ...remainingPages.flat()];
}

// Fetch just the first N pages (for quick recent data)
export async function fetchRecentIntegralRecords(pages = 3) {
  const promises = [];
  for (let p = 1; p <= pages; p++) {
    promises.push(
      vGet('/system/integral/list', { page: p, pageSize: 50, userType: 11 })
        .then(r => r.ok && r.data ? (r.data.rows || []) : [])
        .catch(() => [])
    );
  }
  const results = await Promise.all(promises);
  return results.flat();
}

// Convert integralNum to weight (Points = Weight × 0.2, so Weight = integralNum / 0.2)
export function integralToWeight(integralNum) {
  return (parseFloat(integralNum) || 0) * 5; // weight = integral / 0.2
}

export function score(integralNum) {
  return parseFloat(integralNum) || 0;
}

// Classify waste type based on device and context
export function classifyWasteType(record) {
  // Try to classify based on device product name
  const name = (record.deviceProductName || '').toLowerCase();
  if (name.includes('油') || name.includes('uco') || name.includes('oil') || name.includes('cooking')) return 'UCO';
  if (name.includes('瓶') || name.includes('plastic') || name.includes('pet') || name.includes('bottle')) return 'Plastic';
  if (name.includes('铝') || name.includes('aluminium') || name.includes('can') || name.includes('aluminum')) return 'Aluminum';
  if (name.includes('纸') || name.includes('paper') || name.includes('cardboard')) return 'Paper';
  if (name.includes('glass') || name.includes('玻璃')) return 'Glass';
  // Default: check if device type suggests mixed recycling
  if (name.includes('回收') || name.includes('回收柜') || name.includes('rvm') || name.includes('recycle')) return 'Recyclables';
  return 'Mixed';
}

// Fetch machines from vendor API
export async function fetchVendorDevices() {
  const r = await vGet('/system/device/list', { page: 1, pageSize: 50 });
  if (!r.ok || !r.data) return [];
  // vendor response: { code: 200, data: { total: 10, rows: [...] } }
  // machines.js also handles: data.data.list
  const payload = r.data.data;
  if (!payload) return [];
  const rows = payload.rows || payload.list || (Array.isArray(payload) ? payload : []);
  return rows.map(d => ({
    device_no: d.deviceNo || d.device_no || d.id,
    name: d.name || d.deviceNo || d.device_no,
    address: d.address || '',
    latitude: parseFloat(d.latitude || d.lat || 0),
    longitude: parseFloat(d.longitude || d.lng || 0),
    is_online: d.isOnline || d.status === 'ONLINE' || d.status === '1' || d.online === true || d.online === '1',
    last_active_at: d.lastActiveTime || d.last_active_at || ''
  }));
}

export default { fetchAllIntegralRecords, fetchRecentIntegralRecords, integralToWeight, score, classifyWasteType, fetchVendorDevices };
