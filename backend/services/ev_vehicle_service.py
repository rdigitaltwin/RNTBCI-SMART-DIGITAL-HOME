from __future__ import annotations
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models import Device, DeviceEvent, DeviceState, EventSeverity
from backend.redis.client import redis_client

logger = logging.getLogger(__name__)

EV_VEHICLE_FIELDS = ("HVBATVoltage", "HVSoC", "AuxBatVoltage", "AvgSpeed")


class EvVehicleService:
    @staticmethod
    async def get_device(device_id: str, db: AsyncSession) -> Device | None:
        try:
            device_uuid = uuid.UUID(device_id)
        except ValueError:
            return None
        result = await db.execute(
            select(Device).options(selectinload(Device.room)).where(Device.id == device_uuid)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_current_state(device_id: str, db: AsyncSession) -> dict:
        device = await EvVehicleService.get_device(device_id, db)
        if not device:
            return {}
        return dict(device.extra_data or {})

    @staticmethod
    async def update_ev_vehicle_state(
        device_id: str,
        updates: dict,
        db: AsyncSession,
        event_message: str | None = None,
    ) -> Device | None:
        device = await EvVehicleService.get_device(device_id, db)
        if not device:
            return None

        metadata = dict(device.extra_data or {})
        metadata.update(updates)
        device.extra_data = metadata
        device.last_updated = datetime.now(timezone.utc)

        state = DeviceState(device_id=device.id, state_json=metadata)
        db.add(state)

        if event_message:
            message = f"{device.name}: {event_message}"
            db.add(
                DeviceEvent(
                    device_id=device.id,
                    event_type="value_update",
                    severity=EventSeverity.INFO,
                    message=message,
                    extra_data=updates,
                )
            )

        await db.commit()

        try:
            from backend.api.v1.devices import _device_to_response

            device_resp = _device_to_response(device)
            await redis_client.publish_device_update(
                str(device.id),
                {
                    "action": "device.updated",
                    "device": device_resp.model_dump(mode="json"),
                },
            )
            if event_message:
                await redis_client.publish_event(
                    {
                        "device_id": str(device.id),
                        "device_name": device.name,
                        "event_type": "value_update",
                        "severity": "info",
                        "message": f"{device.name}: {event_message}",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
        except Exception as e:
            logger.warning("EV Vehicle Redis publish failed (non-fatal): %s", e)
        return device

    @staticmethod
    def reading(state: dict, key: str, default: float | int = 0):
        value = state.get(key)
        return default if value is None else value


ev_vehicle_service = EvVehicleService()
