// ===== RVM Machines API — Combined Local + Vendor =====
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
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
    return { ok: false, raw: text };
  }
}

function pickMachineStatus(vendor) {
  // "status": 0=offline, 1=online, isOnline: 0/1
  if (vendor.isOnline === 1 || vendor.isOnline === true) return 'ONLINE';
  if (vendor.status === 1) return 'ONLINE';
  return 'OFFLINE';
}

function normalizeVendorDevice(v) {
  return {
    device_no: v.deviceNo || '',
    name: v.deviceName || v.deviceNo || '',
    address: v.address || '',
    latitude: v.latitude || 0,
    longitude: v.longitude || 0,
    is_online: v.isOnline === 1 || v.isOnline === true,
    status: pickMachineStatus(v),
    signal: v.signalVal || 0,
    model: v.modelName || '',
    sn: v.sn || '',
    last_active_at: v.updateTime || v.createTime || null,
    created_at: v.createTime || null,
    free_expiration: v.freeExpirationTime || null,
    integral: v.integral || 0,
    total_used_coins: v.totalUsedCoins || 0,
    _source: 'vendor'
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. Try vendor API for live machine data
    const vendorResult = await vGet('/system/device/list');
    let machines;
    let source = 'vendor';

    if (vendorResult.ok && vendorResult.data?.code === 200 && vendorResult.data?.data?.list) {
      machines = vendorResult.data.data.list.map(normalizeVendorDevice);
    } else if (vendorResult.ok && vendorResult.data?.data) {
      // Direct array
      const list = Array.isArray(vendorResult.data.data)
        ? vendorResult.data.data
        : vendorResult.data.data.list || [];
      machines = list.map(normalizeVendorDevice);
    } else {
      // Fallback to Supabase
      source = 'supabase';
      if (SUPABASE_URL && SUPABASE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        const { data } = await supabase.from('machines').select('*');
        machines = (data || []).map((m) => ({ ...m, _source: 'supabase' }));
      } else {
        machines = [];
      }
    }

    // 2. Build device list for vendor status snapshot
    const supabase = SUPABASE_URL && SUPABASE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false }
        })
      : null;

    const onlineCount = machines.filter((m) => m.is_online || m.is_online === true).length;

    return res.status(200).json({
      success: true,
      data: machines,
      source,
      stats: {
        total: machines.length,
        online: onlineCount,
        offline: machines.length - onlineCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
      data: []
    });
  }
}
