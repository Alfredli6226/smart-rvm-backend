import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

type UserRow = Record<string, any>;
type ReviewRow = Record<string, any>;
type WithdrawalRow = Record<string, any>;
type WalletRow = Record<string, any>;

const VENDOR_API_BASE = 'https://api.autogcm.com';
const MERCHANT_NO = process.env.MERCHANT_NO || '';
const SECRET = process.env.SECRET || process.env.API_SECRET || process.env.VITE_API_SECRET || '';
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

function createSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function generateSignature(timestamp: string): string {
  return crypto.createHash('md5').update(`${MERCHANT_NO}${SECRET}${timestamp}`).digest('hex');
}

function canUseVendorApi() {
  return Boolean(MERCHANT_NO && SECRET);
}

async function callVendorAPI(endpoint: string, params: Record<string, any> = {}) {
  if (!canUseVendorApi()) {
    throw new Error('Vendor API credentials are not configured');
  }

  const timestamp = Date.now().toString();
  const signature = generateSignature(timestamp);
  const headers = {
    'merchant-no': MERCHANT_NO,
    timestamp,
    sign: signature,
    'Content-Type': 'application/json'
  };

  const url = `${VENDOR_API_BASE}${endpoint}`;
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      }, {})
  ).toString();

  const response = await fetch(queryString ? `${url}?${queryString}` : url, { headers });
  if (!response.ok) throw new Error(`Vendor API error: ${response.status} ${response.statusText}`);

  const payload = await response.json();
  if (payload?.code && payload.code !== 200) {
    throw new Error(payload.msg || `Vendor API returned code ${payload.code}`);
  }

  return payload?.data ?? payload;
}

function num(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickUserId(user: UserRow) {
  return String(user.id || user.user_id || user.userId || '');
}

function pickNickname(user: UserRow) {
  return user.nickName || user.nickname || user.full_name || user.name || `User ${pickUserId(user)}`;
}

function pickStatus(user: UserRow) {
  return String(user.status ?? user.user_status ?? '0');
}

function normalizeVendorUser(user: UserRow) {
  const ui = user.userInfo || {};
  return {
    id: String(user.userId || user.id || ''),
    user_id: String(user.userId || user.id || ''),
    nickName: user.nickName || user.nickname || user.name || 'Unknown',
    phone: ui.mobile || user.phonenumber || user.phone || '',
    email: user.email || '',
    deviceNo: user.deviceNo || user.device_no || '',
    status: String(user.status ?? '0'),
    createTime: user.createTime || user.created_at || null,
    total_weight: num(ui.amount ?? user.totalWeight ?? user.total_weight),
    total_points: num(ui.pointsBalance ?? user.totalPoints ?? user.total_points)
  };
}

async function getVendorUsers(pageNum = 1, pageSize = 20) {
  // Vendor /system/user/list requires userType=11 param
  const data = await callVendorAPI('/system/user/list', { userType: 11, pageNum, pageSize });
  const rows = Array.isArray(data?.rows)
    ? data.rows
    : Array.isArray(data?.list)
      ? data.list
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];

  const total = num(data?.total ?? data?.count ?? rows.length);
  return {
    source: 'vendor_api',
    data: rows.map(normalizeVendorUser),
    total,
    pages: pageSize > 0 ? Math.ceil(total / pageSize) : 1,
    hasNextPage: pageNum * pageSize < total
  };
}

async function getVendorUser(userId: string) {
  const data = await callVendorAPI(`/system/user/${userId}`);
  return normalizeVendorUser(data || {});
}

function buildUserStats(user: UserRow) {
  const reviews: ReviewRow[] = Array.isArray(user.submission_reviews) ? user.submission_reviews : [];
  const withdrawals: WithdrawalRow[] = Array.isArray(user.withdrawals) ? user.withdrawals : [];
  const wallets: WalletRow[] = Array.isArray(user.merchant_wallets) ? user.merchant_wallets : [];

  const verifiedReviews = reviews.filter((review) => String(review.status || '').toUpperCase() === 'VERIFIED');
  const totalEarned = verifiedReviews.reduce((sum, review) => sum + num(review.calculated_value), 0);
  const totalWithdrawn = withdrawals
    .filter((withdrawal) => String(withdrawal.status || '').toUpperCase() !== 'REJECTED')
    .reduce((sum, withdrawal) => sum + num(withdrawal.amount), 0);

  const walletWeight = wallets.reduce((sum, wallet) => sum + num(wallet.total_weight), 0);
  const reviewWeight = verifiedReviews.reduce((sum, review) => sum + num(review.api_weight), 0);
  const totalWeight = walletWeight || num(user.total_weight) || reviewWeight;
  const totalPoints = wallets.reduce((sum, wallet) => sum + num(wallet.total_earnings), 0) || totalEarned || num(user.total_points);

  const lastActivity = reviews
    .map((review) => review.submitted_at || review.created_at)
    .filter(Boolean)
    .sort()
    .pop() || user.last_active_at || user.createTime || user.created_at || null;

  return {
    id: pickUserId(user),
    user_id: pickUserId(user),
    nickName: pickNickname(user),
    phone: user.phone || '',
    email: user.email || '',
    status: pickStatus(user),
    createTime: user.createTime || user.created_at || null,
    total_weight: Number(totalWeight.toFixed(2)),
    total_points: Number(totalPoints.toFixed(2)),
    balance: Number((totalEarned - totalWithdrawn).toFixed(2)),
    total_earned: Number(totalEarned.toFixed(2)),
    total_withdrawn: Number(totalWithdrawn.toFixed(2)),
    lastActivity,
    review_count: verifiedReviews.length
  };
}

async function fetchSupabaseUsers(supabase: ReturnType<typeof createSupabase>, offset: number, limit: number) {
  if (!supabase) return { rows: [], total: 0 };

  // Fetch users without embedded relationships to avoid schema cache issues
  const { data, count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  // Fetch related data in separate queries
  const userIds = (data || []).map((u: any) => u.user_id || u.id).filter(Boolean);
  
  // Only fetch relationships if there are users
  if (userIds.length > 0 && supabase) {
    try {
      const [walletRes, withdrawalRes, reviewRes] = await Promise.all([
        supabase.from('merchant_wallets').select('*').in('user_id', userIds),
        supabase.from('withdrawals').select('*').in('user_id', userIds),
        supabase.from('submission_reviews').select('*').in('user_id', userIds)
      ]);

      const walletsByUser = (walletRes.data || []).reduce((acc: any, w: any) => {
        const uid = w.user_id;
        if (!acc[uid]) acc[uid] = [];
        acc[uid].push(w);
        return acc;
      }, {});

      const withdrawalsByUser = (withdrawalRes.data || []).reduce((acc: any, w: any) => {
        const uid = w.user_id;
        if (!acc[uid]) acc[uid] = [];
        acc[uid].push(w);
        return acc;
      }, {});

      const reviewsByUser = (reviewRes.data || []).reduce((acc: any, r: any) => {
        const uid = r.user_id;
        if (!acc[uid]) acc[uid] = [];
        acc[uid].push(r);
        return acc;
      }, {});

      // Attach related data back to each user
      (data || []).forEach((user: any) => {
        const uid = user.user_id || user.id;
        user.merchant_wallets = walletsByUser[uid] || [];
        user.withdrawals = withdrawalsByUser[uid] || [];
        user.submission_reviews = reviewsByUser[uid] || [];
      });
    } catch (relError) {
      // If relationship queries fail, just proceed with user data only
      console.warn('Could not fetch related data:', relError);
    }
  }

  return { rows: (data || []).map(buildUserStats), total: count || 0 };
}

function sortUsers(users: any[], filterType: string) {
  const sorted = [...users];
  switch (filterType) {
    case 'top_recyclers':
      return sorted.sort((a, b) => num(b.total_weight) - num(a.total_weight));
    case 'new_registers':
      return sorted.sort((a, b) => new Date(b.createTime || 0).getTime() - new Date(a.createTime || 0).getTime());
    case 'active':
      return sorted.filter((user) => String(user.status) === '0');
    default:
      return sorted;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = createSupabase();
  const { method, url } = req;
  const pathWithoutQuery = (url || '').split('?')[0];
  const pathParts = pathWithoutQuery.replace('/api/users', '').split('/').filter(Boolean);
  const pathId = pathParts[0] || null;
  const pathAction = pathParts[1] || null;

  try {
    if (method === 'GET' && !pathId) {
      const filterType = String(req.query.filter_type || 'all');
      const limit = Math.max(1, parseInt(String(req.query.limit || '20'), 10));
      const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10));
      const pageNum = Math.floor(offset / limit) + 1;

      let users: any[] = [];
      let total = 0;
      let source = 'supabase';

      try {
        if (canUseVendorApi()) {
          const vendorUsers = await getVendorUsers(pageNum, limit);
          users = vendorUsers.data;
          total = vendorUsers.total;
          source = vendorUsers.source;
        } else if (supabase) {
          const result = await fetchSupabaseUsers(supabase, offset, limit);
          users = result.rows;
          total = result.total;
        } else {
          throw new Error('Neither vendor API nor Supabase is configured');
        }
      } catch (primaryError) {
        if (!supabase) throw primaryError;
        const result = await fetchSupabaseUsers(supabase, offset, limit);
        users = result.rows;
        total = result.total;
        source = 'supabase_fallback';
      }

      const filteredUsers = sortUsers(users, filterType);

      return res.status(200).json({
        success: true,
        data: filteredUsers,
        pagination: {
          filter_type: filterType,
          limit,
          offset,
          total
        },
        message: `Users retrieved from ${source}`,
        source
      });
    }

    if (method === 'GET' && pathId === 'filter') {
      const filterType = String(req.query.filter_type || 'all');
      const limit = Math.max(1, parseInt(String(req.query.limit || '20'), 10));
      const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10));

      let users: any[] = [];
      let source = 'supabase';

      try {
        if (canUseVendorApi()) {
          const vendorUsers = await getVendorUsers(1, Math.max(100, offset + limit));
          users = vendorUsers.data;
          source = vendorUsers.source;
        } else if (supabase) {
          const result = await fetchSupabaseUsers(supabase, 0, Math.max(100, offset + limit));
          users = result.rows;
        } else {
          throw new Error('Neither vendor API nor Supabase is configured');
        }
      } catch (primaryError) {
        if (!supabase) throw primaryError;
        const result = await fetchSupabaseUsers(supabase, 0, Math.max(100, offset + limit));
        users = result.rows;
        source = 'supabase_fallback';
      }

      const filtered = sortUsers(users, filterType);
      return res.status(200).json({
        success: true,
        data: filtered.slice(offset, offset + limit),
        pagination: {
          filter_type: filterType,
          limit,
          offset,
          total: filtered.length
        },
        source
      });
    }

    if (method === 'GET' && pathId === 'stats') {
      if (supabase) {
        const { data: users, error } = await supabase
          .from('users')
          .select(`
            id,
            user_id,
            nickName,
            nickname,
            total_weight,
            total_points,
            status,
            merchant_wallets (total_earnings, total_weight),
            submission_reviews (calculated_value, status, api_weight),
            withdrawals (amount, status)
          `);

        if (error) throw error;

        const normalized = (users || []).map(buildUserStats);
        const topUsers = [...normalized]
          .sort((a, b) => num(b.total_weight) - num(a.total_weight))
          .slice(0, 5)
          .map((user) => ({
            id: user.id,
            name: user.nickName,
            weight: user.total_weight,
            points: user.total_points
          }));

        const totalWeight = normalized.reduce((sum, user) => sum + num(user.total_weight), 0);
        const totalPoints = normalized.reduce((sum, user) => sum + num(user.total_points), 0);

        return res.status(200).json({
          success: true,
          data: {
            total_users: normalized.length,
            active_users: normalized.filter((user) => String(user.status) === '0').length,
            total_weight: Number(totalWeight.toFixed(2)),
            total_points: Number(totalPoints.toFixed(2)),
            average_weight: normalized.length ? Number((totalWeight / normalized.length).toFixed(2)) : 0,
            average_points: normalized.length ? Number((totalPoints / normalized.length).toFixed(2)) : 0,
            top_users: topUsers
          },
          source: 'supabase',
          last_updated: new Date().toISOString()
        });
      }

      if (canUseVendorApi()) {
        const vendorUsers = await getVendorUsers(1, 100);
        const topUsers = [...vendorUsers.data]
          .sort((a, b) => num(b.total_weight) - num(a.total_weight))
          .slice(0, 5)
          .map((user) => ({ id: user.id, name: user.nickName, weight: user.total_weight, points: user.total_points }));

        const totalWeight = vendorUsers.data.reduce((sum, user) => sum + num(user.total_weight), 0);
        const totalPoints = vendorUsers.data.reduce((sum, user) => sum + num(user.total_points), 0);

        return res.status(200).json({
          success: true,
          data: {
            total_users: vendorUsers.total,
            active_users: vendorUsers.data.filter((user) => String(user.status) === '0').length,
            total_weight: Number(totalWeight.toFixed(2)),
            total_points: Number(totalPoints.toFixed(2)),
            average_weight: vendorUsers.data.length ? Number((totalWeight / vendorUsers.data.length).toFixed(2)) : 0,
            average_points: vendorUsers.data.length ? Number((totalPoints / vendorUsers.data.length).toFixed(2)) : 0,
            top_users: topUsers
          },
          source: 'vendor_api',
          last_updated: new Date().toISOString()
        });
      }

      throw new Error('No live data source configured');
    }

    if (method === 'GET' && pathId && !pathAction && pathId !== 'filter' && pathId !== 'stats') {
      const userId = String(pathId);

      if (canUseVendorApi()) {
        try {
          const vendorUser = await getVendorUser(userId);
          return res.status(200).json({
            success: true,
            data: vendorUser,
            sources: { vendor_api: true, supabase: false }
          });
        } catch (vendorError) {
          if (!supabase) throw vendorError;
        }
      }

      if (!supabase) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          merchant_wallets (current_balance, total_earnings, merchant_id, total_weight),
          withdrawals (amount, status, merchant_id, created_at),
          submission_reviews (calculated_value, status, merchant_id, api_weight, submitted_at, created_at)
        `)
        .or(`id.eq.${userId},user_id.eq.${userId}`)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      return res.status(200).json({
        success: true,
        data: buildUserStats(data),
        sources: { vendor_api: false, supabase: true }
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Users API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error?.message || 'Unknown error'
    });
  }
}
