// ===== RVM Data Sync — Vendor API (ESM) =====
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const MERCHANT_NO = process.env.MERCHANT_NO || process.env.VITE_MERCHANT_NO;
const API_SECRET = process.env.API_SECRET || process.env.SECRET || process.env.VITE_API_SECRET;
const VENDOR_BASE = 'https://api.autogcm.com';
const USER_TYPE = 11; // End-user type (not admin)

function md5(s) { return crypto.createHash('md5').update(s, 'utf8').digest('hex'); }

function vHeaders() {
  const ts = Date.now();
  const sign = md5(`${MERCHANT_NO}${API_SECRET}${ts}`);
  return { 'merchant-no': MERCHANT_NO, 'timestamp': String(ts), 'sign': sign };
}

async function vGet(path, params = {}) {
  const url = new URL(path, VENDOR_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), { headers: vHeaders() });
  const text = await res.text();
  try { return { ok: res.ok, data: JSON.parse(text) }; }
  catch { return { ok: false, raw: text }; }
}

// ===== FETCH ALL INTEGRAL RECORDS (paginated, parallel) =====
async function fetchAllIntegralRecords() {
  const first = await vGet('/system/integral/list', { page: 1, pageSize: 50, userType: 11 });
  if (!first.ok || !first.data) return [];
  const total = parseInt(first.data.total || '0');
  const allRows = [...(first.data.rows || [])];
  const totalPages = Math.ceil(total / 50);
  const promises = [];
  for (let p = 2; p <= totalPages && p <= 70; p++) {
    promises.push(
      vGet('/system/integral/list', { page: p, pageSize: 50, userType: 11 })
        .then(r => r.ok && r.data ? (r.data.rows || []) : [])
        .catch(() => [])
    );
  }
  const results = await Promise.all(promises);
  results.forEach(r => allRows.push(...r));
  return allRows;
}

// ===== SYNC USERS (page through all) =====
async function syncUsers(supabase) {
  let totalSynced = 0, totalErrors = 0, pages = 0;
  let page = 1;
  const pageSize = 50;
  let total = 0;

  while (true) {
    const r = await vGet('/system/user/list', { 
      userType: USER_TYPE, pageNum: page, pageSize 
    });

    if (!r.data || r.data.code !== 200) {
      return { 
        synced: totalSynced, errors: totalErrors + 1, 
        error: r.data?.msg || 'Vendor API failed', 
        pages 
      };
    }

    if (page === 1) total = parseInt(r.data.total) || 0;
    const rows = r.data.rows || [];
    if (rows.length === 0) break;

    for (const u of rows) {
      try {
        const ui = u.userInfo || {};
        const record = {
          user_id: String(u.userId),
          nickName: u.nickName || '',
          phone: u.phonenumber || '',
          email: u.email || '',
          status: u.status === '0' ? 'ACTIVE' : 'INACTIVE',
          total_weight: parseFloat(ui.amount || 0),
          total_points: parseFloat(ui.pointsBalance || 0),
          created_at: u.createTime ? new Date(u.createTime).toISOString() : null,
          last_active_at: u.loginDate ? new Date(u.loginDate).toISOString() : null
        };

        // Upsert by user_id
        const { data: ex } = await supabase
          .from('users')
          .select('id')
          .eq('user_id', record.user_id)
          .maybeSingle();

        if (ex) await supabase.from('users').update(record).eq('user_id', record.user_id);
        else await supabase.from('users').insert(record);
        totalSynced++;
      } catch (e) {
        totalErrors++;
      }
    }

    pages++;
    if (page * pageSize >= total) break;
    page++;
  }

  return { synced: totalSynced, errors: totalErrors, total, pages };
}

// ===== SYNC MACHINES =====
async function syncMachines(supabase) {
  const r = await vGet('/system/device/list');
  if (!r.data || r.data.code !== 200) {
    return { synced: 0, errors: 1, error: r.data?.msg || 'Vendor API failed' };
  }

  const devices = r.data.data.list;
  let synced = 0, errs = [];

  for (const dev of devices) {
    try {
      const rec = {
        device_no: dev.deviceNo,
        name: dev.deviceName || dev.deviceNo,
        location: (dev.address || '').slice(0, 200),
        is_active: dev.status === 1,
        is_manual_offline: dev.isOnline === 0,
        address: dev.address || '',
        latitude: dev.latitude || 0, longitude: dev.longitude || 0,
        zone: dev.deptName || '',
        merchant_id: '11111111-1111-1111-1111-111111111111',
        last_online_time: dev.lastOnlineTime ? new Date(dev.lastOnlineTime).toISOString() : null,
        created_at: dev.createTime ? new Date(dev.createTime).toISOString() : new Date().toISOString()
      };
      const { data: ex } = await supabase.from('machines').select('id').eq('device_no', rec.device_no).maybeSingle();
      if (ex) await supabase.from('machines').update(rec).eq('device_no', rec.device_no);
      else await supabase.from('machines').insert(rec);
      synced++;
    } catch (e) { errs.push({ device_no: dev.deviceNo, error: e.message }); }
  }
  return { synced, errors: errs.length, error_details: errs };
}

// ===== MAIN =====
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cron-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const action = req.query.action || 'status';

  try {
    switch (action) {
      case 'sync-users': {
        const r = await syncUsers(supabase);
        return res.status(200).json({ success: true, ...r });
      }
      case 'sync-machines': {
        const r = await syncMachines(supabase);
        return res.status(200).json({ success: true, ...r });
      }
      case 'sync-integral': {
        const r = await fetchAllIntegralRecords();
        console.log(`Fetched ${r.length} records`);
        if (r.length === 0) return res.status(200).json({ synced: 0, error: 'no vendor data' });
        
        let inserted = 0;
        const batchSize = 100;
        const transformed = r.map(rec => ({
          user_id: rec.userId,
          device_no: rec.deviceNo || '',
          waste_type: 'Mixed',
          total_weight: (parseFloat(rec.integralNum || 0) / 0.2).toFixed(2),
          points: parseFloat(rec.integralNum || 0),
          status: 'COMPLETED',
          submitted_at: rec.recordedTime || rec.createTime,
          payload: { raw: rec }
        }));
        
        for (let i = 0; i < transformed.length; i += batchSize) {
          const batch = transformed.slice(i, i + batchSize);
          try {
            const { error } = await supabase.from('rubbish_records').upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
            if (!error) inserted += batch.length;
          } catch(e) {
            for (const row of batch) {
              try { await supabase.from('rubbish_records').insert(row); inserted++; } catch {}
            }
          }
        }
        
        return res.status(200).json({ success: true, vendor_records: r.length, rubbish_records_inserted: inserted });
      }
      case 'full-sync': {
        const m = await syncMachines(supabase);
        const u = await syncUsers(supabase);
        return res.status(200).json({ success: true, machines: m, users: u });
      }
      case 'sync-submissions': {
        const r = await fetchAllIntegralRecords();
        if (r.length === 0) return res.status(200).json({ synced: 0 });
        let inserted = 0;
        const batchSize = 100;
        for (let i = 0; i < r.length; i += batchSize) {
          const batch = r.slice(i, i + batchSize).map(rec => ({
            user_id: rec.userId,
            device_no: rec.deviceNo || '',
            waste_type: 'Mixed',
            api_weight: (parseFloat(rec.integralNum || 0) / 0.2).toFixed(2),
            total_weight: (parseFloat(rec.integralNum || 0) / 0.2).toFixed(2),
            points_awarded: parseFloat(rec.integralNum || 0),
            status: 'VERIFIED',
            vendor_record_id: String(rec.id || rec.orderId || ''),
            submitted_at: rec.recordedTime || rec.createTime
          }));
          try {
            const { error } = await supabase.from('submission_reviews').upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
            if (!error) inserted += batch.length;
          } catch {
            for (const row of batch) {
              try { await supabase.from('submission_reviews').insert(row); inserted++; } catch {}
            }
          }
        }
        return res.status(200).json({ success: true, vendor_records: r.length, submission_reviews_inserted: inserted });
      }
      case 'status': {
        const t = await vGet('/system/device/list');
        const v = t.data?.code === 200;
        const { count: uc } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: mc } = await supabase.from('machines').select('*', { count: 'exact', head: true });
        return res.status(200).json({
          vendor_connected: v,
          vendor_devices: v ? t.data.data.total : 0,
          vendor_user_total: 1169,
          local_users: uc || 0,
          local_machines: mc || 0
        });
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
