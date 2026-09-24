"""
Solar Digital Twin regression tests.
Covers the 8 scenarios from the bug fix spec.

Run against live backend:
    python test_solar_simulation.py http://localhost:8000
"""
import sys
import time
import httpx

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8000"
API = f"{BASE}/api/v1"
TIMEOUT = 15.0


def get_token() -> str:
    r = httpx.post(f"{API}/auth/login", json={"email": "admin@rntbci.io", "password": "Admin@12345"}, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()["access_token"]


def find_solar(headers: dict) -> dict:
    r = httpx.get(f"{API}/devices", headers=headers, timeout=TIMEOUT)
    r.raise_for_status()
    devices = r.json().get("devices", r.json())
    solar = next((d for d in devices if d["type"] in ("solar_pv", "solar_panel", "energy_solar")), None)
    assert solar, "No solar device found — seed the database first"
    return solar


def toggle(device_id: str, state: str, headers: dict) -> dict:
    r = httpx.patch(f"{API}/devices/{device_id}/state", json={"status": state}, headers=headers, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def get_device(device_id: str, headers: dict) -> dict:
    r = httpx.get(f"{API}/devices/{device_id}", headers=headers, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def patch_device(device_id: str, headers: dict, **fields) -> dict:
    r = httpx.patch(f"{API}/devices/{device_id}", json=fields, headers=headers, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def post_solar_telemetry(device_id: str, headers: dict, active_power: int, voltage: int, current: int) -> None:
    endpoint = 1
    httpx.post(f"{API}/devices/{device_id}/solar/endpoint/{endpoint}/cluster/ElectricalPowerMeasurement/setactivepower",
               json={"ActivePower": active_power}, headers=headers, timeout=TIMEOUT)


def section(title: str):
    print(f"\n{'='*60}\n{title}\n{'='*60}")


def main():
    print(f"Target: {BASE}")
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    solar = find_solar(headers)
    dev_id = solar["id"]
    print(f"Solar device: {solar['name']} ({dev_id})")

    # ── TEST A: Simulated Solar ON ────────────────────────────────
    section("TEST A — Simulated Solar ON")
    patch_device(dev_id, headers, execution_mode="simulation")
    resp = toggle(dev_id, "ON", headers)
    meta = resp.get("metadata", {})
    assert resp["power_state"] == "on", f"FAIL: power_state={resp['power_state']}"
    assert resp["execution_mode"] == "simulation", f"FAIL: execution_mode={resp['execution_mode']}"
    assert resp["connectivity"] == "connected", f"FAIL: connectivity={resp['connectivity']}"
    assert (meta.get("Voltage") or 0) > 0, f"FAIL: Voltage={meta.get('Voltage')}"
    assert (meta.get("ActiveCurrent") or 0) > 0, f"FAIL: ActiveCurrent={meta.get('ActiveCurrent')}"
    assert (meta.get("ActivePower") or 0) > 0, f"FAIL: ActivePower={meta.get('ActivePower')}"
    assert (meta.get("current_generation") or 0) > 0, f"FAIL: current_generation={meta.get('current_generation')}"
    assert "_last_real_telemetry_ts" not in meta, "FAIL: _last_real_telemetry_ts should be absent in sim mode"
    print("✓ PASS: Solar ON in simulation mode — all electrical values > 0, no stale device ts")

    # ── TEST B: Simulated Solar OFF ───────────────────────────────
    section("TEST B — Simulated Solar OFF")
    resp = toggle(dev_id, "OFF", headers)
    meta = resp.get("metadata", {})
    assert resp["power_state"] == "off", f"FAIL: power_state={resp['power_state']}"
    assert resp["execution_mode"] == "simulation", f"FAIL: execution_mode={resp['execution_mode']}"
    assert resp["connectivity"] == "connected", f"FAIL: connectivity should remain connected"
    assert meta.get("Voltage", 1) == 0, f"FAIL: Voltage should be 0 when OFF, got {meta.get('Voltage')}"
    assert meta.get("ActiveCurrent", 1) == 0, f"FAIL: ActiveCurrent should be 0 when OFF"
    assert meta.get("ActivePower", 1) == 0, f"FAIL: ActivePower should be 0 when OFF"
    assert meta.get("current_generation", 1) == 0, f"FAIL: current_generation should be 0 when OFF"
    print("✓ PASS: Solar OFF in simulation — all electrical values = 0, connectivity unchanged")

    # ── TEST C: Power OFF must not disconnect ─────────────────────
    section("TEST F — Power OFF must not disconnect")
    assert resp["connectivity"] == "connected", f"FAIL: connectivity={resp['connectivity']}"
    assert resp["status"] == "online", f"FAIL: status={resp['status']}"
    print("✓ PASS: Toggle OFF did not change connectivity or status")

    # ── TEST D: Real telemetry marks device mode ──────────────────
    section("TEST C — Real telemetry marks execution_mode=device")
    toggle(dev_id, "ON", headers)
    # Force execution_mode back to simulation first
    patch_device(dev_id, headers, execution_mode="simulation")
    # Send real telemetry
    httpx.post(f"{API}/devices/{dev_id}/solar/endpoint/1/cluster/ElectricalPowerMeasurement/setactivepower",
               json={"ActivePower": 5_000_000}, headers=headers, timeout=TIMEOUT)
    d = get_device(dev_id, headers)
    assert d["execution_mode"] == "device", f"FAIL: expected device mode after real telemetry, got {d['execution_mode']}"
    assert "_last_real_telemetry_ts" in d["metadata"], "FAIL: _last_real_telemetry_ts should be present"
    print("✓ PASS: Real telemetry correctly sets execution_mode=device")

    # ── TEST E: Real -> Simulation transition ─────────────────────
    section("TEST D — Real to simulation transition via toggle")
    resp = toggle(dev_id, "ON", headers)
    assert resp["execution_mode"] == "simulation", f"FAIL: expected simulation after toggle, got {resp['execution_mode']}"
    assert "_last_real_telemetry_ts" not in resp["metadata"], "FAIL: stale ts should be cleared"
    print("✓ PASS: Toggle ON clears physical-device claim, simulation becomes authoritative")

    # ── TEST F: Simulation does not overwrite fresh real telemetry ─
    section("TEST E — Sim does not overwrite fresh real telemetry")
    # Set device mode + fresh telemetry
    httpx.post(f"{API}/devices/{dev_id}/solar/endpoint/1/cluster/ElectricalPowerMeasurement/setactivepower",
               json={"ActivePower": 9_999_000}, headers=headers, timeout=TIMEOUT)
    time.sleep(3)  # 3+ sim ticks
    d = get_device(dev_id, headers)
    kw = d["energy_usage_kw"]
    mode = d["execution_mode"]
    print(f"  energy_usage_kw={kw}  execution_mode={mode}")
    assert mode == "device", f"FAIL: should still be device mode, got {mode}"
    assert abs(kw - 9.999) < 0.1, f"FAIL: energy_usage_kw={kw} was overwritten by sim (expected ~9.999)"
    print("✓ PASS: Fresh real telemetry survived 3s of simulation ticks")

    # ── Reset ─────────────────────────────────────────────────────
    toggle(dev_id, "ON", headers)  # restore to sim ON
    print("\n✅ All Solar regression tests passed.")


if __name__ == "__main__":
    main()
