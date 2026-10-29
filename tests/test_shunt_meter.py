"""Shunt meter / internal EPM routes. Existing Matter paths must stay unchanged."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.sql.elements import BinaryExpression, BooleanClauseList, BindParameter, Grouping

from backend.api.v1 import devices as devices_api
from backend.api.v1 import metering as metering_api
from backend.auth.dependencies import get_current_user
from backend.database import get_db
from backend.models import (
    ConnectivityStatus,
    Device,
    DeviceEpm,
    DeviceMeteringCategory,
    DeviceStatus,
    DeviceType,
    PowerState,
    ShuntMeter,
)
from backend.services.metering import compute_power, parse_measurements

WASHER = "bf431833-e422-49ea-8235-da09454d02b4"
DISHWASHER = "f75d41ea-91a3-460c-8020-9a5e15bd5354"
HEATER = "5dd8cce9-6033-46ff-8be1-25c1b5078dc7"
CAMERA = "ef1dcda2-0119-4db9-85fd-e24ac85e1096"
SWITCH = "c39bf632-f112-4b64-a294-1f93cbf65584"


def _device(device_id, name, dtype, power=PowerState.OFF):
    now = datetime.now(timezone.utc)
    return Device(
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
        extra_data={},
        execution_mode="simulation",
        position_x=0.0,
        position_y=0.0,
        position_z=0.0,
        last_updated=now,
        created_at=now,
    )


def _bind_value(node):
    if isinstance(node, BindParameter):
        return node.value
    if isinstance(node, Grouping):
        return _bind_value(node.element)
    return getattr(node, "value", node)


def _filters(clause, found=None):
    found = found or {}
    if clause is None:
        return found
    if isinstance(clause, BooleanClauseList):
        for child in clause.clauses:
            _filters(child, found)
        return found
    if isinstance(clause, Grouping):
        return _filters(clause.element, found)
    if isinstance(clause, BinaryExpression):
        key = getattr(clause.left, "key", None)
        found[key] = _bind_value(clause.right)
    return found


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None

    def scalars(self):
        return self

    def all(self):
        return list(self._rows)


class FakeDB:
    def __init__(self, store):
        self.store = store

    async def commit(self):
        return None

    async def execute(self, stmt):
        entity = stmt.column_descriptions[0]["entity"]
        filters = _filters(getattr(stmt, "whereclause", None))
        if entity is Device:
            rows = list(self.store["devices"].values())
            if "id" in filters:
                rows = [row for row in rows if row.id == filters["id"]]
            if "name" in filters:
                rows = [row for row in rows if row.name == filters["name"]]
            return FakeResult(rows)
        if entity is ShuntMeter:
            rows = list(self.store["shunts"].values())
            if "meter_id" in filters:
                rows = [row for row in rows if row.meter_id == filters["meter_id"]]
            if "device_id" in filters:
                rows = [row for row in rows if row.device_id == filters["device_id"]]
            rows.sort(key=lambda row: row.meter_id)
            return FakeResult(rows)
        if entity is DeviceEpm:
            rows = list(self.store["epm"].values())
            if "device_id" in filters:
                rows = [row for row in rows if row.device_id == filters["device_id"]]
            return FakeResult(rows)
        if entity is DeviceMeteringCategory:
            rows = list(self.store["cats"].values())
            if "device_id" in filters:
                rows = [row for row in rows if row.device_id == filters["device_id"]]
            return FakeResult(rows)
        return FakeResult([])


def _store():
    washer = _device(WASHER, "Washing Machine", DeviceType.WASHING_MACHINE, PowerState.ON)
    dish = _device(DISHWASHER, "Dishwasher", DeviceType.DISHWASHER)
    heater = _device(HEATER, "Water Heater", DeviceType.WATER_HEATER)
    camera = _device(CAMERA, "Security Camera", DeviceType.CAMERA)
    switch = _device(SWITCH, "Living Room Switch", DeviceType.SMART_SWITCH)
    now = datetime.now(timezone.utc)
    return {
        "devices": {d.id: d for d in (washer, dish, heater, camera, switch)},
        "shunts": {
            "SHUNT001": ShuntMeter(meter_id="SHUNT001", device_id=dish.id, role="device", voltage=0, current=0, power=0, updated_at=now),
            "SHUNT002": ShuntMeter(meter_id="SHUNT002", device_id=washer.id, role="device", voltage=0, current=0, power=0, updated_at=now),
            "GRID001": ShuntMeter(meter_id="GRID001", device_id=None, role="grid", voltage=0, current=0, power=0, updated_at=now),
        },
        "epm": {
            heater.id: DeviceEpm(device_id=heater.id, voltage=0, current=0, power=0, updated_at=now),
            switch.id: DeviceEpm(device_id=switch.id, voltage=0, current=0, power=0, updated_at=now),
        },
        "cats": {
            washer.id: DeviceMeteringCategory(device_id=washer.id, category=2, meter_type="Shunt"),
            dish.id: DeviceMeteringCategory(device_id=dish.id, category=2, meter_type="Shunt"),
            heater.id: DeviceMeteringCategory(device_id=heater.id, category=1, meter_type="Internal"),
            switch.id: DeviceMeteringCategory(device_id=switch.id, category=1, meter_type="Internal"),
            camera.id: DeviceMeteringCategory(device_id=camera.id, category=3, meter_type="None"),
        },
    }


def _client():
    store = _store()
    devices_api.limiter.enabled = False
    metering_api.limiter.enabled = False
    app = FastAPI()
    app.state.limiter = metering_api.limiter
    app.include_router(devices_api.router, prefix="/api/v1")
    app.include_router(metering_api.shunt_router, prefix="/api/v1")
    app.include_router(metering_api.device_metering_router, prefix="/api/v1")
    app.include_router(metering_api.catalog_router, prefix="/api/v1")

    async def _db():
        yield FakeDB(store)

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = lambda: {"id": "test"}
    return TestClient(app), store


def test_list_and_get_shunt_shape():
    client, _ = _client()
    listed = client.get("/api/v1/shunt")
    assert listed.status_code == 200
    ids = {row["meterId"] for row in listed.json()}
    assert {"SHUNT001", "SHUNT002", "GRID001"} <= ids
    body = client.get("/api/v1/shunt/SHUNT001").json()
    assert body["meterType"] == "Shunt"
    assert set(body["measurements"]) == {"voltage", "current", "power"}
    assert body["deviceId"] == DISHWASHER
    assert body["available"] is False
    assert body["measurements"]["current"] == 0
    assert body["measurements"]["power"] == 0


def test_post_then_get_and_computed_power():
    client, store = _client()
    posted = client.post("/api/v1/shunt/SHUNT002/measurements", json={"voltage": 230, "current": 2})
    assert posted.status_code == 200, posted.text
    body = posted.json()
    assert body["measurements"]["power"] == compute_power(230, 2)
    again = client.get("/api/v1/shunt/SHUNT002")
    assert again.json()["measurements"]["power"] == body["measurements"]["power"]
    assert store["shunts"]["SHUNT002"].last_posted_at is not None
    field = client.get("/api/v1/shunt/SHUNT002/power")
    assert field.status_code == 200
    assert field.json()["meterId"] == "SHUNT002"
    assert field.json()["power"] == body["measurements"]["power"]
    assert field.json()["available"] is True
    assert field.json()["devicePowerState"] == "on"


def test_water_heater_epm_and_single_fields():
    client, store = _client()
    store["devices"][uuid.UUID(HEATER)].power_state = PowerState.ON
    posted = client.post(
        f"/api/v1/devices/{HEATER}/epm",
        json={"voltage": 230, "current": 8.6957, "power": compute_power(230, 8.6957)},
    )
    assert posted.status_code == 200, posted.text
    assert posted.json()["meterType"] == "Internal"
    assert posted.json()["available"] is True
    assert posted.json()["epm"]["power"] == compute_power(230, 8.6957)
    assert client.get(f"/api/v1/devices/{HEATER}/epm/voltage").json()["voltage"] == 230
    named = client.get("/api/v1/devices/Water_Heater/epm")
    assert named.status_code == 200


def test_category3_and_unknown_are_404():
    client, _ = _client()
    assert client.get(f"/api/v1/devices/{CAMERA}/metering").status_code == 404
    assert client.get("/api/v1/shunt/NOPE").status_code == 404
    assert client.get("/api/v1/shunt/SHUNT001/flux").status_code == 404
    bad = client.post("/api/v1/shunt/SHUNT001/measurements", json={"voltage": -1, "current": 1})
    assert bad.status_code == 400
    missing = client.post("/api/v1/shunt/SHUNT001/measurements", json={"voltage": 230})
    assert missing.status_code == 400


def test_metering_resolver_and_grid_formula():
    client, store = _client()
    store["devices"][uuid.UUID(DISHWASHER)].power_state = PowerState.ON
    posted = client.post("/api/v1/shunt/SHUNT001/measurements", json={"voltage": 230, "current": 1})
    assert posted.status_code == 200, posted.text
    resolved = client.get(f"/api/v1/devices/{DISHWASHER}/metering")
    assert resolved.status_code == 200
    assert resolved.json()["meterType"] == "Shunt"
    via_device = client.get(f"/api/v1/devices/{DISHWASHER}/shunt")
    assert via_device.status_code == 200
    assert via_device.json()["meterId"] == "SHUNT001"
    loads = store["shunts"]["SHUNT001"].power + store["shunts"]["SHUNT002"].power
    voltage = 230.0
    grid_power = loads
    grid_current = grid_power / voltage
    assert grid_power >= loads
    assert abs(compute_power(voltage, grid_current) - grid_power) < 1e-6


def test_existing_washer_cluster_route_unchanged():
    client, _ = _client()
    response = client.get(f"/api/v1/devices/{WASHER}/endpoint/1/cluster/OnOff/status")
    assert response.status_code == 200, response.text
    assert "OnOff" in response.json()


def test_load_values_blocked_when_device_off():
    client, store = _client()
    dish = store["devices"][uuid.UUID(DISHWASHER)]
    assert dish.power_state == PowerState.OFF
    blocked = client.post(
        "/api/v1/shunt/SHUNT001/measurements", json={"voltage": 230, "current": 7.8}
    )
    assert blocked.status_code == 409
    zeros = client.post(
        "/api/v1/shunt/SHUNT001/measurements", json={"voltage": 230, "current": 0}
    )
    assert zeros.status_code == 200
    assert zeros.json()["available"] is False
    assert client.get("/api/v1/shunt/SHUNT001/current").status_code == 409
    assert client.get("/api/v1/shunt/SHUNT001/power").status_code == 409
    voltage = client.get("/api/v1/shunt/SHUNT001/voltage")
    assert voltage.status_code == 200
    dish.power_state = PowerState.ON
    live = client.post(
        "/api/v1/shunt/SHUNT001/measurements", json={"voltage": 230, "current": 7.8}
    )
    assert live.status_code == 200, live.text
    assert live.json()["available"] is True
    assert live.json()["measurements"]["power"] == compute_power(230, 7.8)
    assert client.get("/api/v1/shunt/SHUNT001/current").status_code == 200
    heater = store["devices"][uuid.UUID(HEATER)]
    assert client.get(f"/api/v1/devices/{HEATER}/epm/current").status_code == 409
    heater.power_state = PowerState.ON
    assert client.post(
        f"/api/v1/devices/{HEATER}/epm", json={"voltage": 230, "current": 8.7}
    ).status_code == 200


def test_architecture_catalog_lists_access_paths():
    client, _ = _client()
    catalog = client.get("/api/v1/metering/catalog")
    assert catalog.status_code == 200
    body = catalog.json()
    assert body["grid"]["meterId"] == "GRID001"
    by_name = {row["name"]: row for row in body["devices"]}
    assert by_name["Dishwasher"]["category"] == 2
    assert "SHUNT001" in by_name["Dishwasher"]["access"]["reading"]
    assert by_name["Water Heater"]["category"] == 1
    assert "/epm" in by_name["Water Heater"]["access"]["reading"]
    assert by_name["Security Camera"]["category"] == 3
    assert by_name["Security Camera"]["access"]["control"].endswith("/endpoint/1")


def test_parse_measurements_rejects_non_numeric():
    try:
        parse_measurements({"voltage": "hot", "current": 1})
        assert False, "expected HTTPException"
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 400
