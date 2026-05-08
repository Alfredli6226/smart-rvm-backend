import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabaseAnonKey = (
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  ''
).trim();

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const authClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const READ_ONLY_ACTIONS = new Set(['select', 'stats']);
const MUTATING_ACTIONS = new Set(['insert', 'upsert', 'update', 'delete']);
const MUTATION_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER']);
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

function ensureEq(params, column, value) {
  params.eq = params.eq || {};
  params.eq[column] = value;
}

function ensureIn(params, column, values) {
  params.in = params.in || {};
  params.in[column] = values;
}

async function getAllowedUserIds(merchantId) {
  const [walletsRes, withdrawalsRes, reviewsRes] = await Promise.all([
    supabase.from('merchant_wallets').select('user_id').eq('merchant_id', merchantId).limit(10000),
    supabase.from('withdrawals').select('user_id').eq('merchant_id', merchantId).limit(10000),
    supabase.from('submission_reviews').select('user_id').eq('merchant_id', merchantId).limit(10000),
  ]);

  return Array.from(new Set([
    ...(walletsRes.data || []).map((row) => row.user_id).filter(Boolean),
    ...(withdrawalsRes.data || []).map((row) => row.user_id).filter(Boolean),
    ...(reviewsRes.data || []).map((row) => row.user_id).filter(Boolean),
  ]));
}

async function assertUserBelongsToMerchant(userId, merchantId) {
  const [wallet, withdrawal, review] = await Promise.all([
    supabase.from('merchant_wallets').select('id').eq('merchant_id', merchantId).eq('user_id', userId).maybeSingle(),
    supabase.from('withdrawals').select('id').eq('merchant_id', merchantId).eq('user_id', userId).maybeSingle(),
    supabase.from('submission_reviews').select('id').eq('merchant_id', merchantId).eq('user_id', userId).maybeSingle(),
  ]);

  return Boolean(wallet.data || withdrawal.data || review.data);
}

async function getAllowedDeviceNos(merchantId) {
  const { data } = await supabase
    .from('machines')
    .select('device_no')
    .eq('merchant_id', merchantId)
    .limit(10000);

  return Array.from(new Set((data || []).map((row) => row.device_no).filter(Boolean)));
}

async function deviceBelongsToMerchant(deviceNo, merchantId) {
  if (!deviceNo) return false;

  const { data } = await supabase
    .from('machines')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('device_no', deviceNo)
    .maybeSingle();

  return Boolean(data);
}

async function applyMerchantScope(action, table, params, adminContext) {
  if (adminContext.role === 'SUPER_ADMIN' || !adminContext.merchantId) {
    return { params };
  }

  const scopedParams = { ...(params || {}) };

  if (['merchant_wallets', 'withdrawals', 'submission_reviews', 'cleaning_records', 'wallet_transactions', 'machines', 'customer_service_tickets', 'customer_service_messages'].includes(table)) {
    ensureEq(scopedParams, 'merchant_id', adminContext.merchantId);
    if (action === 'insert' || action === 'upsert') {
      scopedParams.data = { ...(scopedParams.data || {}), merchant_id: adminContext.merchantId };
    }
    return { params: scopedParams };
  }

  if (table === 'cleaning_logs') {
    const allowedDeviceNos = await getAllowedDeviceNos(adminContext.merchantId);
    const safeDeviceNos = allowedDeviceNos.length > 0 ? allowedDeviceNos : [ZERO_UUID];

    if (action === 'select') {
      ensureIn(scopedParams, 'device_no', safeDeviceNos);
      return { params: scopedParams };
    }

    if (action === 'insert' || action === 'upsert') {
      const targetDeviceNo = scopedParams?.data?.device_no;
      const allowed = await deviceBelongsToMerchant(targetDeviceNo, adminContext.merchantId);
      if (!allowed) {
        return { error: 'machine is outside this merchant scope', status: 403 };
      }
      return { params: scopedParams };
    }

    ensureIn(scopedParams, 'device_no', safeDeviceNos);
    return { params: scopedParams };
  }

  if (table === 'merchants') {
    ensureEq(scopedParams, 'id', adminContext.merchantId);
    if (action === 'insert' || action === 'upsert') {
      scopedParams.data = { ...(scopedParams.data || {}), id: adminContext.merchantId };
    }
    return { params: scopedParams };
  }

  if (table === 'app_admins') {
    ensureEq(scopedParams, 'merchant_id', adminContext.merchantId);
    return { params: scopedParams };
  }

  if (table === 'users') {
    if (action === 'select') {
      const allowedUserIds = await getAllowedUserIds(adminContext.merchantId);
      ensureIn(scopedParams, 'id', allowedUserIds.length > 0 ? allowedUserIds : [ZERO_UUID]);
      return { params: scopedParams };
    }

    const targetUserId = scopedParams?.eq?.id;
    if (!targetUserId) {
      return { error: 'merchant-scoped user mutation requires id filter', status: 403 };
    }

    const allowed = await assertUserBelongsToMerchant(targetUserId, adminContext.merchantId);
    if (!allowed) {
      return { error: 'user is outside this merchant scope', status: 403 };
    }

    return { params: scopedParams };
  }

  return { params: scopedParams };
}

async function getAdminContext(req) {
  if (!supabase || !authClient) {
    throw new Error('supabase not configured');
  }

  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];
  if (!token) {
    return { error: 'missing auth token', status: 401 };
  }

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user?.email) {
    return { error: 'invalid auth token', status: 401 };
  }

  const email = userData.user.email;
  
  // Try service role key first, fallback to anon key
  let admin = null;
  const adminClients = [supabase];
  if (authClient && authClient !== supabase) adminClients.push(authClient);
  
  for (const client of adminClients) {
    try {
      const { data, error } = await client
        .from('app_admins')
        .select('role,merchant_id,email')
        .eq('email', email)
        .maybeSingle();
      if (!error && data) {
        admin = data;
        break;
      }
    } catch (e) { /* try next */ }
  }
  
  if (!admin) {
    return { error: 'admin access required', status: 403 };
  }

  return {
    email,
    role: String(admin.role || '').toUpperCase(),
    merchantId: admin.merchant_id || null,
  };
}

export default async function handler(req, res) {
  if (!supabase || !authClient) {
    return res.status(500).json({ error: 'supabase not configured' });
  }

  res.setHeader('Content-Type', 'application/json');

  try {
    const payload = req.body || {};
    const { action, table } = payload;
    const adminContext = await getAdminContext(req);
    if (adminContext.error) {
      return res.status(adminContext.status).json({ error: adminContext.error });
    }

    if (!READ_ONLY_ACTIONS.has(action) && !MUTATING_ACTIONS.has(action)) {
      return res.status(400).json({ error: `unknown action: ${action}` });
    }

    if (MUTATING_ACTIONS.has(action) && !MUTATION_ROLES.has(adminContext.role)) {
      return res.status(403).json({ error: 'insufficient permissions for mutation' });
    }

    const scoped = await applyMerchantScope(action, table, payload.params || {}, adminContext);
    if (scoped.error) {
      return res.status(scoped.status || 403).json({ error: scoped.error });
    }
    const params = scoped.params || {};

    switch (action) {
      // --- SELECT (simple queries) ---
      case 'select': {
        // Try primary client first (service role), fallback to authClient (anon key)
        const clients = [supabase];
        if (authClient && authClient !== supabase) clients.push(authClient);
        
        for (const client of clients) {
          try {
            let query = client.from(table).select(params?.select || '*');
            if (params?.count === true) {
              query = query.select(params?.select || '*', { count: 'exact', head: params?.head ?? false });
            }
            if (params?.range) query = query.range(params.range[0], params.range[1]);
            if (params?.order) query = query.order(params.order.column, { ascending: params.order.ascending ?? true, nullsFirst: params.order.nullsFirst ?? undefined });
            if (params?.eq) {
              for (const [col, val] of Object.entries(params.eq)) {
                if (val !== null && val !== undefined) query = query.eq(col, val);
              }
            }
            if (params?.neq) {
              for (const [col, val] of Object.entries(params.neq)) {
                query = query.neq(col, val);
              }
            }
            if (params?.gte) {
              for (const [col, val] of Object.entries(params.gte)) {
                query = query.gte(col, val);
              }
            }
            if (params?.lte) {
              for (const [col, val] of Object.entries(params.lte)) {
                query = query.lte(col, val);
              }
            }
            if (params?.in) {
              for (const [col, values] of Object.entries(params.in)) {
                if (Array.isArray(values) && values.length > 0) {
                  query = query.in(col, values);
                }
              }
            }
            if (params?.limit) query = query.limit(params.limit);
            if (params?.single === true) query = query.single();
            if (params?.maybeSingle === true) query = query.maybeSingle();
            const { data, error, count } = await query;
            if (!error) return res.json({ data, count });
          } catch (e) { /* try next client */ }
        }
        return res.status(400).json({ error: 'All query attempts failed' });
      }

      // --- INSERT ---
      case 'insert': {
        const { data, error } = await supabase
          .from(table)
          .insert(params?.data || {})
          .select();
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ data });
      }

      // --- UPSERT ---
      case 'upsert': {
        const { data, error } = await supabase
          .from(table)
          .upsert(params?.data || {}, { onConflict: params?.onConflict })
          .select();
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ data });
      }

      // --- UPDATE ---
      case 'update': {
        let query = supabase.from(table).update(params?.data || {});
        if (params?.eq) {
          for (const [col, val] of Object.entries(params.eq)) {
            query = query.eq(col, val);
          }
        }
        const { data, error } = await query.select();
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ data });
      }

      // --- DELETE ---
      case 'delete': {
        let query = supabase.from(table).delete();
        if (params?.eq) {
          for (const [col, val] of Object.entries(params.eq)) {
            query = query.eq(col, val);
          }
        }
        const { data, error } = await query;
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ data });
      }

      // --- Aggregated stats for BigData dashboard ---
      case 'stats': {
        const results = {};

        const { count: machinesCount } = await supabase
          .from('machines')
          .select('*', { count: 'exact', head: true });
        results.machinesCount = machinesCount;

        const { count: usersCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true });
        results.usersCount = usersCount;

        const { data: allUsers } = await supabase
          .from('users')
          .select('total_weight,total_points')
          .limit(10000);
        if (allUsers) {
          results.totalWeight = allUsers.reduce((s, u) => s + (Number(u.total_weight) || 0), 0);
          results.totalPoints = allUsers.reduce((s, u) => s + (Number(u.total_points) || 0), 0);
        }

        const today = new Date().toISOString().split('T')[0];
        const { count: newUsersToday } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', today);
        results.newUsersToday = newUsersToday;

        return res.json(results);
      }

      default:
        return res.status(400).json({ error: `unsupported action: ${action}` });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
