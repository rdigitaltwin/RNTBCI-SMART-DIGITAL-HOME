"""Shunt meter and internal EPM read/write helpers.

Does not mutate Device rows. Existing device state is read-only from here.
Load values (current, power) are only exposed while the linked device is ON.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Device, DeviceEpm, DeviceMeteringCategory, PowerState, ShuntMeter

METER_FIELDS = ("voltage", "current", "power")
LOAD_FIELDS = ("current", "power")
MAX_VOLTAGE = 400.0
MAX_CURRENT = 100.0
MAX_POWER = 50000.0

OFF_DETAIL = (
    "Device is off. Turn the device on before reading or writing current/power. "
    "Voltage on a live shunt bus remains readable; load values are not."
)


def compute_power(voltage: float, current: float) -> float:
    return round(float(voltage) * float(current), 4)


def device_is_on(device: Optional[Device]) -> bool:
    if device is None:
        return False
    raw = getattr(device.power_state, "value", device.power_state)
    return str(raw).lower() == PowerState.ON.value


def device_power_state(device: Optional[Device]) -> Optional[str]:
    if device is None:
        return None
    raw = getattr(device.power_state, "value", device.power_state)
    return str(raw).lower()


def validate_measurement(name: str, value: Any, maximum: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{name}' must be a number",
        )
    number = float(value)
    if number < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{name}' must be non-negative",
        )
    if number > maximum:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{name}' exceeds the allowed maximum of {maximum}",
        )
    return number


def parse_measurements(body: dict, require_voltage_current: bool = True) -> dict:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="JSON object body required")
    voltage = body.get("voltage")
    current = body.get("current")
    power = body.get("power")
    if require_voltage_current and (voltage is None or current is None):
        raise HTTPException(
            status_code=400,
            detail="Body must include numeric 'voltage' and 'current'",
        )
    parsed: dict[str, float] = {}
    if voltage is not None:
        parsed["voltage"] = validate_measurement("voltage", voltage, MAX_VOLTAGE)
    if current is not None:
        parsed["current"] = validate_measurement("current", current, MAX_CURRENT)
    if power is None:
        if "voltage" in parsed and "current" in parsed:
            parsed["power"] = compute_power(parsed["voltage"], parsed["current"])
    else:
        parsed["power"] = validate_measurement("power", power, MAX_POWER)
    if "voltage" in parsed and "current" in parsed and "power" in parsed:
        expected = compute_power(parsed["voltage"], parsed["current"])
        if abs(parsed["power"] - expected) > 0.05:
            raise HTTPException(
                status_code=400,
                detail=f"power must equal voltage*current ({expected})",
            )
    if not parsed:
        raise HTTPException(status_code=400, detail="No measurement fields supplied")
    return parsed


def enforce_off_write(values: dict, is_on: bool, is_grid: bool) -> dict:
    """When the linked device is off, non-zero current/power is rejected."""
    if is_grid or is_on:
        return values
    current = values.get("current", 0.0)
    power = values.get("power", 0.0)
    if current > 0 or power > 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=OFF_DETAIL)
    values = dict(values)
    values["current"] = 0.0
    values["power"] = 0.0
    return values


def visible_measurements(voltage: float, current: float, power: float, available: bool) -> dict:
    if available:
        return {
            "voltage": voltage,
            "current": current,
            "power": power,
        }
    return {
        "voltage": voltage if voltage is not None else 0.0,
        "current": 0.0,
        "power": 0.0,
    }


def require_load_access(field: str, available: bool) -> None:
    if field in LOAD_FIELDS and not available:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=OFF_DETAIL)


async def find_device(identifier: str, db: AsyncSession) -> Optional[Device]:
    try:
        result = await db.execute(select(Device).where(Device.id == uuid.UUID(identifier)))
    except ValueError:
        result = await db.execute(
            select(Device).where(Device.name == identifier.replace("_", " "))
        )
    return result.scalar_one_or_none()


async def linked_device(meter: ShuntMeter, db: AsyncSession) -> Optional[Device]:
    if not meter.device_id:
        return None
    result = await db.execute(select(Device).where(Device.id == meter.device_id))
    return result.scalar_one_or_none()


def shunt_available(meter: ShuntMeter, device: Optional[Device]) -> bool:
    if meter.role == "grid" or meter.device_id is None:
        return True
    return device_is_on(device)


def shunt_payload(meter: ShuntMeter, device: Optional[Device] = None) -> dict:
    available = shunt_available(meter, device)
    measurements = visible_measurements(meter.voltage, meter.current, meter.power, available)
    return {
        "meterId": meter.meter_id,
        "meterType": "Shunt",
        "deviceId": str(meter.device_id) if meter.device_id else None,
        "deviceName": device.name if device else None,
        "role": meter.role,
        "devicePowerState": device_power_state(device) if device else ("on" if meter.role == "grid" else None),
        "available": available,
        "measurements": measurements,
        "updatedAt": meter.updated_at.isoformat() if meter.updated_at else None,
    }


def epm_payload(row: DeviceEpm, device: Device) -> dict:
    available = device_is_on(device)
    measurements = visible_measurements(row.voltage, row.current, row.power, available)
    return {
        "deviceId": str(row.device_id),
        "deviceName": device.name,
        "meterType": "Internal",
        "devicePowerState": device_power_state(device),
        "available": available,
        "epm": measurements,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }


def field_payload(kind_id_key: str, kind_id: str, field: str, value: float, extra: Optional[dict] = None) -> dict:
    body = {kind_id_key: kind_id, field: value}
    if extra:
        body.update(extra)
    return body


def normalize_field(field: str) -> str:
    name = (field or "").strip().lower()
    if name not in METER_FIELDS:
        raise HTTPException(
            status_code=404,
            detail=f"Unsupported field '{field}'. Valid fields: voltage, current, power",
        )
    return name


async def list_shunts(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(ShuntMeter).order_by(ShuntMeter.meter_id))
    meters = list(result.scalars().all())
    payloads = []
    for meter in meters:
        device = await linked_device(meter, db)
        payloads.append(shunt_payload(meter, device))
    return payloads


async def get_shunt(meter_id: str, db: AsyncSession) -> ShuntMeter:
    result = await db.execute(select(ShuntMeter).where(ShuntMeter.meter_id == meter_id))
    meter = result.scalar_one_or_none()
    if not meter:
        raise HTTPException(status_code=404, detail=f"Shunt meter '{meter_id}' not found")
    return meter


async def write_shunt(meter: ShuntMeter, values: dict, posted: bool = False) -> ShuntMeter:
    now = datetime.now(timezone.utc)
    for key, value in values.items():
        setattr(meter, key, value)
    meter.updated_at = now
    if posted:
        meter.last_posted_at = now
    return meter


async def get_epm(device: Device, db: AsyncSession) -> DeviceEpm:
    result = await db.execute(select(DeviceEpm).where(DeviceEpm.device_id == device.id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"Internal meter not available for device '{device.name}'",
        )
    return row


async def write_epm(row: DeviceEpm, values: dict, posted: bool = False) -> DeviceEpm:
    now = datetime.now(timezone.utc)
    for key, value in values.items():
        setattr(row, key, value)
    row.updated_at = now
    if posted:
        row.last_posted_at = now
    return row


async def get_category(device: Device, db: AsyncSession) -> Optional[DeviceMeteringCategory]:
    result = await db.execute(
        select(DeviceMeteringCategory).where(DeviceMeteringCategory.device_id == device.id)
    )
    return result.scalar_one_or_none()


async def get_device_shunt(device: Device, db: AsyncSession) -> ShuntMeter:
    result = await db.execute(select(ShuntMeter).where(ShuntMeter.device_id == device.id))
    meter = result.scalar_one_or_none()
    if not meter:
        raise HTTPException(
            status_code=404,
            detail=f"No shunt meter is linked to device '{device.name}'",
        )
    return meter


async def resolve_device_metering(device: Device, db: AsyncSession) -> dict:
    mapping = await get_category(device, db)
    if not mapping or mapping.category == 3:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Metering is not available for '{device.name}' (Category 3 battery device). "
                "Use the existing control API: /devices/{id}/endpoint/1/cluster/..."
            ),
        )
    if mapping.category == 1:
        row = await get_epm(device, db)
        return epm_payload(row, device)
    meter = await get_device_shunt(device, db)
    return shunt_payload(meter, device)


async def architecture_catalog(db: AsyncSession) -> dict:
    """One row per architecture device: how to read it, and whether load values are live."""
    devices = list((await db.execute(select(Device).order_by(Device.name))).scalars().all())
    categories = {
        row.device_id: row
        for row in (await db.execute(select(DeviceMeteringCategory))).scalars().all()
    }
    shunts = list((await db.execute(select(ShuntMeter))).scalars().all())
    shunt_by_device = {row.device_id: row for row in shunts if row.device_id}
    rows = []
    for device in devices:
        mapping = categories.get(device.id)
        category = mapping.category if mapping else None
        on = device_is_on(device)
        entry = {
            "deviceId": str(device.id),
            "name": device.name,
            "type": device.type.value if hasattr(device.type, "value") else str(device.type),
            "category": category,
            "devicePowerState": device_power_state(device),
            "available": False,
            "access": None,
        }
        if category == 1:
            entry["meterType"] = "Internal"
            entry["available"] = on
            entry["access"] = {
                "reading": f"/api/v1/devices/{device.id}/epm",
                "voltage": f"/api/v1/devices/{device.id}/epm/voltage",
                "current": f"/api/v1/devices/{device.id}/epm/current",
                "power": f"/api/v1/devices/{device.id}/epm/power",
            }
        elif category == 2:
            meter = shunt_by_device.get(device.id)
            entry["meterType"] = "Shunt"
            entry["meterId"] = meter.meter_id if meter else None
            entry["available"] = on
            if meter:
                entry["access"] = {
                    "reading": f"/api/v1/shunt/{meter.meter_id}",
                    "viaDevice": f"/api/v1/devices/{device.id}/shunt",
                    "voltage": f"/api/v1/shunt/{meter.meter_id}/voltage",
                    "current": f"/api/v1/shunt/{meter.meter_id}/current",
                    "power": f"/api/v1/shunt/{meter.meter_id}/power",
                }
        elif category == 3:
            entry["meterType"] = "None"
            entry["access"] = {
                "control": f"/api/v1/devices/{device.id}/endpoint/1",
                "state": f"/api/v1/devices/{device.id}/state",
            }
        rows.append(entry)
    grid = next((meter for meter in shunts if meter.role == "grid"), None)
    return {
        "categories": {
            "1": "Internal EPM — Switch, Light, Heat Pump, Water Heater",
            "2": "Modbus shunt — Dishwasher, Washing Machine, Solar Panel, Nebulizer, EVSE",
            "3": "Battery / control only — Door Lock, Garage Door, Camera, EV",
        },
        "grid": {
            "meterId": grid.meter_id if grid else "GRID001",
            "access": {
                "reading": "/api/v1/shunt/GRID001",
                "voltage": "/api/v1/shunt/GRID001/voltage",
                "current": "/api/v1/shunt/GRID001/current",
                "power": "/api/v1/shunt/GRID001/power",
            },
            "available": True,
        },
        "devices": rows,
    }
