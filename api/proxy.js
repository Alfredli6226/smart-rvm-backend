// Real-time Vendor API Proxy — talks to api.autogcm.com open endpoints
// Frontend calls this via POST from autogcm.ts service
import crypto from 'crypto';

const MERCHANT_NO = process.env.MERCHANT_NO || process.env.VITE_MERCHANT_NO || '20250902924787';
const API_SECRET = process.env.API_SECRET || process.env.SECRET || process.env.VITE_API_SECRET || '99368df20fd10d5322f203435ddc9984';
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    // Health check
    return res.status(200).json({ status: 'ok', proxy: 'live' });
  }

  try {
    const { endpoint, method, params, body } = req.body || {};

    if (!endpoint) {
      return res.status(400).json({ code: 400, error: 'endpoint required' });
    }

    const url = new URL(endpoint, VENDOR_BASE);
    const headers = vHeaders();

    let vendorRes;
    if (method === 'GET' || method === undefined) {
      // Attach params as query string
      if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
      }
      vendorRes = await fetch(url.toString(), { headers });
    } else if (method === 'DELETE') {
      // DELETE with optional body
      const opts = { method: 'DELETE', headers };
      if (body) {
        headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      vendorRes = await fetch(url.toString(), opts);
    } else {
      // POST, PUT, PATCH with JSON body
      headers['Content-Type'] = 'application/json';
      vendorRes = await fetch(url.toString(), {
        method: method || 'POST',
        headers,
        body: JSON.stringify(body || {})
      });
    }

    const text = await vendorRes.text();

    // Try JSON parse
    try {
      const json = JSON.parse(text);
      return res.status(200).json(json);
    } catch {
      return res.status(200).send(text);
    }
  } catch (e) {
    console.error('Proxy error:', e.message);
    return res.status(500).json({ code: 500, error: e.message });
  }
}
