"""Idempotent seed for Modbus shunt meters and internal EPM rows.

Safe to run repeatedly. Never duplicates meters or overwrites existing
measurement values. Never creates extra copies of existing devices.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import async_session_factory, init_db
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

logger = logging.getLogger(__name__)

# Category 1 Internal, 2 Shunt, 3 battery (no metering).
CATEGORY_BY_TYPE = {
    DeviceType.SMART_SWITCH: (1, "Internal"),
    DeviceType.HEAT_PUMP: (1, "Internal"),
    DeviceType.HVAC: (1, "Internal"),
    DeviceType.AIR_CONDITIONER: (1, "Internal"),
    DeviceType.WATER_HEATER: (1, "Internal"),
    DeviceType.SMART_LIGHT: (1, "Internal"),
    DeviceType.DISHWASHER: (2, "Shunt"),
    DeviceType.WASHING_MACHINE: (2, "Shunt"),
    DeviceType.SOLAR_PV: (2, "Shunt"),
    DeviceType.NEBULIZER: (2, "Shunt"),
    DeviceType.ENERGY_EVSE: (2, "Shunt"),
    DeviceType.DOOR_LOCK: (3, "None"),
    DeviceType.CAMERA: (3, "None"),
    DeviceType.EV_VEHICLE: (3, "None"),
}

SHUNT_ASSIGNMENTS = (
    ("SHUNT001", "dishwasher", "DISHWASHER"),
    ("SHUNT002", "washing machine", "WASHING_MACHINE"),
    ("SHUNT003", "solar", "SOLAR_PV"),
    ("SHUNT004", "nebuli", "NEBULIZER"),
    ("SHUNT005", "ev charger", "ENERGY_EVSE"),
)


def _type_key(device: Device) -> DeviceType | None:
    raw = device.type
    if isinstance(raw, DeviceType):
        return raw
    try:
        return DeviceType(str(raw).lower())
    except ValueError:
        name = str(raw).upper()
        return DeviceType[name] if name in DeviceType.__members__ else None


def _pick_device(devices: list[Device], name_part: str, type_name: str) -> Device | None:
    name_part = name_part.lower()
    for device in devices:
        if name_part in (device.name or "").lower():
            return device
    for device in devices:
        key = _type_key(device)
        if key and (key.name == type_name or key.value == type_name.lower()):
            return device
    return None


async def seed_shunt_metering(db: AsyncSession) -> dict:
    """Insert missing category / shunt / EPM rows. Existing values are kept."""
    result = await db.execute(select(Device))
    devices = list(result.scalars().all())
    created = {"categories": 0, "shunts": 0, "epm": 0, "devices": 0}

    for name, dtype in (("Dishwasher", DeviceType.DISHWASHER), ("Water Heater", DeviceType.WATER_HEATER)):
        if _pick_device(devices, name.lower(), dtype.name):
            continue
        if not devices:
            logger.warning("Cannot create %s: no existing device/room to copy", name)
            continue
        template = devices[0]
        db.add(
            Device(
                name=name,
                type=dtype,
                room_id=template.room_id,
                status=DeviceStatus.ONLINE,
                power_state=PowerState.OFF,
                connectivity=ConnectivityStatus.CONNECTED,
                extra_data={"rated_power": 1.8 if dtype is DeviceType.DISHWASHER else 2.0},
                execution_mode="simulation",
            )
        )
        created["devices"] += 1
    if created["devices"]:
        await db.flush()
        result = await db.execute(select(Device))
        devices = list(result.scalars().all())

    existing_cats = {
        row.device_id
        for row in (await db.execute(select(DeviceMeteringCategory))).scalars().all()
    }
    for device in devices:
        key = _type_key(device)
        mapping = CATEGORY_BY_TYPE.get(key) if key else None
        if not mapping or device.id in existing_cats:
            continue
        category, meter_type = mapping
        db.add(
            DeviceMeteringCategory(
                device_id=device.id, category=category, meter_type=meter_type
            )
        )
        created["categories"] += 1

    existing_meters = {
        row.meter_id for row in (await db.execute(select(ShuntMeter))).scalars().all()
    }
    if "GRID001" not in existing_meters:
        db.add(
            ShuntMeter(
                meter_id="GRID001",
                device_id=None,
                role="grid",
                voltage=0.0,
                current=0.0,
                power=0.0,
                updated_at=datetime.now(timezone.utc),
            )
        )
        created["shunts"] += 1
        existing_meters.add("GRID001")

    for meter_id, name_part, type_name in SHUNT_ASSIGNMENTS:
        if meter_id in existing_meters:
            continue
        device = _pick_device(devices, name_part, type_name)
        db.add(
            ShuntMeter(
                meter_id=meter_id,
                device_id=device.id if device else None,
                role="device",
                voltage=0.0,
                current=0.0,
                power=0.0,
                updated_at=datetime.now(timezone.utc),
            )
        )
        created["shunts"] += 1

    existing_epm = {
        row.device_id for row in (await db.execute(select(DeviceEpm))).scalars().all()
    }
    for device in devices:
        key = _type_key(device)
        mapping = CATEGORY_BY_TYPE.get(key) if key else None
        if not mapping or mapping[0] != 1 or device.id in existing_epm:
            continue
        db.add(
            DeviceEpm(
                device_id=device.id,
                voltage=0.0,
                current=0.0,
                power=0.0,
                updated_at=datetime.now(timezone.utc),
            )
        )
        created["epm"] += 1

    await db.commit()
    logger.info("Shunt metering seed: %s", created)
    return created


def seed_shunt_metering_sql(connection) -> None:
    """Sync SQL seed used by Alembic. INSERT ... WHERE NOT EXISTS only."""
    connection.execute(text("""
        INSERT INTO device_metering_categories (device_id, category, meter_type)
        SELECT d.id,
               CASE
                 WHEN d.type::text IN ('SMART_SWITCH','HEAT_PUMP','HVAC','AIR_CONDITIONER',
                                       'WATER_HEATER','SMART_LIGHT','smart_switch','heat_pump',
                                       'hvac','air_conditioner','water_heater','smart_light') THEN 1
                 WHEN d.type::text IN ('DISHWASHER','WASHING_MACHINE','SOLAR_PV','NEBULIZER',
                                       'ENERGY_EVSE','dishwasher','washing_machine','solar_pv',
                                       'nebulizer','energy_evse') THEN 2
                 WHEN d.type::text IN ('DOOR_LOCK','CAMERA','EV_VEHICLE','door_lock','camera',
                                       'ev_vehicle') THEN 3
               END,
               CASE
                 WHEN d.type::text IN ('SMART_SWITCH','HEAT_PUMP','HVAC','AIR_CONDITIONER',
                                       'WATER_HEATER','SMART_LIGHT','smart_switch','heat_pump',
                                       'hvac','air_conditioner','water_heater','smart_light') THEN 'Internal'
                 WHEN d.type::text IN ('DISHWASHER','WASHING_MACHINE','SOLAR_PV','NEBULIZER',
                                       'ENERGY_EVSE','dishwasher','washing_machine','solar_pv',
                                       'nebulizer','energy_evse') THEN 'Shunt'
                 ELSE 'None'
               END
        FROM devices d
        WHERE NOT EXISTS (
            SELECT 1 FROM device_metering_categories c WHERE c.device_id = d.id
        )
        AND (
            d.type::text IN (
                'SMART_SWITCH','HEAT_PUMP','HVAC','AIR_CONDITIONER','WATER_HEATER','SMART_LIGHT',
                'DISHWASHER','WASHING_MACHINE','SOLAR_PV','NEBULIZER','ENERGY_EVSE',
                'DOOR_LOCK','CAMERA','EV_VEHICLE',
                'smart_switch','heat_pump','hvac','air_conditioner','water_heater','smart_light',
                'dishwasher','washing_machine','solar_pv','nebulizer','energy_evse',
                'door_lock','camera','ev_vehicle'
            )
        )
    """))
    connection.execute(text("""
        INSERT INTO shunt_meters (meter_id, device_id, role, voltage, current, power, updated_at)
        SELECT 'GRID001', NULL, 'grid', 0, 0, 0, CURRENT_TIMESTAMP
        WHERE NOT EXISTS (SELECT 1 FROM shunt_meters WHERE meter_id = 'GRID001')
    """))
    assignments = [
        ("SHUNT001", "%dish%"),
        ("SHUNT002", "%washing%"),
        ("SHUNT003", "%solar%"),
        ("SHUNT004", "%nebuli%"),
        ("SHUNT005", "%charger%"),
    ]
    for meter_id, pattern in assignments:
        connection.execute(text("""
            INSERT INTO shunt_meters (meter_id, device_id, role, voltage, current, power, updated_at)
            SELECT :meter_id, d.id, 'device', 0, 0, 0, CURRENT_TIMESTAMP
            FROM devices d
            WHERE LOWER(d.name) LIKE :pattern
              AND NOT EXISTS (SELECT 1 FROM shunt_meters WHERE meter_id = :meter_id)
            ORDER BY d.name
            LIMIT 1
        """), {"meter_id": meter_id, "pattern": pattern})
        # If the name match missed (e.g. EVSE named Energy EVSE), still insert an unlinked meter.
        connection.execute(text("""
            INSERT INTO shunt_meters (meter_id, device_id, role, voltage, current, power, updated_at)
            SELECT :meter_id, NULL, 'device', 0, 0, 0, CURRENT_TIMESTAMP
            WHERE NOT EXISTS (SELECT 1 FROM shunt_meters WHERE meter_id = :meter_id)
        """), {"meter_id": meter_id})
    connection.execute(text("""
        INSERT INTO device_epm (device_id, voltage, current, power, updated_at)
        SELECT c.device_id, 0, 0, 0, CURRENT_TIMESTAMP
        FROM device_metering_categories c
        WHERE c.category = 1
          AND NOT EXISTS (SELECT 1 FROM device_epm e WHERE e.device_id = c.device_id)
    """))


async def _run() -> None:
    logging.basicConfig(level=logging.INFO)
    await init_db()
    async with async_session_factory() as db:
        created = await seed_shunt_metering(db)
        print(created)


if __name__ == "__main__":
    asyncio.run(_run())
