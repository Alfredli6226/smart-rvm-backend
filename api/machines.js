// ===== RVM Machines API — User App Compatible =====
// Uses the same endpoints as the user app (rvm-web-chi) for real-time data
import crypto from 'crypto';

const MERCHANT_NO = process.env.MERCHANT_NO || process.env.VITE_MERCHANT_NO || '';
const API_SECRET = process.env.API_SECRET || process.env.SECRET || process.env.VITE_API_SECRET || '';
const VENDOR_BASE = 'https://api.autogcm.com';

function md5(s) { return crypto.createHash('md5').update(s, 'utf8').digest('hex'); }

function vHeaders() {
  const ts = Date.now();
  return {
    'merchant-no': MERCHANT_NO,
    'timestamp': String(ts),
    'sign': md5(`${MERCHANT_NO}${API_SECRET}${ts}`),
    'Content-Type': 'application/json'
  };
}

async function vGet(path, params = {}) {
  const url = new URL(path, VENDOR_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), { headers: vHeaders() });
  const text = await res.text();
  try { return { ok: res.ok, data: JSON.parse(text) }; }
  catch { return { ok: false, raw: text }; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. Get all devices from system API (basic info)
    const vendorResult = await vGet('/system/device/list');
    let devices = [];
    if (vendorResult.ok && vendorResult.data?.data?.list) {
      devices = vendorResult.data.data.list;
    } else if (vendorResult.ok && vendorResult.data?.code === 200) {
      const rows = vendorResult.data.data?.rows || vendorResult.data.data?.list || [];
      devices = Array.isArray(rows) ? rows : [];
    }

    if (devices.length === 0) {
      devices = vendorResult.data?.data || [];
      if (!Array.isArray(devices)) devices = [];
    }

    // 2. For each device, get real-time position data (same as user app)
    // Using /api/open/v1/device/position?deviceNo=X
    const enriched = await Promise.all(devices.map(async (d) => {
      const deviceNo = d.deviceNo || d.device_no || '';
      let positionData = null;
      
      if (deviceNo) {
        const posRes = await vGet('/api/open/v1/device/position', { deviceNo });
        if (posRes.ok && posRes.data?.code === 200) {
          positionData = posRes.data.data || [];
        }
      }

      // Build compartments from position data (user app format)
      const configs = Array.isArray(positionData) ? positionData : [];
      const compartments = [];
      
      for (let i = 1; i <= 2; i++) {
        const cfg = configs.find(c => c.positionNo === i) || {};
        const weight = parseFloat(cfg.weight || 0);
        const rate = cfg.rate !== undefined ? Math.round(Number(cfg.rate)) : 0;
        const isFull = cfg.isFull === true || cfg.isFull === 'true';
        const label = cfg.rubbishTypeName || (i === 1 ? 'Bin 1' : 'Bin 2');
        
        compartments.push({
          label: label,
          weight: weight.toFixed(2),
          percent: isFull ? 100 : rate,
          isFull: isFull,
          status: cfg.status || 0
        });
      }

      // Determine online status from vendor
      const isOnline = d.status === 1 || d.isOnline === 1 || d.isOnline === true;
      const statusText = configs.some(c => c.status === 1) ? 'In Use' : 
                         isOnline ? 'Online' : 'Offline';

      let mapsUrl = '#';
      if (d.latitude && d.longitude) {
        mapsUrl = `https://maps.google.com/?q=${d.latitude},${d.longitude}`;
      }

      return {
        device_no: deviceNo,
        name: d.deviceName || d.deviceNo || deviceNo || '',
        address: d.address || '',
        latitude: d.latitude || 0,
        longitude: d.longitude || 0,
        is_online: isOnline,
        status: statusText,
        signal: d.signalVal || 0,
        model: d.modelName || '',
        sn: d.sn || '',
        last_active_at: d.updateTime || d.createTime || null,
        compartments: compartments,
        _source: 'vendor'
      };
    }));

    const onlineCount = enriched.filter(m => m.is_online).length;

    return res.status(200).json({
      success: true,
      data: enriched,
      stats: {
        total: enriched.length,
        online: onlineCount,
        offline: enriched.length - onlineCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, data: [] });
  }
}
