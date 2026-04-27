#!/usr/bin/env python3
"""Batch sync remaining users from vendor API to Supabase"""
import json
import urllib.request
import hashlib
import time
import sys

MERCHANT_NO = "20250902924787"
API_SECRET = "99368df20fd10d5322f203435ddc9984"
SUPABASE_URL = "https://aultuckuvussdyynglkj.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bHR1Y2t1dnVzc2R5eW5nbGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTIwMTUsImV4cCI6MjA5MTQyODAxNX0.tVNvkGXxGDfAox78vajB3ggS_n5rx_Y80uHSiAKv3-A"

START_PAGE = int(sys.argv[1]) if len(sys.argv) > 1 else 1
END_PAGE = int(sys.argv[2]) if len(sys.argv) > 2 else 24

def sign(ts):
    raw = f"{MERCHANT_NO}{API_SECRET}{ts}"
    return hashlib.md5(raw.encode()).hexdigest()

def vendor_get(path, params):
    ts = str(int(time.time() * 1000))
    url = f"https://api.autogcm.com{path}?" + "&".join(f"{k}={urllib.request.quote(str(v))}" for k,v in params.items())
    req = urllib.request.Request(url, headers={
        "merchant-no": MERCHANT_NO,
        "timestamp": ts,
        "sign": sign(ts)
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())

def supabase_request(method, path, data=None):
    url = f"{SUPABASE_URL}{path}"
    headers = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15):
            return True
    except urllib.error.HTTPError as e:
        if e.code == 409:  # Duplicate - ignore
            return True
        print(f"  HTTP {e.code}: {e.read().decode()[:200]}")
        return False

total_synced = 0
total_errors = 0

for page in range(START_PAGE, END_PAGE + 1):
    try:
        result = vendor_get("/system/user/list", {
            "userType": "11",
            "pageNum": str(page),
            "pageSize": "50"
        })
        
        rows = result.get("rows", [])
        if not rows:
            print(f"Page {page}: empty, stopping")
            break
        
        page_synced = 0
        page_errors = 0
        
        for u in rows:
            try:
                ui = u.get("userInfo", {})
                user_id = str(u["userId"])
                
                # Check if exists
                check_req = urllib.request.Request(
                    f"{SUPABASE_URL}/rest/v1/users?user_id=eq.{user_id}&select=id",
                    headers={"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}"}
                )
                with urllib.request.urlopen(check_req, timeout=10) as cr:
                    existing = json.loads(cr.read())
                
                record = {
                    "user_id": user_id,
                    "nickName": u.get("nickName", ""),
                    "phone": u.get("phonenumber", ""),
                    "email": u.get("email", ""),
                    "status": "ACTIVE" if u.get("status") == "0" else "INACTIVE",
                    "total_weight": float(ui.get("amount", 0) or 0),
                    "total_points": float(ui.get("pointsBalance", 0) or 0),
                }
                
                if existing:
                    ok = supabase_request("PATCH", f"/rest/v1/users?user_id=eq.{user_id}", record)
                else:
                    ok = supabase_request("POST", "/rest/v1/users", record)
                
                if ok:
                    page_synced += 1
                else:
                    page_errors += 1
            except Exception as e:
                page_errors += 1
        
        total_synced += page_synced
        total_errors += page_errors
        total = result.get("total", 0)
        print(f"Page {page}/{END_PAGE} ({total} total): +{page_synced} synced, {page_errors} errors | Running: {total_synced} synced, {total_errors} errors")
        
    except Exception as e:
        print(f"Page {page}: FAILED - {e}")
        total_errors += 50

print(f"\n=== DONE ===")
print(f"Total synced: {total_synced}")
print(f"Total errors: {total_errors}")
