"""
Proof test: real telemetry on EVSE device stays protected from simulation overwrite.

Run against a live backend:
    python test_real_device_telemetry.py http://localhost:8000

Steps:
1. Find the EVSE device via GET /api/v1/devices
2. PATCH it to execution_mode='simulation' (reset baseline)
3. POST setactivepower with a sentinel value (9876000 mW = 9.876 kW)
4. Sleep 5 seconds (3+ simulation ticks at 1-tick/s)
5. GET the device and assert energy_usage_kw == 9.876 and execution_mode == 'device'
6. PATCH execution_mode back to 'simulation' (cleanup)
7. Sleep 35 seconds (past REAL_DEVICE_STALE_AFTER_S=30)
8. GET the device and assert execution_mode == 'simulation' (staleness fallback)
"""

import sys
import time
import httpx

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8000"
API = f"{BASE}/api/v1"

SENTINEL_MW = 9_876_000   # 9.876 kW in milliwatts
SENTINEL_KW = SENTINEL_MW / 1_000_000  # 9.876

def get_token() -> str:
    r = httpx.post(f"{API}/auth/login", json={"email": "admin@rntbci.io", "password": "Admin@12345"}, timeout=10)
    r.raise_for_status()
    return r.json()["access_token"]

def find_evse(headers: dict) -> dict:
    r = httpx.get(f"{API}/devices", headers=headers, timeout=10)
    r.raise_for_status()
    devices = r.json().get("devices", r.json())
    evse = next((d for d in devices if d["type"] == "energy_evse"), None)
    assert evse, "No energy_evse device found — seed the database first"
    return evse

def patch_device(device_id: str, headers: dict, **fields) -> dict:
    r = httpx.patch(f"{API}/devices/{device_id}", json=fields, headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()

def get_device(device_id: str, headers: dict) -> dict:
    r = httpx.get(f"{API}/devices/{device_id}", headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()

def set_active_power(device_id: str, headers: dict, mw: int) -> None:
    r = httpx.post(
        f"{API}/devices/{device_id}/endpoint/1/cluster/EnergyEVSE/setactivepower",
        json={"ActivePower": mw},
        headers=headers,
        timeout=10,
    )
    r.raise_for_status()

def main():
    print(f"Target: {BASE}")
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    evse = find_evse(headers)
    device_id = evse["id"]
    print(f"EVSE device: {evse['name']} ({device_id})")

    # Step 1 — reset to simulation baseline
    patch_device(device_id, headers, execution_mode="simulation")
    print("✓ Reset execution_mode → simulation")

    # Step 2 — send sentinel real telemetry
    set_active_power(device_id, headers, SENTINEL_MW)
    print(f"✓ Sent ActivePower = {SENTINEL_MW} mW ({SENTINEL_KW} kW)")

    # Step 3 — wait 5s (3+ ticks)
    print("  Waiting 5s for simulation ticks...")
    time.sleep(5)

    # Step 4 — verify real value survived
    d = get_device(device_id, headers)
    kw = d["energy_usage_kw"]
    mode = d["execution_mode"]
    print(f"  energy_usage_kw={kw}  execution_mode={mode}")
    assert mode == "device", f"FAIL: execution_mode should be 'device', got '{mode}'"
    assert abs(kw - SENTINEL_KW) < 0.01, (
        f"FAIL: energy_usage_kw={kw} was overwritten by sim (expected ~{SENTINEL_KW})"
    )
    print("✓ PASS: real telemetry survived 5s of simulation ticks")

    # Step 5 — verify staleness fallback (wait past 30s)
    print("  Waiting 35s to trigger staleness fallback...")
    time.sleep(35)
    d = get_device(device_id, headers)
    mode = d["execution_mode"]
    print(f"  execution_mode after staleness window: {mode}")
    assert mode == "simulation", (
        f"FAIL: expected execution_mode='simulation' after stale window, got '{mode}'"
    )
    print("✓ PASS: staleness fallback reverted device to simulation mode")

    print("\n✅ All assertions passed.")

if __name__ == "__main__":
    main()
