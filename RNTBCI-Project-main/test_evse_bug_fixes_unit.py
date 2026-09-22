import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone
from backend.models import Device, DeviceType, PowerState, ConnectivityStatus, DeviceStatus, User
from backend.api.v1.devices import toggle_power, disable_evse_charging, _halt_electrical_output
from backend.schemas.schemas import DevicePowerRequest
from starlette.requests import Request
from fastapi import BackgroundTasks

def mock_request():
    scope = {
        "type": "http",
        "method": "PATCH",
        "path": "/api/v1/devices/test/power",
        "headers": [],
        "client": ("127.0.0.1", 12345),
    }
    return Request(scope)

async def run_unit_tests():
    print("==================================================")
    print("RUNNING EVSE BUG FIX UNIT TESTS (MOCK SESSION)")
    print("==================================================")

    mock_admin = User(
        id=uuid.uuid4(),
        email="test_admin@rntbci.io",
        username="test_admin",
        password_hash="x",
        first_name="Test",
        last_name="Admin",
        role_id=uuid.uuid4(),
        is_active=True,
    )

    device_id = uuid.uuid4()
    room_id = uuid.uuid4()
    evse = Device(
        id=device_id,
        name="EV Charger",
        type=DeviceType.ENERGY_EVSE,
        room_id=room_id,
        power_state=PowerState.ON,
        connectivity=ConnectivityStatus.CONNECTED,
        status=DeviceStatus.ONLINE,
        execution_mode="device",
        energy_usage_kw=9.876,
        total_energy_kwh=12.5,
        efficiency_percent=95.0,
        position_x=0.0,
        position_y=0.0,
        position_z=0.0,
        created_at=datetime.now(timezone.utc),
        extra_data={
            "endpoint": 1,
            "matter_device_type": "0x050C",
            "Voltage": 235000,
            "ActiveCurrent": 42000,
            "ActivePower": 9876000,
            "SupplyState": "ChargingEnabled",
            "State": "ChargingEnabled",
            "SessionDuration": 3600,
            "_last_real_telemetry_ts": datetime.now(timezone.utc).isoformat(),
        },
    )

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = evse
    mock_result.scalars.return_value.first.return_value = evse
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_db.add = MagicMock()

    bg = BackgroundTasks()

    # -------------------------------------------------------------
    # 1. Verify initial 'device' mode and real telemetry state
    # -------------------------------------------------------------
    print("\n--- Step 1: Initial State (Physical Device Telemetry) ---")
    print(f"execution_mode: {evse.execution_mode}")
    print(f"energy_usage_kw: {evse.energy_usage_kw}")
    print(f"_last_real_telemetry_ts: {evse.extra_data.get('_last_real_telemetry_ts')}")
    print(f"SessionDuration: {evse.extra_data.get('SessionDuration')}")
    assert evse.execution_mode == "device"
    assert "_last_real_telemetry_ts" in evse.extra_data
    assert evse.extra_data.get("SessionDuration") == 3600
    print("[PASS] Step 1 verified")

    # -------------------------------------------------------------
    # 2. Toggle device OFF via toggle_power (UI slider)
    # -------------------------------------------------------------
    print("\n--- Step 2: Toggle OFF via UI slider ---")
    resp_off = await toggle_power(
        request=mock_request(),
        device_id=device_id,
        data=DevicePowerRequest(power_state="off"),
        background_tasks=bg,
        current_user=mock_admin,
        db=mock_db,
    )

    print(f"power_state: {evse.power_state}")
    print(f"connectivity: {evse.connectivity}")
    print(f"status: {evse.status}")
    print(f"energy_usage_kw: {evse.energy_usage_kw}")
    print(f"Voltage: {evse.extra_data.get('Voltage')}")
    print(f"ActiveCurrent: {evse.extra_data.get('ActiveCurrent')}")
    print(f"ActivePower: {evse.extra_data.get('ActivePower')}")
    print(f"State: {evse.extra_data.get('State')}")
    print(f"SupplyState: {evse.extra_data.get('SupplyState')}")
    print(f"_last_real_telemetry_ts: {evse.extra_data.get('_last_real_telemetry_ts')}")

    assert evse.power_state == PowerState.OFF, "Power state must be OFF"
    assert evse.connectivity == ConnectivityStatus.CONNECTED, "BUG 1 CHECK: Connectivity must remain CONNECTED (card will NOT grey out)"
    assert evse.status == DeviceStatus.ONLINE, "BUG 1 CHECK: Status must remain ONLINE"
    assert evse.energy_usage_kw == 0.0, "Energy usage must be 0.0"
    assert evse.extra_data.get("Voltage") == 0
    assert evse.extra_data.get("ActivePower") == 0
    assert evse.extra_data.get("ActiveCurrent") == 0
    assert evse.extra_data.get("State") == "Disabled"
    assert evse.extra_data.get("SupplyState") == "Disabled"
    assert "_last_real_telemetry_ts" not in evse.extra_data, "Timestamp must be purged"
    print("[PASS] BUG 1 Verification PASSED: Turning OFF preserves connectivity == 'connected' (card will NOT grey out)")

    # -------------------------------------------------------------
    # 3. Toggle device ON via toggle_power (UI slider)
    # -------------------------------------------------------------
    print("\n--- Step 3: Toggle ON via UI slider ---")
    resp_on = await toggle_power(
        request=mock_request(),
        device_id=device_id,
        data=DevicePowerRequest(power_state="on"),
        background_tasks=bg,
        current_user=mock_admin,
        db=mock_db,
    )

    print(f"power_state: {evse.power_state}")
    print(f"execution_mode: {evse.execution_mode}")
    print(f"connectivity: {evse.connectivity}")
    print(f"status: {evse.status}")
    print(f"energy_usage_kw: {evse.energy_usage_kw}")
    print(f"Voltage: {evse.extra_data.get('Voltage')}")
    print(f"ActiveCurrent: {evse.extra_data.get('ActiveCurrent')}")
    print(f"ActivePower: {evse.extra_data.get('ActivePower')}")
    print(f"State: {evse.extra_data.get('State')}")
    print(f"SupplyState: {evse.extra_data.get('SupplyState')}")
    print(f"SessionDuration: {evse.extra_data.get('SessionDuration')}")
    print(f"_last_real_telemetry_ts: {evse.extra_data.get('_last_real_telemetry_ts')}")

    assert evse.power_state == PowerState.ON, "Power state must be ON"
    assert evse.execution_mode == "simulation", f"BUG 2 CHECK: execution_mode must be 'simulation', got {evse.execution_mode}"
    assert evse.energy_usage_kw == 7.4, "energy_usage_kw must be 7.4"
    assert evse.extra_data.get("Voltage") == 230000
    assert evse.extra_data.get("ActiveCurrent") == 32174
    assert evse.extra_data.get("ActivePower") == 7400000
    assert evse.extra_data.get("State") == "ChargingEnabled"
    assert evse.extra_data.get("SupplyState") == "ChargingEnabled"
    assert "_last_real_telemetry_ts" not in evse.extra_data, "BUG 2 CHECK: _last_real_telemetry_ts must be absent"
    assert "SessionDuration" not in evse.extra_data, "BUG 2 CHECK: stale real session fields must be purged"
    print("[PASS] BUG 2 Verification PASSED: execution_mode reset to 'simulation' and clean simulated metadata restored")

    # -------------------------------------------------------------
    # 4. Test disable_evse_charging decoupling
    # -------------------------------------------------------------
    print("\n--- Step 4: Testing Matter disable_evse_charging ---")
    await disable_evse_charging(
        request=mock_request(),
        device_id=str(device_id),
        endpoint=1,
        cluster="0x009B",
        payload={},
        db=mock_db,
    )

    print(f"connectivity after Matter disable: {evse.connectivity}")
    print(f"status after Matter disable: {evse.status}")
    print(f"power_state after Matter disable: {evse.power_state}")
    assert evse.connectivity == ConnectivityStatus.CONNECTED, "Matter disable must NOT disconnect device"
    assert evse.status == DeviceStatus.ONLINE, "Matter disable must NOT set status to offline"
    assert evse.power_state == PowerState.OFF, "Matter disable must turn power OFF"
    print("[PASS] Matter disable decoupling PASSED")

    # -------------------------------------------------------------
    # 5. Frontend isDeviceConnected simulation
    # -------------------------------------------------------------
    print("\n--- Step 5: Frontend isDeviceConnected Simulation ---")
    def isDeviceConnected(dev):
        conn = dev.get("connectivity")
        if conn:
            c = conn.lower()
            if c in ("disconnected", "offline"):
                return False
        st = dev.get("status")
        if st:
            s = st.lower()
            if s == "offline":
                return False
        return True

    # Case A: EV Charger turned OFF via slider (power_state='off', connectivity='connected', status='online')
    charger_off = {"power_state": "off", "connectivity": "connected", "status": "online"}
    assert isDeviceConnected(charger_off) is True, "Must stay connected (NOT greyed out) when OFF"
    print("[PASS] Case A (Charger power OFF): isDeviceConnected = True (NOT greyed out)")

    # Case B: EV Charger disconnected via wifi toggle (connectivity='disconnected', status='offline')
    charger_disconnected = {"power_state": "off", "connectivity": "disconnected", "status": "offline"}
    assert isDeviceConnected(charger_disconnected) is False, "Must be disconnected (greyed out) when disconnected"
    print("[PASS] Case B (Charger network disconnect): isDeviceConnected = False (greyed out)")

    print("\n==================================================")
    print("ALL UNIT TESTS PASSED SUCCESSFULLY! [SUCCESS]")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_unit_tests())
