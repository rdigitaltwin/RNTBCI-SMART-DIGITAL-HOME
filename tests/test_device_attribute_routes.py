"""Route tests for the three Postman failures and every inventoried device."""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api.v1 import devices as devices_api
from backend.auth.dependencies import get_current_user
from backend.database import get_db
from backend.models import ConnectivityStatus, Device, DeviceStatus, DeviceType, PowerState

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "devices_inventory.json"

SOLAR_ID = "1ec2d468-1d91-4a34-9d55-5049b6e41ea0"
WASHER_ID = "bf431833-e422-49ea-8235-da09454d02b4"


class _Session:
    async def commit(self):
        return None


async def _db():
    yield _Session()


def _user():
    return {"id": "test"}


def _device(device_id: str, name: str, dtype: DeviceType, power: PowerState, meta: dict) -> Device:
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
        extra_data=meta,
        execution_mode="simulation",
        position_x=0.0,
        position_y=0.0,
        position_z=0.0,
        last_updated=now,
        created_at=now,
    )


def _type_from_name(name: str) -> DeviceType:
    return DeviceType[name]


@pytest.fixture()
def client(monkeypatch):
    devices_api.limiter.enabled = False
    store: dict[str, Device] = {
        SOLAR_ID: _device(
            SOLAR_ID,
            "Solar Panel Array",
            DeviceType.SOLAR_PV,
            PowerState.OFF,
            {"LabelList": [{"label": "Name", "value": "SolarArray01"}]},
        ),
        WASHER_ID: _device(
            WASHER_ID,
            "Washing Machine",
            DeviceType.WASHING_MACHINE,
            PowerState.ON,
            {"wash_mode": "normal", "spin_speed": 800},
        ),
    }
    if INVENTORY.exists():
        payload = json.loads(INVENTORY.read_text())
        for row in payload["devices"]:
            if row["id"] in store:
                continue
            store[row["id"]] = _device(
                row["id"],
                row["name"],
                _type_from_name(row["type"]),
                PowerState.OFF,
                {},
            )

    async def _find(identifier: str, db):
        return store.get(identifier)

    monkeypatch.setattr(devices_api, "_find_device_by_id_or_name", _find)

    app = FastAPI()
    app.state.limiter = devices_api.limiter
    app.include_router(devices_api.router, prefix="/api/v1")
    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = _user
    with TestClient(app) as test_client:
        test_client.store = store  # type: ignore[attr-defined]
        yield test_client


def test_solar_labellist_by_hex_cluster(client):
    response = client.get(
        f"/api/v1/devices/{SOLAR_ID}/endpoint/1/cluster/0x0041/labellist"
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["LabelList"][0]["value"] == "SolarArray01"

    upper = client.get(
        f"/api/v1/devices/{SOLAR_ID}/endpoint/1/cluster/0X0041/LabelList"
    )
    assert upper.status_code == 200


def test_washer_onoff_status_alias(client):
    response = client.get(
        f"/api/v1/devices/{WASHER_ID}/endpoint/1/cluster/OnOff/status"
    )
    assert response.status_code == 200, response.text
    assert response.json()["OnOff"] is True

    folded = client.get(
        f"/api/v1/devices/{WASHER_ID}/endpoint/1/cluster/onoff/STATUS"
    )
    assert folded.status_code == 200


def test_washer_mode_get_and_post_with_whitespace(client):
    path = f"/api/v1/devices/{WASHER_ID}/endpoint/1/cluster/%200x0051/laundrywashermode/mode"
    response = client.get(path)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["CurrentMode"] == "normal"
    assert "delicate" in body["SupportedModes"]

    posted = client.post(path, json={"value": "delicate"})
    assert posted.status_code == 200, posted.text
    assert posted.json()["CurrentMode"] == "delicate"
    assert client.store[WASHER_ID].extra_data["wash_mode"] == "delicate"


def test_unknown_attribute_lists_valid_names(client):
    response = client.get(
        f"/api/v1/devices/{WASHER_ID}/endpoint/1/cluster/OnOff/not-a-real-attribute"
    )
    assert response.status_code == 404
    detail = response.json()["detail"]
    assert "OnOff" in detail
    assert "PowerState" in detail


def test_inventory_devices_get_each_readable_attribute(client):
    if not INVENTORY.exists():
        pytest.skip("devices_inventory.json is not generated yet")
    payload = json.loads(INVENTORY.read_text())
    assert payload["devices"], "inventory is empty"
    for row in payload["devices"]:
        assert row["endpoints"], f"{row['name']} has no endpoints"
        for endpoint in row["endpoints"]:
            for cluster in endpoint["clusters"]:
                if not cluster["attributes"]:
                    assert any("empty attributes" in flag for flag in row["flags"]), row
                    continue
                for attribute in cluster["attributes"]:
                    url = (
                        f"/api/v1/devices/{row['id']}/endpoint/{endpoint['endpoint_id']}"
                        f"/cluster/{cluster['cluster_id']}/{attribute}"
                    )
                    response = client.get(url)
                    assert response.status_code == 200, f"{url} -> {response.status_code} {response.text}"
