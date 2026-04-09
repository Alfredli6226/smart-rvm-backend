import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server Configuration Error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { method, url, body } = req;
  
  const pathWithoutQuery = (url || '').split('?')[0];
  const pathParts = pathWithoutQuery.replace('/api/users', '').split('/').filter(Boolean);
  const pathId = pathParts[0] || null;
  const pathAction = pathParts[1] || null;

  try {
    // ==========================================
    // GET /api/users/filter - Filters
    // ==========================================
    if (method === 'GET' && pathId === 'filter') {
      const filterType = req.query.filter_type as string || 'all';
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      let query = supabase
        .from('users')
        .select('*', { count: 'exact' });

      switch (filterType) {
        case 'top_recyclers':
          query = query
            .not('total_weight', 'is', null)
            .order('total_weight', { ascending: false })
            .range(offset, offset + limit - 1);
          break;
        case 'new_registers':
          query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
          break;
        case 'active_users':
          query = query
            .or('status.eq.ACTIVE,status.is.null')
            .order('last_active_at', { ascending: false })
            .range(offset, offset + limit - 1);
          break;
        default:
          query = query
            .or('status.eq.ACTIVE,status.is.null')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || [],
        pagination: { filter_type: filterType, limit, offset, total: count }
      });
    }

    // ==========================================
    // PATCH /api/users/:id - Edit Details
    // ==========================================
    if (method === 'PATCH' && pathId && !pathAction) {
      const { nickname, email, phone, avatar_url, vendor_internal_id } = body || {};

      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      if (nickname !== undefined) updateData.nickname = nickname;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
      if (vendor_internal_id !== undefined) updateData.vendor_internal_id = vendor_internal_id;

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', pathId)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    // ==========================================
    // POST /api/users/:id/adjust-balance
    // Adjustments: Manually adjust points/weight
    // ==========================================
    if (method === 'POST' && pathAction === 'adjust-balance' && pathId) {
      const { adjustment_type, amount, reason } = body || {};

      if (!adjustment_type || amount === undefined) {
        return res.status(400).json({ error: 'adjustment_type and amount required' });
      }

      if (!['points', 'weight'].includes(adjustment_type)) {
        return res.status(400).json({ error: 'adjustment_type must be points or weight' });
      }

      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', pathId)
        .single();

      if (fetchError || !user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

      if (adjustment_type === 'points') {
        const newPoints = (user.lifetime_integral || 0) + Number(amount);
        updateData.lifetime_integral = newPoints;
      } else if (adjustment_type === 'weight') {
        const newWeight = (user.total_weight || 0) + Number(amount);
        updateData.total_weight = newWeight;
      }

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', pathId)
        .select()
        .single();

      if (error) throw error;

      console.log(`Balance adjustment for user ${pathId}: ${adjustment_type} ${Number(amount) > 0 ? '+' : ''}${amount}. Reason: ${reason || 'N/A'}`);

      return res.status(200).json({
        success: true,
        data: { ...data, adjustment_type, amount, reason }
      });
    }

    // ==========================================
    // POST /api/users/:id/status
    // Status Control: Warn or Block user
    // ==========================================
    if (method === 'POST' && pathAction === 'status' && pathId) {
      const { status, reason } = body || {};

      const validStatuses = ['ACTIVE', 'WARNED', 'BLOCKED'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      }

      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', pathId)
        .single();

      if (fetchError || !user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { data, error } = await supabase
        .from('users')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', pathId)
        .select()
        .single();

      if (error) throw error;

      console.log(`User ${pathId} status changed to ${status}. Reason: ${reason || 'N/A'}`);

      return res.status(200).json({
        success: true,
        data: { ...data, status_change: status, reason }
      });
    }

    // ==========================================
    // GET /api/users/:id - Get Single User
    // ==========================================
    if (method === 'GET' && pathId && !pathAction) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', pathId)
        .single();

      if (error) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json({ success: true, data });
    }

    // ==========================================
    // GET /api/users - List All Users
    // ==========================================
    if (method === 'GET' && !pathId) {
      const urlParams = new URLSearchParams(url?.split('?')[1] || '');
      const limit = parseInt(urlParams.get('limit') || '50');
      const offset = parseInt(urlParams.get('offset') || '0');
      const status = urlParams.get('status');
      const search = urlParams.get('search');

      let query = supabase
        .from('users')
        .select('*', { count: 'exact' });

      if (status) query = query.eq('status', status);
      if (search) {
        query = query.or(`nickname.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || [],
        pagination: { limit, offset, total: count }
      });
    }

    return res.status(404).json({ error: 'Endpoint not found' });

  } catch (error: any) {
    console.error('Users API error:', error);
    return res.status(500).json({ error: error.message });
  }
}