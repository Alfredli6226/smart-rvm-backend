import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('[Admin Investors] Env check:', { 
  hasUrl: !!supabaseUrl, 
  hasKey: !!supabaseServiceKey,
  keyPrefix: supabaseServiceKey?.substring(0, 20) || 'undefined',
  envKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
});

function generateTempPassword(length: number = 8): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

function generateVendorUserNo(): string {
  return 'INV' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Admin Investors] Missing env vars', { supabaseUrl, hasKey: !!supabaseServiceKey });
    return res.status(500).json({ error: 'Server Configuration Error' });
  }

  // Check if using anon key (won't work for admin operations)
  if (supabaseServiceKey === process.env.VITE_SUPABASE_ANON_KEY) {
    console.error('[Admin Investors] FATAL: Using anon key - cannot perform admin operations');
    return res.status(500).json({ error: 'Server misconfigured: Missing SUPABASE_SERVICE_ROLE_KEY' });
  }

  console.log('[Admin Investors] Key is service role key, proceeding...');

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { method, url, headers } = req;
  const pathParts = (url || '').replace('/api/admin/investors', '').split('/').filter(Boolean);
  const pathId = pathParts[0] || null;

  // ==========================================
  // GET /api/admin/investors - Test endpoint
  // ==========================================
  if (method === 'GET' && !pathId) {
    console.log('[Admin Investors] Test endpoint hit');
    return res.status(200).json({ 
      success: true, 
      message: 'API is working',
      envCheck: { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseServiceKey,
        keyPrefix: supabaseServiceKey?.substring(0, 10)
      }
    });
  }

  try {
    console.log('[Admin Investors] Request:', req.method, pathId);
    
    // ==========================================
    // Authorization Check
    // ==========================================
    const authHeader = headers.authorization;
    if (!authHeader) {
      console.warn('[Admin Investors] No auth header');
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[Admin Investors] Verifying token...');

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError) {
      console.error('[Admin Investors] Auth error:', authError);
      return res.status(401).json({ error: 'Invalid authorization' });
    }

    if (!authUser?.email) {
      console.warn('[Admin Investors] No email in token');
      return res.status(401).json({ error: 'Invalid authorization' });
    }

    console.log('[Admin Investors] User:', authUser.email);

    const { data: adminData, error: adminError } = await supabase
      .from('app_admins')
      .select('role')
      .eq('email', authUser.email)
      .single();

    if (adminError) {
      console.error('[Admin Investors] Admin check error:', adminError);
    }

    if (!adminData || adminData.role !== 'SUPER_ADMIN') {
      console.warn('[Admin Investors] Not super admin:', adminData);
      return res.status(403).json({ error: 'Access denied. Super Admin only.' });
    }

    console.log('[Admin Investors] Authorized as SUPER_ADMIN');

    // ==========================================
    // POST /api/admin/investors - Create Investor
    // ==========================================
    if (method === 'POST' && !pathId) {
      const body = req.body;
      console.log('[Admin Investors] Body:', body);

      const { name, email, companyName, machineIds } = body || {};

      if (!name || !email || !companyName) {
        return res.status(400).json({ error: 'name, email, and companyName are required' });
      }

      const machineIdsArray = Array.isArray(machineIds) ? machineIds : [];
      const tempPassword = generateTempPassword();
      const vendorUserNo = generateVendorUserNo();

      console.log('[Admin Investors] Creating user:', email);

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { nickname: name }
      });

      if (authError) {
        console.error('[Create Investor] Auth error:', authError);
        return res.status(400).json({ error: authError.message });
      }

      const userId = authData.user?.id;
      if (!userId) {
        console.error('[Create Investor] No user ID returned');
        return res.status(500).json({ error: 'Failed to create auth user' });
      }

      console.log('[Create Investor] User ID:', userId);

      const { error: userError } = await supabase.from('users').insert({
        id: userId,
        vendor_user_no: vendorUserNo,
        phone: '',
        email,
        nickname: name,
        company_name: companyName,
        role: 'investor',
        lifetime_integral: 0,
        created_at: new Date().toISOString()
      });

      if (userError) {
        console.error('[Create Investor] User insert error:', userError);
        try {
          await supabase.auth.admin.deleteUser(userId);
        } catch (e) {
          console.error('[Create Investor] Cleanup delete failed:', e);
        }
        return res.status(400).json({ error: userError.message });
      }

      if (machineIdsArray.length > 0) {
        console.log('[Create Investor] Updating machines:', machineIdsArray);
        const { error: machineError } = await supabase
          .from('machines')
          .update({ investor_id: userId })
          .in('id', machineIdsArray);

        if (machineError) {
          console.warn('[Create Investor] Machine update warning:', machineError.message);
        }
      }

      console.log('[Create Investor] Success:', userId);

      return res.status(201).json({
        success: true,
        data: {
          investor_id: userId,
          email,
          temporary_password: tempPassword
        }
      });
    }

    return res.status(404).json({ error: 'Endpoint not found' });

  } catch (error: any) {
    console.error('[Admin Investors API] Uncaught error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}