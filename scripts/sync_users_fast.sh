#!/bin/bash
# Fast user sync - fetch all pages from vendor API, upsert to Supabase
set -e

SUPABASE_URL="https://aultuckuvussdyynglkj.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bHR1Y2t1dnVzc2R5eW5nbGtqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg1MjAxNSwiZXhwIjoyMDkxNDI4MDE1fQ.d2S3WymfuQOiu_nzl6AHI_fwsQroM78LXykXR4XcMWA"
MERCHANT_NO="20250902924787"
API_SECRET="99368df20fd10d5322f203435ddc9984"

md5() { echo -n "$1" | md5; }

TS=$(date +%s)000
SIGN=$(md5 "${MERCHANT_NO}${API_SECRET}${TS}")

echo "=== Fetching total user count ==="
FIRST=$(curl -s "https://api.autogcm.com/system/user/list?page=1&pageSize=50&userType=11" \
  -H "merchant-no: $MERCHANT_NO" -H "timestamp: $TS" -H "sign: $SIGN")
TOTAL=$(echo "$FIRST" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total','0'))")
echo "Total users: $TOTAL"

PAGES=$(( (TOTAL + 49) / 50 ))
echo "Pages to fetch: $PAGES"

# Fetch all pages in parallel
TEMP_DIR=$(mktemp -d)
for p in $(seq 1 $PAGES); do
  TS_P=$(date +%s)000
  SIGN_P=$(md5 "${MERCHANT_NO}${API_SECRET}${TS_P}")
  curl -s "https://api.autogcm.com/system/user/list?page=$p&pageSize=50&userType=11" \
    -H "merchant-no: $MERCHANT_NO" -H "timestamp: $TS_P" -H "sign: $SIGN_P" \
    -o "$TEMP_DIR/page_$p.json" &
done
wait

echo "=== Processing users ==="
python3 -c "
import json, os

all_users = []
temp_dir = '$TEMP_DIR'

for f in sorted(os.listdir(temp_dir)):
    with open(os.path.join(temp_dir, f)) as fh:
        data = json.load(fh)
        rows = data.get('rows', [])
        for u in rows:
            all_users.append({
                'user_id': str(u.get('userId', '')),
                'nickName': u.get('nickName', ''),
                'nickname': u.get('nickName', ''),
                'phone': u.get('phonenumber', u.get('phone', '')),
                'email': u.get('email', ''),
                'status': 'ACTIVE' if u.get('status') == '0' else 'INACTIVE',
                'total_weight': 0,
                'total_points': float(u.get('integral', u.get('points', 0)) or 0),
                'last_active_at': u.get('loginDate', u.get('createTime', None)),
                'created_at': u.get('createTime', None)
            })

print(f'Total users fetched: {len(all_users)}')

# Upsert in batches of 100
import requests
supabase_url = '$SUPABASE_URL'
supabase_key = '$SUPABASE_KEY'

batch_size = 100
inserted = 0
for i in range(0, len(all_users), batch_size):
    batch = all_users[i:i+batch_size]
    # Try upsert
    resp = requests.post(
        f'{supabase_url}/rest/v1/users',
        headers={
            'apikey': supabase_key,
            'Authorization': f'Bearer {supabase_key}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        json=batch,
        timeout=10
    )
    if resp.status_code in (200, 201, 204):
        inserted += len(batch)
    else:
        print(f'Batch {i} error: {resp.status_code} {resp.text[:200]}')

print(f'Inserted: {inserted}')
" 2>&1

rm -rf "$TEMP_DIR"

# Verify
echo "=== Verification ==="
python3 -c "
import requests, json
r = requests.get('$SUPABASE_URL/rest/v1/users?select=count', 
    headers={'apikey':'$SUPABASE_KEY', 'Authorization':f'Bearer $SUPABASE_KEY'})
print(f'Supabase users now: {r.json()}')
"
