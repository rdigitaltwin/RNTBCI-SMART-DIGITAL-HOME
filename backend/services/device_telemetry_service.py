from __future__ import annotations
import logging
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.models import Device, DeviceState
from backend.redis.client import redis_client

logger = logging.getLogger(__name__)


async def update_device_telemetry(device_id: str, updates: dict, db: AsyncSession) -> Device | None:
    """Generic telemetry ingestion for any device type.
    
    Updates metadata (extra_data), recomputes energy_usage_kw from ActivePower (mW -> kW),
    updates _last_real_telemetry_ts when in or entering device mode,
    records a DeviceState history row, and publishes the device update to Redis.
    """
    try:
        device_uuid = uuid.UUID(str(device_id))
        result = await db.execute(
            select(Device).options(selectinload(Device.room)).where(Device.id == device_uuid)
        )
        device = result.scalar_one_or_none()
    except (ValueError, AttributeError):
        return None

    if not device:
        return None

    metadata = dict(device.extra_data or {})
    metadata.update(updates)
    device.extra_data = metadata

    # If ActivePower was set, immediately update energy_usage_kw (mW -> kW)
    if "ActivePower" in updates:
        active_power_mw = updates["ActivePower"]
        device.energy_usage_kw = round(active_power_mw / 1_000_000, 4)
        device.last_updated = datetime.now(timezone.utc)

    # Handle execution_mode and _last_real_telemetry_ts:
    if updates.get("execution_mode") == "simulation":
        device.execution_mode = "simulation"
        metadata.pop("_last_real_telemetry_ts", None)
        device.extra_data = metadata
    elif (
        updates.get("execution_mode") == "device"
        or "ActivePower" in updates
        or "Voltage" in updates
        or "ActiveCurrent" in updates
        or device.execution_mode == "device"
    ):
        device.execution_mode = "device"
        metadata["_last_real_telemetry_ts"] = datetime.now(timezone.utc).isoformat()
        device.extra_data = metadata
    elif not device.execution_mode:
        device.execution_mode = "simulation"

    # Durable commit to database
    state = DeviceState(
        device_id=device.id,
        state_json=metadata,
    )
    db.add(state)
    await db.commit()

    # Best-effort Redis publish
    try:
        from backend.api.v1.devices import _device_to_response
        device_resp = _device_to_response(device)
        await redis_client.publish_device_update(str(device.id), {
            "action": "device.updated",
            "device": device_resp.model_dump(mode="json"),
        })
    except Exception as e:
        logger.warning(f"Device telemetry Redis publish failed for {device.id} (non-fatal): {e}")

    return device


class DeviceTelemetryService:
    @staticmethod
    async def update_device_telemetry(device_id: str, updates: dict, db: AsyncSession) -> Device | None:
        return await update_device_telemetry(device_id, updates, db)


device_telemetry_service = DeviceTelemetryService()
