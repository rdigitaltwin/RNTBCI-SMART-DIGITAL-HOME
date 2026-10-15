"""Every URL in the Smart Home Device API reference returns success."""

import uuid
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api.v1 import devices as devices_api
from backend.auth.dependencies import get_current_user, require_user_or_admin
from backend.database import get_db
from backend.models import ConnectivityStatus, Device, DeviceStatus, DeviceType, PowerState, RoleName

BASE = "/api/v1"
CAMERA = "ef1dcda2-0119-4db9-85fd-e24ac85e1096"
DISHWASHER = "f75d41ea-91a3-460c-8020-9a5e15bd5354"
DOOR = "30eb3d26-9c82-46b3-8170-187d74985c09"
GARAGE = "e95c6fd6-fa2c-40fd-b633-c86e7b5d68fd"
AC = "83cd6514-1ece-4f0c-b6a5-5044967e45e2"
SWITCH = "c39bf632-f112-4b64-a294-1f93cbf65584"
WASHER = "bf431833-e422-49ea-8235-da09454d02b4"
HEATER = "5dd8cce9-6033-46ff-8be1-25c1b5078dc7"
EVSE = "b0dae2ad-3332-4f9d-a7f5-bf55032dbb4e"
SOLAR = "1ec2d468-1d91-4a34-9d55-5049b6e41ea0"
EV = "fb338bef-0060-4626-93a6-ef7df4ac3bcb"


def _device(device_id, name, dtype, power=PowerState.OFF, meta=None):
    now = datetime.now(timezone.utc)
    device = Device(
        id=uuid.UUID(device_id),
        name=name,
        type=dtype,
        room_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        status=DeviceStatus.ONLINE,
        power_state=power,
        connectivity=ConnectivityStatus.CONNECTED,
        energy_usage_kw=0.0,
        total_energy_kwh=0.0,
        efficiency_percent=100.0,
        extra_data=meta or {},
        execution_mode="simulation",
        position_x=0.0,
        position_y=0.0,
        position_z=0.0,
        last_updated=now,
        created_at=now,
    )
    return device


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None

    def scalars(self):
        return self

    def first(self):
        return self._rows[0] if self._rows else None

    def all(self):
        return list(self._rows)


class _DB:
    def __init__(self, devices):
        self.devices = devices

    async def commit(self):
        return None

    def add(self, _obj):
        return None

    async def execute(self, stmt):
        params = {}
        try:
            params = dict(stmt.compile().params)
        except Exception:
            params = {}
        by_id = {str(device.id): device for device in self.devices}
        by_name = {device.name: device for device in self.devices}
        for value in params.values():
            key = str(value)
            if key in by_id:
                return _Result([by_id[key]])
            if key in by_name:
                return _Result([by_name[key]])
            enum_name = getattr(value, "name", None)
            if enum_name:
                matched = [device for device in self.devices if getattr(device.type, "name", None) == enum_name]
                if matched:
                    return _Result(matched)
        return _Result([])


def _user():
    return type("User", (), {"username": "tester", "role": type("Role", (), {"name": RoleName.ADMIN})()})()


def _client():
    devices_api.limiter.enabled = False
    devices = [
        _device(CAMERA, "Security Camera", DeviceType.CAMERA),
        _device(DISHWASHER, "Dishwasher", DeviceType.DISHWASHER),
        _device(DOOR, "Door Lock", DeviceType.DOOR_LOCK),
        _device(GARAGE, "Garage Door", DeviceType.DOOR_LOCK),
        _device(AC, "Bedroom AC", DeviceType.HVAC, meta={"mode": "cooling", "target_temperature": 23}),
        _device(SWITCH, "Living Room Switch", DeviceType.SMART_SWITCH),
        _device(WASHER, "Washing Machine", DeviceType.WASHING_MACHINE, meta={"wash_mode": "normal", "spin_speed": 800}),
        _device(HEATER, "Water Heater", DeviceType.WATER_HEATER, meta={"target_temperature": 55}),
        _device(EVSE, "EV Charger", DeviceType.ENERGY_EVSE, meta={"StateOfCharge": 62, "ActivePower": 11000000, "Voltage": 230000, "ActiveCurrent": 16000}),
        _device(SOLAR, "Solar Panel Array", DeviceType.SOLAR_PV, meta={"LabelList": [{"label": "Name", "value": "SolarArray01"}], "ActivePower": 4690000, "CumulativeEnergyExported": 15200000}),
        _device(EV, "EV Vehicle", DeviceType.EV_VEHICLE, meta={"HVBATVoltage": 340, "HVSoC": 58, "AuxBatVoltage": 12.6, "AvgSpeed": 50}),
    ]
    app = FastAPI()
    app.state.limiter = devices_api.limiter
    app.include_router(devices_api.router, prefix="/api/v1")

    async def _db():
        yield _DB(devices)

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[require_user_or_admin] = _user
    return TestClient(app), devices


def test_reference_urls():
    client, devices = _client()
    calls = [
        ("GET", f"{BASE}/devices/{CAMERA}/endpoint/1", None),
        ("POST", f"{BASE}/devices/{CAMERA}/endpoint/1/cluster/0x0551/command", {"command": "StartVideoStream", "resolution": "1920x1080", "frameRate": 30}),
        ("POST", f"{BASE}/devices/{CAMERA}/endpoint/1/cluster/0x0551/command", {"command": "StopVideoStream"}),
        ("POST", f"{BASE}/devices/{CAMERA}/endpoint/1/cluster/0x0551/command", {"command": "StartAudioStream"}),
        ("POST", f"{BASE}/devices/{CAMERA}/endpoint/1/cluster/0x0551/command", {"command": "StopAudioStream"}),
        ("POST", f"{BASE}/devices/{CAMERA}/endpoint/1/cluster/0x0551/command", {"command": "CaptureSnapshot", "resolution": "1920x1080"}),
        ("GET", f"{BASE}/devices/Dishwasher/endpoint/1", None),
        ("POST", f"{BASE}/devices/{DISHWASHER}/endpoint/1/cluster/0x0006/command", {"command": "On"}),
        ("POST", f"{BASE}/devices/{DISHWASHER}/endpoint/1/cluster/0x0006/command", {"command": "Off"}),
        ("POST", f"{BASE}/devices/{DISHWASHER}/endpoint/1/cluster/0x0056/command", {"command": "SetTemperature", "targetTemperatureLevel": 3}),
        ("GET", f"{BASE}/devices/Door_Lock/endpoint/1", None),
        ("POST", f"{BASE}/devices/{DOOR}/endpoint/1/cluster/0x0101/lock", {"command": "LockDoor"}),
        ("POST", f"{BASE}/devices/{DOOR}/endpoint/1/cluster/0x0101/lock", {"command": "UnlockDoor", "pinCode": "1234"}),
        ("GET", f"{BASE}/devices/Garage_Door/endpoint/1", None),
        ("POST", f"{BASE}/devices/{GARAGE}/endpoint/1/cluster/0x2000/command", {"command": "OpenDoor"}),
        ("POST", f"{BASE}/devices/{GARAGE}/endpoint/1/cluster/0x2000/command", {"command": "CloseDoor"}),
        ("POST", f"{BASE}/devices/{GARAGE}/endpoint/1/cluster/0x2000/command", {"command": "StopDoor"}),
        ("GET", f"{BASE}/devices/Bedroom_AC/endpoint/1", None),
        ("POST", f"{BASE}/devices/{AC}/endpoint/1/cluster/0x0201/command", {"command": "SetTargetTemperature", "temperature": 23.0}),
        ("POST", f"{BASE}/devices/{AC}/endpoint/1/cluster/0x0201/command", {"command": "SetMode", "mode": "Heat"}),
        ("GET", f"{BASE}/devices/Nebulizer/endpoint/1", None),
        ("POST", f"{BASE}/devices/Nebulizer/endpoint/1/cluster/0x1000/command", {"command": "StartSession"}),
        ("POST", f"{BASE}/devices/Nebulizer/endpoint/1/cluster/0x1000/command", {"command": "PauseSession"}),
        ("POST", f"{BASE}/devices/Nebulizer/endpoint/1/cluster/0x1000/command", {"command": "StopSession"}),
        ("POST", f"{BASE}/devices/Nebulizer/endpoint/1/cluster/0x1000/command", {"command": "SetMistLevel", "level": "High"}),
        ("GET", f"{BASE}/devices/Living_Room_Switch/endpoint/1", None),
        ("POST", f"{BASE}/devices/{SWITCH}/endpoint/1/cluster/0x0006/off", {"id": "0x00", "name": "Off"}),
        ("POST", f"{BASE}/devices/{SWITCH}/endpoint/1/cluster/0x0006/on", {"id": "0x01", "name": "On"}),
        ("POST", f"{BASE}/devices/{SWITCH}/endpoint/1/cluster/0x0006/toggle", {"id": "0x02", "name": "Toggle"}),
        ("GET", f"{BASE}/devices/{WASHER}/endpoint/1", None),
        ("POST", f"{BASE}/devices/{WASHER}/endpoint/1/configuration", {"mode": "Cotton", "temperature": 40, "spinSpeed": 1200, "rinses": "Extra"}),
        ("POST", f"{BASE}/devices/{WASHER}/endpoint/1/cluster/0x0006/on", {"id": "0x01", "name": "On"}),
        ("POST", f"{BASE}/devices/{WASHER}/endpoint/1/cluster/0x0006/off", {"id": "0x00", "name": "Off"}),
        ("GET", f"{BASE}/devices/{WASHER}/endpoint/1/cluster/OnOff/status", None),
        ("GET", f"{BASE}/devices/{WASHER}/endpoint/1/cluster/0x0051/laundrywashermode/mode", None),
        ("POST", f"{BASE}/devices/{WASHER}/endpoint/1/cluster/LaundryWasherControls/setspin", {"spinSpeedCurrent": 3}),
        ("GET", f"{BASE}/devices/{WASHER}/endpoint/1/cluster/LaundryWasherControls/rinse", None),
        ("POST", f"{BASE}/devices/{WASHER}/endpoint/1/cluster/LaundryWasherControls/setrinse", {"numberOfRinses": "Extra"}),
        ("GET", f"{BASE}/devices/{WASHER}/endpoint/1/cluster/TemperatureControl", None),
        ("GET", f"{BASE}/devices/{HEATER}/endpoint/1", None),
        ("POST", f"{BASE}/devices/{HEATER}/endpoint/1/cluster/0x009E/command", {"command": "SetMode", "mode": "Eco"}),
        ("POST", f"{BASE}/devices/{HEATER}/endpoint/1/cluster/0x0094/command", {"command": "Boost", "durationSec": 3600, "targetTemp": 60}),
        ("POST", f"{BASE}/devices/{HEATER}/endpoint/1/cluster/0x0094/command", {"command": "CancelBoost"}),
        ("GET", f"{BASE}/devices/{EVSE}/endpoint/1", None),
        ("GET", f"{BASE}/devices/{EVSE}/endpoint/1/cluster/EnergyEVSE/stateofcharge", None),
        ("GET", f"{BASE}/devices/{EVSE}/endpoint/1/cluster/ElectricalPowerMeasurement/activepower", None),
        ("GET", f"{BASE}/devices/{EVSE}/endpoint/1/cluster/ElectricalPowerMeasurement/voltage", None),
        ("GET", f"{BASE}/devices/{EVSE}/endpoint/1/cluster/ElectricalPowerMeasurement/activecurrent", None),
        ("GET", f"{BASE}/devices/{EVSE}/endpoint/1/cluster/EnergyEVSE/currentsessionenergy", None),
        ("GET", f"{BASE}/devices/{EVSE}/endpoint/1/cluster/EnergyEVSE/gettargets", None),
        ("POST", f"{BASE}/devices/{EVSE}/endpoint/1/cluster/0x009B/enable", {"commandId": "0x01", "command": "EnableCharging"}),
        ("POST", f"{BASE}/devices/{EVSE}/endpoint/1/cluster/0x009B/disable", {"commandId": "0x02", "command": "Disable"}),
        ("POST", f"{BASE}/devices/{EVSE}/endpoint/1/cluster/0x009B/settarget", {"commandId": "0x05", "command": "SetTargets", "chargingTargetSchedules": [{"dayOfWeekForSequence": 127, "chargingTargets": [{"targetTimeMinutesPastMidnight": 420, "targetSoC": 80, "addedEnergy": 0}]}]}),
        ("POST", f"{BASE}/devices/{EVSE}/endpoint/1/cluster/EnergyEVSE/cleartargets", {"commandId": "0x07", "command": "ClearTargets"}),
        ("POST", f"{BASE}/devices/{EVSE}/endpoint/1/cluster/Identify/triggereffect", {"name": "TriggerEffect"}),
        ("POST", f"{BASE}/devices/{EVSE}/endpoint/1/cluster/ElectricalPowerMeasurement/setactivepower", {"ActivePower": 7400000}),
        ("POST", f"{BASE}/devices/{EVSE}/endpoint/1/cluster/ElectricalPowerMeasurement/setvoltage", {"Voltage": 230000}),
        ("POST", f"{BASE}/devices/{EVSE}/endpoint/1/cluster/ElectricalPowerMeasurement/setactivecurrent", {"ActiveCurrent": 32000}),
        ("POST", f"{BASE}/devices/{SOLAR}/endpoint/1/cluster/0x0091/setactivepower", {"ActivePower": 5000}),
        ("POST", f"{BASE}/devices/{SOLAR}/endpoint/1/cluster/0x0091/setvoltage", {"Voltage": 240}),
        ("POST", f"{BASE}/devices/{SOLAR}/endpoint/1/cluster/0x0091/setactivecurrent", {"ActiveCurrent": 20}),
        ("POST", f"{BASE}/devices/{SOLAR}/solar/endpoint/1/cluster/0x0003/triggereffect", {"name": "TriggerEffect"}),
        ("POST", f"{BASE}/devices/{SOLAR}/solar/endpoint/1/cluster/0x0041/labellist", {"label": "Roof Panel", "value": "Arr 1"}),
        ("GET", f"{BASE}/devices/{SOLAR}/solar/endpoint/1/cluster/0x0091/activepower", None),
        ("GET", f"{BASE}/devices/{SOLAR}/solar/endpoint/1/cluster/0x0091/cumulativeenergyexported", None),
        ("GET", f"{BASE}/devices/{SOLAR}/solar/endpoint/1/cluster/0x0041/labellist", None),
        ("GET", f"{BASE}/devices/{EV}/endpoint/1/cluster/EvVehicleData/hvbatvoltage", None),
        ("POST", f"{BASE}/devices/{EV}/endpoint/1/cluster/EvVehicleData/hvbatvoltage", {"value": 398}),
        ("GET", f"{BASE}/devices/{EV}/endpoint/1/cluster/EvVehicleData/hvsoc", None),
        ("POST", f"{BASE}/devices/{EV}/endpoint/1/cluster/EvVehicleData/hvsoc", {"value": 80}),
        ("GET", f"{BASE}/devices/{EV}/endpoint/1/cluster/EvVehicleData/auxbatvoltage", None),
        ("POST", f"{BASE}/devices/{EV}/endpoint/1/cluster/EvVehicleData/auxbatvoltage", {"value": 12.8}),
        ("GET", f"{BASE}/devices/{EV}/endpoint/1/cluster/EvVehicleData/avgspeed", None),
        ("POST", f"{BASE}/devices/{EV}/endpoint/1/cluster/EvVehicleData/avgspeed", {"value": 55}),
        ("PATCH", f"{BASE}/devices/{SOLAR}/state", {"status": "ON"}),
        ("PATCH", f"{BASE}/devices/{SOLAR}/state", {"status": "OFF"}),
    ]
    failures = []
    for method, path, body in calls:
        response = client.request(method, path, json=body)
        if response.status_code >= 400:
            failures.append(f"{method} {path} -> {response.status_code} {response.text}")
    assert not failures, "\n".join(failures)
    washer = next(device for device in devices if device.name == "Washing Machine")
    assert washer.extra_data["wash_mode"] == "Cotton"
    assert washer.extra_data["number_of_rinses"] == "Extra"
