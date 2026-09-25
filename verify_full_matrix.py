"""Full verification script for Parts B and C."""
import sys
import time
import json
import httpx

sys.stdout.reconfigure(line_buffering=True)

BASE = "http://localhost:8000"
API = f"{BASE}/api/v1"

def print_req_resp(title: str, method: str, url: str, headers: dict, body: dict = None, resp: httpx.Response = None):
    print(f"\n=======================================================")
    print(f"STEP: {title}")
    print(f"REQUEST: {method} {url}")
    if headers:
        auth_hdr = headers.get("Authorization", "")
        masked_auth = f"{auth_hdr[:15]}...{auth_hdr[-5:]}" if len(auth_hdr) > 20 else auth_hdr
        print(f"HEADERS: Authorization: {masked_auth}")
    if body is not None:
        print(f"REQ BODY:\n{json.dumps(body, indent=2)}")
    if resp is not None:
        print(f"RESPONSE STATUS: {resp.status_code}")
        try:
            print(f"RESP BODY:\n{json.dumps(resp.json(), indent=2)}")
        except Exception:
            print(f"RESP TEXT: {resp.text[:200]}")

def get_token() -> str:
    r = httpx.post(f"{API}/auth/login", json={"email": "admin@rntbci.io", "password": "Admin@12345"}, timeout=10)
    r.raise_for_status()
    return r.json()["access_token"]

def run_tests():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Fetch devices
    r = httpx.get(f"{API}/devices", headers=headers, timeout=10)
    r.raise_for_status()
    devices = r.json().get("devices", r.json())
    
    evse = next(d for d in devices if d["type"] == "energy_evse")
    hvac = next(d for d in devices if d["type"] == "hvac")
    light = next(d for d in devices if d["type"] == "smart_light")
    
    test_devices = [
        ("EVSE (regression baseline)", evse, 7400000, 230000, 32174, 7.4),
        ("HVAC (generic device 1)", hvac, 2500000, 230000, 10869, 2.5),
        ("Smart Light (generic device 2)", light, 60000, 230000, 260, 0.06),
    ]
    
    print("\n######################################################################")
    print("PART B: FULL MATRIX TEST (EVSE, HVAC, SMART LIGHT)")
    print("######################################################################")
    
    for label, dev, power_mw, volt_mv, curr_ma, expected_kw in test_devices:
        dev_id = str(dev["id"])
        dev_type = dev["type"]
        print(f"\n>>>>>>>> TESTING DEVICE: {label} [{dev_type}] (ID: {dev_id}) <<<<<<<<")
        
        # Step 1: POST /{device_id}/enable (generic route)
        url = f"{API}/devices/{dev_id}/enable"
        r = httpx.post(url, json={}, headers=headers, timeout=10)
        print_req_resp(f"1. Enable Device ({dev_type})", "POST", url, headers, {}, r)
        assert r.status_code == 200, f"Enable failed: {r.text}"
        
        # Step 2: GET /{device_id}
        url = f"{API}/devices/{dev_id}"
        r = httpx.get(url, headers=headers, timeout=10)
        print_req_resp(f"2. Confirm Device State Post-Enable ({dev_type})", "GET", url, headers, None, r)
        d = r.json()
        assert d["execution_mode"] == "device"
        assert d["power_state"] == "on"
        assert d["status"] == "online"
        assert d["connectivity"] == "connected"
        assert "_last_real_telemetry_ts" in d["metadata"]
        
        # Step 3: POST /{device_id}/telemetry/setactivepower
        url = f"{API}/devices/{dev_id}/telemetry/setactivepower"
        body = {"ActivePower": power_mw}
        r = httpx.post(url, json=body, headers=headers, timeout=10)
        print_req_resp(f"3. Set ActivePower ({dev_type})", "POST", url, headers, body, r)
        assert r.status_code == 200
        
        # Step 4: POST /{device_id}/telemetry/setvoltage
        url = f"{API}/devices/{dev_id}/telemetry/setvoltage"
        body = {"Voltage": volt_mv}
        r = httpx.post(url, json=body, headers=headers, timeout=10)
        print_req_resp(f"4. Set Voltage ({dev_type})", "POST", url, headers, body, r)
        assert r.status_code == 200
        
        # Step 5: POST /{device_id}/telemetry/setactivecurrent
        url = f"{API}/devices/{dev_id}/telemetry/setactivecurrent"
        body = {"ActiveCurrent": curr_ma}
        r = httpx.post(url, json=body, headers=headers, timeout=10)
        print_req_resp(f"5. Set ActiveCurrent ({dev_type})", "POST", url, headers, body, r)
        assert r.status_code == 200
        
        # Step 6: GET /{device_id}
        url = f"{API}/devices/{dev_id}"
        r = httpx.get(url, headers=headers, timeout=10)
        print_req_resp(f"6. Confirm Telemetry and No EVSE Leakage ({dev_type})", "GET", url, headers, None, r)
        d = r.json()
        meta = d["metadata"]
        assert meta["ActivePower"] == power_mw
        assert meta["Voltage"] == volt_mv
        assert meta["ActiveCurrent"] == curr_ma
        assert abs(d["energy_usage_kw"] - expected_kw) < 0.01
        if dev_type != "energy_evse":
            assert "State" not in meta, f"EVSE State leaked into {dev_type}"
            assert "SupplyState" not in meta, f"EVSE SupplyState leaked into {dev_type}"
            
        # Step 7: POST /{device_id}/disable
        url = f"{API}/devices/{dev_id}/disable"
        r = httpx.post(url, json={}, headers=headers, timeout=10)
        print_req_resp(f"7. Disable Device ({dev_type})", "POST", url, headers, {}, r)
        assert r.status_code == 200
        
        # Step 8: GET /{device_id}
        url = f"{API}/devices/{dev_id}"
        r = httpx.get(url, headers=headers, timeout=10)
        print_req_resp(f"8. Confirm State Post-Disable ({dev_type})", "GET", url, headers, None, r)
        d = r.json()
        assert d["power_state"] == "off"
        assert d["execution_mode"] == "simulation"
        assert d["status"] == "online"
        assert d["connectivity"] == "connected"
        assert d["energy_usage_kw"] == 0.0
        assert d["metadata"]["Voltage"] == 0
        assert d["metadata"]["ActiveCurrent"] == 0
        assert d["metadata"]["ActivePower"] == 0
        
        # Step 9: Wait 35+s with device re-enabled
        url = f"{API}/devices/{dev_id}/enable"
        r = httpx.post(url, json={}, headers=headers, timeout=10)
        assert r.status_code == 200
        print(f"  Re-enabled {dev_type}. Waiting 35s for staleness window (REAL_DEVICE_STALE_AFTER_S=30)...")
        time.sleep(35)
        url = f"{API}/devices/{dev_id}"
        r = httpx.get(url, headers=headers, timeout=10)
        print_req_resp(f"9. Confirm Staleness Reversion to Simulation ({dev_type})", "GET", url, headers, None, r)
        d = r.json()
        assert d["execution_mode"] == "simulation", f"Expected simulation mode after staleness, got {d['execution_mode']}"
        print(f"✓ Staleness successfully reverted {dev_type} to simulation mode!")

    print("\n######################################################################")
    print("PART C: AUTH REGRESSION TESTS")
    print("######################################################################")
    
    sample_id = str(hvac["id"])
    routes_to_test = [
        ("POST", f"{API}/devices/{sample_id}/enable", {}),
        ("GET", f"{API}/devices/{sample_id}", None),
        ("POST", f"{API}/devices/{sample_id}/telemetry/setactivepower", {"ActivePower": 1000}),
        ("POST", f"{API}/devices/{sample_id}/telemetry/setvoltage", {"Voltage": 230000}),
        ("POST", f"{API}/devices/{sample_id}/telemetry/setactivecurrent", {"ActiveCurrent": 5000}),
        ("POST", f"{API}/devices/{sample_id}/disable", {}),
    ]
    
    print("\n--- C1: Authenticated endpoints called with NO Authorization header (must return 401) ---")
    for method, url, body in routes_to_test:
        if method == "POST":
            r = httpx.post(url, json=body, timeout=10)
        else:
            r = httpx.get(url, timeout=10)
        print_req_resp("No-Auth Probe", method, url, {}, body, r)
        assert r.status_code == 401, f"Expected 401 for {url}, got {r.status_code}"
    print("✓ All Part B routes correctly returned 401 without auth.")

    print("\n--- C2: 4 Known Public Routes called with NO Authorization header (must succeed 200) ---")
    public_routes = [
        ("GET", f"{API}/devices/public/device-data", None),
        ("POST", f"{API}/devices/public/matter/migrate-schemas", {}),
        ("GET", f"{API}/devices/public/export/csv", None),
        ("POST", f"{API}/devices/public/light/{light['id']}/webhook", {"webhook_url": "http://example.com/webhook"}),
    ]
    for method, url, body in public_routes:
        if method == "POST":
            r = httpx.post(url, json=body, timeout=10)
        else:
            r = httpx.get(url, timeout=10)
        print_req_resp("Public Route Probe", method, url, {}, body, r)
        assert r.status_code in (200, 201), f"Expected 200/201 for public route {url}, got {r.status_code}"
    print("✓ All 4 public routes succeeded without auth.")

    print("\n--- C3: Authenticated routes called with valid JWT (must succeed 200) ---")
    r = httpx.get(f"{API}/devices/{sample_id}", headers=headers, timeout=10)
    print_req_resp("JWT Auth Probe", "GET", f"{API}/devices/{sample_id}", headers, None, r)
    assert r.status_code == 200
    print("✓ Authenticated routes succeed with valid JWT token.")

    print("\n=======================================================")
    print("ALL PART B AND PART C VERIFICATIONS COMPLETED SUCCESSFULLY!")
    print("=======================================================")

if __name__ == "__main__":
    run_tests()
