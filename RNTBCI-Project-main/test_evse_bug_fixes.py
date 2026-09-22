import asyncio
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from backend.database.connection import async_session_factory
from backend.models import Device, DeviceType, PowerState, ConnectivityStatus, DeviceStatus, User
from backend.services.evse_service import EVSEService
from backend.api.v1.devices import toggle_power, disable_evse_charging
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

async def run_tests():
    print("==================================================")
    print("RUNNING EVSE BUG FIX PROOF TESTS")
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

    async with async_session_factory() as db:
        # Find or create EVSE device
        result = await db.execute(select(Device).where(Device.type == DeviceType.ENERGY_EVSE))
        evse = result.scalars().first()
        assert evse is not None, "EVSE device must exist in DB"
        device_id = evse.id
        print(f"Target EVSE Device: {evse.name} ({device_id})")

        # Ensure baseline connected state
        evse.connectivity = ConnectivityStatus.CONNECTED
        evse.status = DeviceStatus.ONLINE
        await db.commit()

        # -------------------------------------------------------------
        # 1. Put device into 'device' mode via real telemetry
        # -------------------------------------------------------------
        print("\n--- Step 1: Simulating real-device telemetry ---")
        await EVSEService.update_evse_state(
            str(device_id),
            {
                "ActivePower": 9876000,
                "Voltage": 235000,
                "ActiveCurrent": 42000,
                "SupplyState": "ChargingEnabled",
                "State": "ChargingEnabled",
                "SessionDuration": 3600,
                "SessionEnergyCharged": 25000,
            },
            db
        )

        await db.refresh(evse)
        print(f"DB execution_mode after real telemetry: {evse.execution_mode}")
        print(f"DB energy_usage_kw: {evse.energy_usage_kw}")
        print(f"DB extra_data keys: {list(evse.extra_data.keys())}")
        assert evse.execution_mode == "device", "Should be in 'device' mode"
        assert "_last_real_telemetry_ts" in evse.extra_data, "Should have _last_real_telemetry_ts"
        assert evse.extra_data.get("SessionDuration") == 3600

        # -------------------------------------------------------------
        # 2. Toggle device OFF via toggle_power (UI slider)
        # -------------------------------------------------------------
        print("\n--- Step 2: Toggle OFF via UI slider ---")
        bg = BackgroundTasks()
        resp_off = await toggle_power(
            request=mock_request(),
            device_id=device_id,
            data=DevicePowerRequest(power_state="off"),
            background_tasks=bg,
            current_user=mock_admin,
            db=db,
        )

        await db.refresh(evse)
        print(f"DB power_state: {evse.power_state}")
        print(f"DB connectivity: {evse.connectivity}")
        print(f"DB status: {evse.status}")
        print(f"DB energy_usage_kw: {evse.energy_usage_kw}")
        print(f"DB extra_data Voltage: {evse.extra_data.get('Voltage')}")
        print(f"DB extra_data ActiveCurrent: {evse.extra_data.get('ActiveCurrent')}")
        print(f"DB extra_data ActivePower: {evse.extra_data.get('ActivePower')}")
        print(f"DB extra_data _last_real_telemetry_ts: {evse.extra_data.get('_last_real_telemetry_ts')}")

        assert evse.power_state == PowerState.OFF, "Power state must be OFF"
        assert evse.connectivity == ConnectivityStatus.CONNECTED, "BUG 1 CHECK: Connectivity must remain CONNECTED (not greyed out)"
        assert evse.status == DeviceStatus.ONLINE, "BUG 1 CHECK: Status must remain ONLINE"
        assert evse.energy_usage_kw == 0.0, "Energy usage must be 0.0"
        assert evse.extra_data.get("Voltage") == 0
        assert evse.extra_data.get("ActivePower") == 0
        assert evse.extra_data.get("ActiveCurrent") == 0
        assert "_last_real_telemetry_ts" not in evse.extra_data, "Timestamp must be purged"
        print("✓ BUG 1 Verification PASSED: Turning OFF preserves connectivity == 'connected' (card will NOT grey out)")

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
            db=db,
        )

        await db.refresh(evse)
        print(f"DB power_state: {evse.power_state}")
        print(f"DB execution_mode: {evse.execution_mode}")
        print(f"DB connectivity: {evse.connectivity}")
        print(f"DB status: {evse.status}")
        print(f"DB energy_usage_kw: {evse.energy_usage_kw}")
        print(f"DB extra_data Voltage: {evse.extra_data.get('Voltage')}")
        print(f"DB extra_data ActiveCurrent: {evse.extra_data.get('ActiveCurrent')}")
        print(f"DB extra_data ActivePower: {evse.extra_data.get('ActivePower')}")
        print(f"DB extra_data State: {evse.extra_data.get('State')}")
        print(f"DB extra_data SupplyState: {evse.extra_data.get('SupplyState')}")
        print(f"DB extra_data SessionDuration: {evse.extra_data.get('SessionDuration')}")
        print(f"DB extra_data _last_real_telemetry_ts: {evse.extra_data.get('_last_real_telemetry_ts')}")

        assert evse.power_state == PowerState.ON, "Power state must be ON"
        assert evse.execution_mode == "simulation", "BUG 2 CHECK: execution_mode must be 'simulation' (SIM ACTIVE)"
        assert evse.energy_usage_kw == 7.4, "energy_usage_kw must be 7.4"
        assert evse.extra_data.get("Voltage") == 230000
        assert evse.extra_data.get("ActiveCurrent") == 32174
        assert evse.extra_data.get("ActivePower") == 7400000
        assert evse.extra_data.get("State") == "ChargingEnabled"
        assert evse.extra_data.get("SupplyState") == "ChargingEnabled"
        assert "_last_real_telemetry_ts" not in evse.extra_data, "BUG 2 CHECK: _last_real_telemetry_ts must be absent"
        assert "SessionDuration" not in evse.extra_data, "BUG 2 CHECK: stale real session fields must be purged"
        print("✓ BUG 2 Verification PASSED: execution_mode reset to 'simulation' and clean simulated metadata restored")

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
            db=db,
        )

        await db.refresh(evse)
        print(f"DB connectivity after Matter disable: {evse.connectivity}")
        print(f"DB status after Matter disable: {evse.status}")
        print(f"DB power_state after Matter disable: {evse.power_state}")
        assert evse.connectivity == ConnectivityStatus.CONNECTED, "Matter disable must NOT disconnect device"
        assert evse.status == DeviceStatus.ONLINE, "Matter disable must NOT set status to offline"
        assert evse.power_state == PowerState.OFF, "Matter disable must turn power OFF"
        print("✓ Matter disable decoupling PASSED")

    print("\n==================================================")
    print("ALL TESTS PASSED SUCCESSFULLY! ✅")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
