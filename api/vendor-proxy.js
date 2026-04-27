// Vendor API Proxy (ESM) — talks to api.autogcm.com from server
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const MERCHANT_NO = process.env.MERCHANT_NO || process.env.VITE_MERCHANT_NO;
const API_SECRET = process.env.API_SECRET || process.env.SECRET || process.env.VITE_API_SECRET;
const VENDOR_BASE = 'https://api.autogcm.com';
const USER_TYPE = 11;

function md5(s) { return crypto.createHash('md5').update(s, 'utf8').digest('hex'); }
function headers() {
  const ts = Date.now();
  return { 'merchant-no': MERCHANT_NO, 'timestamp': String(ts), 'sign': md5(`${MERCHANT_NO}${API_SECRET}${ts}`) };
}
async function vget(path, params = {}) {
  const url = new URL(path, VENDOR_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), { headers: headers() });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, body: text }; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cron-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || 'status';
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // Status — test connectivity
    if (action === 'status') {
      const r = await vget('/system/device/list');
      return res.status(200).json({
        online: r.data?.code === 200,
        devices_on_vendor: r.data?.data?.total || 0,
        message: r.data?.msg || 'disconnected'
      });
    }

    // Raw proxy: /api/vendor-proxy?path=/system/user/list&userType=11
    if (action === 'proxy') {
      const vp = req.query.path;
      if (!vp) return res.status(400).json({ error: 'path param required' });
      const r = await vget(vp, req.query);
      return res.status(200).json(r.data || { raw: r.body });
    }

    // Live vendor data dumps
    if (action === 'devices') {
      const r = await vget('/system/device/list');
      return res.status(200).json(r.data || { error: 'fetch failed' });
    }
    if (action === 'profile') {
      const r = await vget('/system/user/profile');
      return res.status(200).json(r.data || { error: 'fetch failed' });
    }

    // ===== SYNC USERS — page through all 1169 users =====
    if (action === 'sync-users') {
      let page = 1, synced = 0, errors = 0, total = 0;
      const pageSize = 50;
      while (true) {
        const r = await vget('/system/user/list', { userType: USER_TYPE, pageNum: page, pageSize });
        if (!r.data || r.data.code !== 200) {
          return res.status(502).json({ error: 'vendor down', detail: r.data?.msg, synced, errors });
        }
        if (page === 1) total = parseInt(r.data.total) || 0;
        const rows = r.data.rows || [];
        if (rows.length === 0) break;
        for (const u of rows) {
          try {
            const ui = u.userInfo || {};
            const rec = {
              user_id: String(u.userId), nickName: u.nickName || '',
              phone: u.phonenumber || '', email: u.email || '',
              status: u.status === '0' ? 'ACTIVE' : 'INACTIVE',
              total_weight: parseFloat(ui.amount || 0),
              total_points: parseFloat(ui.pointsBalance || 0),
              created_at: u.createTime ? new Date(u.createTime).toISOString() : null,
              last_active_at: u.loginDate ? new Date(u.loginDate).toISOString() : null
            };
            const { data: ex } = await supabase.from('users').select('id').eq('user_id', rec.user_id).maybeSingle();
            if (ex) await supabase.from('users').update(rec).eq('user_id', rec.user_id);
            else await supabase.from('users').insert(rec);
            synced++;
          } catch (e) { errors++; }
        }
        if (page * pageSize >= total) break;
        page++;
      }
      return res.status(200).json({ success: true, synced, errors, total });
    }

    // ===== SYNC MACHINES =====
    if (action === 'sync-machines') {
      const r = await vget('/system/device/list');
      if (!r.data || r.data.code !== 200) {
        return res.status(502).json({ error: 'vendor down', detail: r.data?.msg });
      }
      const devices = r.data.data.list;
      let synced = 0, errors = 0, details = [];
      for (const dev of devices) {
        try {
          const rec = {
            device_no: dev.deviceNo, name: dev.deviceName || dev.deviceNo,
            location: (dev.address || '').slice(0, 200), is_active: dev.status === 1,
            is_manual_offline: dev.isOnline === 0, address: dev.address || '',
            latitude: dev.latitude || 0, longitude: dev.longitude || 0,
            zone: dev.deptName || '', merchant_id: '11111111-1111-1111-1111-111111111111',
            last_online_time: dev.lastOnlineTime ? new Date(dev.lastOnlineTime).toISOString() : null,
            created_at: dev.createTime ? new Date(dev.createTime).toISOString() : new Date().toISOString()
          };
          const { data: ex } = await supabase.from('machines').select('id').eq('device_no', rec.device_no).maybeSingle();
          if (ex) await supabase.from('machines').update(rec).eq('device_no', rec.device_no);
          else await supabase.from('machines').insert(rec);
          details.push({ device_no: rec.device_no, action: ex ? 'updated' : 'created' });
          synced++;
        } catch (e) { errors++; details.push({ device_no: dev.deviceNo, error: e.message }); }
      }
      return res.status(200).json({ success: true, synced, errors, details });
    }

    return res.status(400).json({ error: 'unknown action: ' + action });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
