"""Background job that writes simulated shunt / EPM readings.

Reads existing device power_state only. Never writes Device rows.
Skips a meter for 30 seconds after a real POST so ESP32 data is kept.
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from backend.database import async_session_factory
from backend.models import Device, DeviceEpm, DeviceMeteringCategory, DeviceType, PowerState, ShuntMeter
from backend.services.metering import compute_power

logger = logging.getLogger(__name__)

RATED_W = {
    DeviceType.DISHWASHER: 1800.0,
    DeviceType.WASHING_MACHINE: 500.0,
    DeviceType.WATER_HEATER: 2000.0,
    DeviceType.SMART_LIGHT: 15.0,
    DeviceType.SMART_SWITCH: 1.5,
    DeviceType.HVAC: 2500.0,
    DeviceType.HEAT_PUMP: 2500.0,
    DeviceType.AIR_CONDITIONER: 2500.0,
    DeviceType.NEBULIZER: 40.0,
    DeviceType.ENERGY_EVSE: 7400.0,
    DeviceType.SOLAR_PV: 4690.0,
}

HOLD_AFTER_POST = timedelta(seconds=30)


def _interval_seconds() -> float:
    raw = os.getenv("METERING_INTERVAL_MS", "5000")
    try:
        ms = max(500, int(raw))
    except (TypeError, ValueError):
        ms = 5000
    return ms / 1000.0


def _enabled() -> bool:
    return os.getenv("METERING_SIMULATOR", "on").strip().lower() not in {"off", "0", "false", "no"}


def _device_type(device: Device) -> DeviceType | None:
    raw = device.type
    if isinstance(raw, DeviceType):
        return raw
    try:
        return DeviceType(str(raw).lower())
    except ValueError:
        name = str(raw).upper()
        return DeviceType[name] if name in DeviceType.__members__ else None


def _is_running(device: Device) -> bool:
    state = device.power_state
    raw = getattr(state, "value", state)
    return str(raw).lower() == PowerState.ON.value


def _rated_watts(device: Device) -> float:
    key = _device_type(device)
    if key in RATED_W:
        return RATED_W[key]
    return 100.0


def _sample(running: bool, rated_w: float) -> tuple[float, float, float]:
    voltage = 230.0 + random.uniform(-2.0, 2.0)
    if not running:
        return round(voltage, 3), 0.0, 0.0
    current = (rated_w / 230.0) * random.uniform(0.95, 1.05)
    power = compute_power(voltage, current)
    return round(voltage, 3), round(current, 4), power


def _recently_posted(stamp, now: datetime) -> bool:
    if stamp is None:
        return False
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return now - stamp < HOLD_AFTER_POST


class MeteringSimulator:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        if not _enabled():
            logger.info("Metering simulator disabled (METERING_SIMULATOR=off)")
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("Metering simulator started (interval %.1fs)", _interval_seconds())

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _loop(self) -> None:
        while self._running:
            try:
                await self.tick()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Metering simulator tick failed")
            await asyncio.sleep(_interval_seconds())

    async def tick(self) -> None:
        now = datetime.now(timezone.utc)
        async with async_session_factory() as db:
            devices = {
                row.id: row
                for row in (await db.execute(select(Device))).scalars().all()
            }
            categories = {
                row.device_id: row
                for row in (await db.execute(select(DeviceMeteringCategory))).scalars().all()
            }
            shunts = list((await db.execute(select(ShuntMeter))).scalars().all())
            epms = list((await db.execute(select(DeviceEpm))).scalars().all())

            load_power = 0.0
            for row in epms:
                device = devices.get(row.device_id)
                if not device:
                    continue
                if _recently_posted(row.last_posted_at, now):
                    load_power += row.power or 0.0
                    continue
                mapping = categories.get(device.id)
                if mapping and mapping.category != 1:
                    continue
                voltage, current, power = _sample(_is_running(device), _rated_watts(device))
                row.voltage, row.current, row.power = voltage, current, power
                row.updated_at = now
                load_power += power

            for meter in shunts:
                if meter.role == "grid":
                    continue
                if _recently_posted(meter.last_posted_at, now):
                    device = devices.get(meter.device_id) if meter.device_id else None
                    dtype = _device_type(device) if device else None
                    if dtype != DeviceType.SOLAR_PV:
                        load_power += meter.power or 0.0
                    continue
                device = devices.get(meter.device_id) if meter.device_id else None
                if not device:
                    meter.voltage, meter.current, meter.power = _sample(False, 0)
                    meter.updated_at = now
                    continue
                voltage, current, power = _sample(_is_running(device), _rated_watts(device))
                meter.voltage, meter.current, meter.power = voltage, current, power
                meter.updated_at = now
                if _device_type(device) != DeviceType.SOLAR_PV:
                    load_power += power

            grid = next((meter for meter in shunts if meter.role == "grid"), None)
            if grid and not _recently_posted(grid.last_posted_at, now):
                voltage = 230.0 + random.uniform(-2.0, 2.0)
                current = (load_power / voltage) if voltage else 0.0
                grid.voltage = round(voltage, 3)
                grid.current = round(current, 4)
                grid.power = round(load_power, 4)
                grid.updated_at = now

            await db.commit()


metering_simulator = MeteringSimulator()
