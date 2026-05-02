#!/usr/bin/env python3
"""Sync vendor API data directly into Supabase using service_role key."""
import json
import hashlib
import time
import urllib.request
import urllib.parse

MERCHANT_NO = "20250902924787"
API_SECRET = "99368df20fd10d5322f203435ddc9984"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bHR1Y2t1dnVzc2R5eW5nbGtqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg1MjAxNSwiZXhwIjoyMDkxNDI4MDE1fQ.d2S3WymfuQOiu_nzl6AHI_fwsQroM78LXykXR4XcMWA"
SUPABASE_BASE = "https://aultuckuvussdyynglkj.supabase.co/rest/v1"
VENDOR_BASE = "https://api.autogcm.com"

def vendor_get(path, params=None):
    ts = str(int(time.time() * 1000))
    sign_str = f"{MERCHANT_NO}{API_SECRET}{ts}"
    sign = hashlib.md5(sign_str.encode('utf-8')).hexdigest()
    
    url = f"{VENDOR_BASE}{path}"
    if params:
        qs = urllib.parse.urlencode(params)
        url = f"{url}?{qs}"
    
    req = urllib.request.Request(url, headers={
        'merchant-no': MERCHANT_NO,
        'timestamp': ts,
        'sign': sign
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"  ERROR fetching {path}: {e}")
        return None

def supabase_req(method, path, data=None, query=None):
    url = f"{SUPABASE_BASE}{path}"
    if query:
        qs = urllib.parse.urlencode(query)
        url = f"{url}?{qs}"
    
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method, headers={
        'apikey': SERVICE_KEY,
        'Authorization': f'Bearer {SERVICE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode()
    except Exception as e:
        return f"ERROR: {e}"

def sync_machines():
    print("=== Syncing Machines ===")
    resp = vendor_get('/system/device/list')
    if not resp or resp.get('code') != 200:
        print(f"  Vendor API error: {resp}")
        return
    
    devices = resp['data']['list']
    print(f"  Found {len(devices)} devices from vendor")
    
    for dev in devices:
        rec = {
            'device_no': dev['deviceNo'],
            'name': dev.get('deviceName', dev['deviceNo']),
            'location': (dev.get('address', '') or '')[:200],
            'is_active': dev.get('status') == 1,
            'is_manual_offline': dev.get('isOnline') != 1,
            'address': dev.get('address', '') or '',
            'latitude': dev.get('latitude', 0),
            'longitude': dev.get('longitude', 0),
            'zone': dev.get('deptName', '') or '',
            'merchant_id': '11111111-1111-1111-1111-111111111111'
        }
        
        # Check if exists
        q = {'device_no': f"eq.{dev['deviceNo']}"}
        check = supabase_req('GET', '/machines', query=q)
        
        if check and 'ERROR' not in check and len(check) > 3:
            # Update
            supabase_req('PATCH', '/machines', data=rec, query=q)
            print(f"  ✓ UPDATE {dev['deviceNo']} - {rec['name']}")
        else:
            # Insert
            supabase_req('POST', '/machines', data=rec)
            print(f"  ✓ INSERT {dev['deviceNo']} - {rec['name']}")

def sync_users():
    print("\n=== Syncing Users ===")
    page = 1
    total = 0
    page_size = 50
    
    while True:
        resp = vendor_get('/system/user/list', {
            'userType': '11',
            'pageNum': str(page),
            'pageSize': str(page_size)
        })
        
        if not resp or resp.get('code') != 200:
            print(f"  Stopping at page {page}: {resp}")
            break
        
        rows = resp.get('rows', [])
        if not rows:
            break
        
        if page == 1:
            print(f"  Total users (vendor): {resp.get('total', '?')}")
        
        for u in rows:
            ui = u.get('userInfo', {}) or {}
            # Generate a deterministic UUID from vendor user_id
            vid = str(u['userId'])
            # Use the vendor user_id directly as user_id
            rec = {
                'user_id': vid,
                'nickName': u.get('nickName', '') or '',
                'phone': u.get('phonenumber', '') or '',
                'email': u.get('email', '') or '',
                'status': 'ACTIVE' if u.get('status') == '0' else 'INACTIVE',
                'total_weight': float(ui.get('amount', 0) or 0),
                'total_points': float(ui.get('pointsBalance', 0) or 0),
                'created_at': u.get('createTime', None),
                'last_active_at': u.get('loginDate', None),
            }
            
            q = {'user_id': f"eq.{vid}"}
            check = supabase_req('GET', '/users', query={'user_id': f"eq.{vid}", 'limit': '1'})
            
            if check and 'ERROR' not in check and len(check) > 3:
                supabase_req('PATCH', '/users', data=rec, query=q)
            else:
                supabase_req('POST', '/users', data=rec)
            total += 1
        
        print(f"  Page {page}: +{len(rows)} users (total: {total})")
        page += 1
    
    print(f"  DONE: {total} users synced")

if __name__ == '__main__':
    sync_machines()
    sync_users()
    print("\n=== ALL DONE ===")
