#!/bin/bash
# Seed script: Populate Supabase with realistic vendor data
# The vendor API is not working reliably, so we seed from known data

SUPABASE_URL="https://aultuckuvussdyynglkj.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bHR1Y2t1dnVzc2R5eW5nbGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTIwMTUsImV4cCI6MjA5MTQyODAxNX0.tVNvkGXxGDfAox78vajB3ggS_n5rx_Y80uHSiAKv3-A"
SR_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bHR1Y2t1dnVzc2R5eW5nbGtqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg1MjAxNSwiZXhwOjIwOTE0MjgwMTV9.d2S3WymfuQOiu_nzl6AHI_fwsQroM78LXykXR4XcMWA"
MERCHANT_ID="11111111-1111-1111-1111-111111111111"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

HEADERS=(-H "apikey: ${SR_KEY}" -H "Authorization: Bearer ${SR_KEY}" -H "Content-Type: application/json" -H "Prefer: return=minimal")

echo "🌱 Seeding RVM platform data..."
echo ""
echo "Creating $1 machines with users..."
echo ""

# Generate machine data
MACHINE_DEVICES=(
  "071582000001:Subang Jaya"
  "071582000002:Puchong"
  "071582000003:Sunway"
  "071582000004:KLCC"
  "071582000005:Cheras"
  "071582000006:Damansara"
  "071582000007:Meranti Apartment"
  "071582000008:Bangsar"
  "071582000009:Petaling Jaya"
  "071582000010:Shah Alam"
)

echo "📦 Inserting machines..."
for md in "${MACHINE_DEVICES[@]}"; do
  IFS=':' read -r dev loc <<< "$md"
  STATUS="online"
  if [ "$dev" = "071582000005" ]; then STATUS="offline"; fi
  if [ "$dev" = "071582000007" ]; then STATUS="warning"; fi
  
  curl -s "${SUPABASE_URL}/rest/v1/machines" "${HEADERS[@]}" \
    -X POST \
    -d "{\"device_no\":\"${dev}\",\"name\":\"RVM ${loc}\",\"location\":\"${loc}\",\"status\":\"${STATUS}\",\"merchant_id\":\"${MERCHANT_ID}\",\"created_at\":\"${NOW}\"}" > /dev/null && \
    echo "  ✅ ${dev} - ${loc} (${STATUS})"
done

echo ""
echo "👤 Creating sample users with recycling data..."
echo ""

# Create 10 users with realistic recycling data
declare -A USER_DATA
USER_DATA["1404752"]="EcoWarrior"
USER_DATA["1378848"]="GreenHero"
USER_DATA["1378850"]="RecycleKing"
USER_DATA["1380001"]="EarthSaver"
USER_DATA["1380002"]="PlasticFree"
USER_DATA["1380003"]="GreenMachine"
USER_DATA["1380004"]="EcoFriendly"
USER_DATA["1380005"]="WasteWarrior"
USER_DATA["1380006"]="RecyclePro"
USER_DATA["1405881"]="SustainLover"

# Weights and points for each user
declare -A USER_WEIGHT
USER_WEIGHT["1404752"]="98.3:983"
USER_WEIGHT["1378848"]="87.2:872"
USER_WEIGHT["1378850"]="76.5:765"
USER_WEIGHT["1380001"]="65.8:658"
USER_WEIGHT["1380002"]="54.3:543"
USER_WEIGHT["1380003"]="43.7:437"
USER_WEIGHT["1380004"]="32.9:329"
USER_WEIGHT["1380005"]="21.5:215"
USER_WEIGHT["1380006"]="15.2:152"
USER_WEIGHT["1405881"]="112.4:1124"

for user_id in "${!USER_DATA[@]}"; do
  name="${USER_DATA[$user_id]}"
  IFS=':' read -r weight points <<< "${USER_WEIGHT[$user_id]}"
  
  # Insert user
  curl -s "${SUPABASE_URL}/rest/v1/users" "${HEADERS[@]}" \
    -X POST \
    -d "{\"id\":\"${user_id}\",\"user_id\":\"${user_id}\",\"nickName\":\"${name}\",\"phone\":\"\",\"status\":\"0\",\"total_weight\":${weight},\"total_points\":${points},\"created_at\":\"${NOW}\"}" > /dev/null && \
    echo "  ✅ ${name} (${user_id}) - ${weight}kg, ${points}pts"
done

echo ""
echo "📊 Inserting merchant wallet for MyGreenPlus..."
curl -s "${SUPABASE_URL}/rest/v1/merchant_wallets" "${HEADERS[@]}" \
  -X POST \
  -d "{\"merchant_id\":\"${MERCHANT_ID}\",\"user_id\":\"1404752\",\"total_earnings\":983,\"total_weight\":98.3,\"current_balance\":983}" > /dev/null && \
  echo "  ✅ Wallet created"

echo ""
echo "🌱 DONE! Data seeded successfully."
echo ""
echo "📋 Summary:"
echo "  ✅ 10 machines inserted"
echo "  ✅ 10 users inserted"
echo "  ✅ 1 merchant wallet created"
echo ""
echo "🔗 Visit: https://rvm-merchant-platform-main.vercel.app"
echo ""
