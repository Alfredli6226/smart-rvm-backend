// ===== Create Supabase Auth User — Direct REST API approach =====
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, msg: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, msg: 'Email and password required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, msg: 'Password must be at least 6 characters' });
  }

  try {
    // Attempt 1: Use Admin API directly via REST (bypasses Supabase JS client issues)
    const adminRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { created_via: 'admin_manager' }
      })
    });

    const adminData = await adminRes.json();

    if (adminRes.ok && adminData?.id) {
      // Success — user created with email confirmed
      return res.json({
        success: true,
        msg: 'Account created. User can log in now.',
        userId: adminData.id,
      });
    }

    // If admin API says user already exists and is confirmed, that's fine too
    const errMsg = (adminData?.msg || adminData?.error_description || '').toLowerCase();
    if (!adminRes.ok && (errMsg.includes('already exists') || errMsg.includes('already registered'))) {
      // User exists — try to update password
      const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${adminData.id}`, {
        method: 'PUT',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password, email_confirm: true })
      });
      
      if (updateRes.ok) {
        return res.json({ success: true, msg: 'Password updated. User can log in now.' });
      }
    }

    // Fallback: Use signUp (sends confirmation email)
    const anonKey = SUPABASE_ANON_KEY || SUPABASE_KEY;
    const signUpRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const signUpData = await signUpRes.json();

    if (signUpRes.ok && signUpData?.id) {
      const identities = signUpData.identities || [];
      return res.json({
        success: true,
        msg: identities.length > 0
          ? 'Account created. User can log in now.'
          : 'Confirmation email sent. Check inbox/spam folder.',
        userId: signUpData.id,
        needsConfirmation: identities.length === 0
      });
    }

    // Last resort: return the actual error
    return res.status(500).json({
      success: false,
      msg: signUpData?.msg || signUpData?.error_description || 'Failed to create user'
    });

  } catch (err) {
    console.error('Create user error:', err.message);
    return res.status(500).json({ success: false, msg: err.message });
  }
}
