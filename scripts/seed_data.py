#!/usr/bin/env python3
"""Seed Supabase with realistic RVM data."""

import requests
import uuid
import json

SUPABASE_URL = "https://aultuckuvussdyynglkj.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bHR1Y2t1dnVzc2R5eW5nbGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTIwMTUsImV4cCI6MjA5MTQyODAxNX0.tVNvkGXxGDfAox78vajB3ggS_n5rx_Y80uHSiAKv3-A"
MERCHANT_ID = "11111111-1111-1111-1111-111111111111"
NOW = "2026-04-27T05:00:00.000Z"

HEADERS = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}


def post(table, data):
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, json=data)
    return r


def delete_all(table):
    r = requests.delete(f"{SUPABASE_URL}/rest/v1/{table}?id=neq.none", headers=HEADERS)
    return r


print("🌱 Seeding RVM platform with data...\n")

# Clear existing data
print("🧹 Clearing old data...")
for t in ["users", "machines", "merchant_wallets"]:
    r = delete_all(t)
    print(f"  {'✅' if r.status_code in [200, 204] else '⚠️'} {t}: {r.status_code}")

# Machines
devices = [
    ("071582000001", "RVM Subang Jaya", "Subang Jaya", "online"),
    ("071582000002", "RVM Puchong", "Puchong", "online"),
    ("071582000003", "RVM Sunway", "Sunway", "online"),
    ("071582000004", "RVM KLCC", "KLCC", "online"),
    ("071582000005", "RVM Cheras", "Cheras", "offline"),
    ("071582000006", "RVM Damansara", "Damansara", "online"),
    ("071582000007", "RVM Meranti Apartment", "Meranti Apartment", "warning"),
    ("071582000008", "RVM Bangsar", "Bangsar", "online"),
    ("071582000009", "RVM Petaling Jaya", "Petaling Jaya", "online"),
    ("071582000010", "RVM Shah Alam", "Shah Alam", "online"),
]

print("\n📦 Inserting machines...")
for dev_no, name, loc, status in devices:
    is_active = status != "offline"
    is_manual_offline = status == "offline"
    data = {
        "device_no": dev_no,
        "name": name,
        "location": loc,
        "is_active": is_active,
        "is_manual_offline": is_manual_offline,
        "merchant_id": MERCHANT_ID,
        "created_at": NOW,
    }
    r = post("machines", data)
    mark = "✅" if r.status_code in [200, 201] else "❌"
    print(f"  {mark} {dev_no} - {loc} ({status})")

# Users
users_data = [
    ("Sindylee", 125.6, 1256),
    ("EcoWarrior", 98.3, 983),
    ("GreenHero", 87.2, 872),
    ("RecycleKing", 76.5, 765),
    ("EarthSaver", 65.8, 658),
    ("PlasticFree", 54.3, 543),
    ("GreenMachine", 43.7, 437),
    ("EcoFriendly", 32.9, 329),
    ("WasteWarrior", 21.5, 215),
    ("RecyclePro", 15.2, 152),
]

print("\n👤 Creating users with recycling data...")
user_ids = {}
for name, weight, points in users_data:
    uid = str(uuid.uuid4())
    data = {
        "id": uid,
        "user_id": uid,
        "nickName": name,
        "total_weight": weight,
        "total_points": points,
        "status": "ACTIVE",
        "created_at": NOW,
        "updated_at": NOW,
    }
    r = post("users", data)
    if r.status_code in [200, 201]:
        print(f"  ✅ {name} - {weight}kg, {points}pts")
        user_ids[name] = uid
    else:
        print(f"  ❌ {name}: {r.status_code} {r.text}")

# Merchant wallet for top user
if "EcoWarrior" in user_ids:
    print("\n📊 Creating merchant wallet...")
    wallet_data = {
        "merchant_id": MERCHANT_ID,
        "user_id": user_ids["EcoWarrior"],
        "total_earnings": 983,
        "total_weight": 98.3,
        "current_balance": 983,
    }
    r = post("merchant_wallets", wallet_data)
    mark = "✅" if r.status_code in [200, 201] else "❌"
    print(f"  {mark} Wallet for EcoWarrior")

print("\n🌱 DONE!")
print(f"  ✅ {len(devices)} machines inserted")
print(f"  ✅ {len(users_data)} users inserted")
print(f"  ✅ 1 merchant wallet created")
print("\n🔗 https://rvm-merchant-platform-main.vercel.app")
