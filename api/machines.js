// ===== RVM Machines API — User App Compatible =====
// Uses /system/device/list for device info + /api/open/v1/device/position for bin data
import crypto from 'crypto';

const VENDOR_BASE = 'https://api.autogcm.com';
const MERCHANT_NO = process.env.MERCHANT_NO || process.env.VITE_MERCHANT_NO || '';
const API_SECRET = process.env.API_SECRET || process.env.SECRET || process.env.VITE_API_SECRET || '';

function md5(s) { return crypto.createHash('md5').update(s, 'utf8').digest('hex'); }

function vHeaders() {
  const ts = Date.now();
  return { 'merchant-no': MERCHANT_NO, 'timestamp': String(ts), 'sign': md5(`${MERCHANT_NO}${API_SECRET}${ts}`) };
}

async function vGet(path, params = {}) {
  const url = new URL(path, VENDOR_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  try {
    const res = await fetch(url.toString(), { headers: vHeaders() });
    const text = await res.text();
    try { return { ok: res.ok, data: JSON.parse(text) }; }
    catch { return { ok: false, raw: text }; }
  } catch(e) { return { ok: false, error: e.message }; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. Get device list (basic info from vendor)
    const listRes = await vGet('/system/device/list');
    let devices = [];
    if (listRes.ok && listRes.data) {
      const payload = listRes.data.data || listRes.data;
      devices = payload.list || payload.rows || (Array.isArray(payload) ? payload : []);
    }

    if (devices.length === 0) {
      return res.status(200).json({ success: true, data: [], stats: { total: 0, online: 0, offline: 0 } });
    }

    // 2. For each device, get real-time position data (bin levels from user app endpoint)
    const enriched = [];
    for (const d of devices) {
      const deviceNo = d.deviceNo || d.device_no || '';
      let positionData = null;
      
      if (deviceNo) {
        const posRes = await vGet('/api/open/v1/device/position', { deviceNo });
        if (posRes.ok && posRes.data?.code === 200) {
          positionData = posRes.data.data || [];
        }
      }

      const configs = Array.isArray(positionData) ? positionData : [];

      // Build compartments from position data
      const compartments = configs.map(cfg => ({
        label: cfg.rubbishTypeName || 'Unknown',
        weight: String(cfg.weight || 0),
        percent: cfg.isFull ? 100 : (cfg.rate ? Math.round(Number(cfg.rate)) : 0),
        isFull: cfg.isFull === true || cfg.isFull === 'true',
        maxWeight: cfg.maxWeight || 100, 
        rate: cfg.rate || 0,
        clearTime: cfg.clearTime || '',
        cameraNo: cfg.cameraNo || 0
      }));

      // Online status from device list
      const online = d.isOnline === 1 || d.isOnline === true || d.status === 1;
      const lastOnline = d.lastOnlineTime || d.updateTime || '';

      // Machine type identifier
      const isUCO = ['071582000006','071582000007','071582000008','071582000009','071582000010'].includes(deviceNo);
      const machineType = isUCO ? 'UCO' : 'Mixed Recycle';

      enriched.push({
        device_no: deviceNo,
        name: d.address ? d.address.split(',')[0] : (d.deviceNo || deviceNo),
        address: d.address || '',
        latitude: parseFloat(d.latitude || 0),
        longitude: parseFloat(d.longitude || 0),
        is_online: online,
        signal: d.signalVal || 0,
        model: d.modelName || '',
        machine_type: machineType,
        rate: isUCO ? 2.50 : 0.20,
        last_online: lastOnline,
        compartments: compartments,
        _source: 'vendor'
      });
    }

    const onlineCount = enriched.filter(m => m.is_online).length;

    return res.status(200).json({
      success: true,
      data: enriched,
      stats: { total: enriched.length, online: onlineCount, offline: enriched.length - onlineCount },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, data: [] });
  }
}
