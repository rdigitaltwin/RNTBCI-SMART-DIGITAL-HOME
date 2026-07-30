import json
import logging
import os
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.models import Device, DeviceState, DeviceEvent, EventSeverity, PowerState
from backend.redis.client import redis_client

logger = logging.getLogger(__name__)

class EVSEService:
    @staticmethod
    def _find_evse_file(identifier: str) -> str | None:
        logs_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "../data"))
        if not os.path.isdir(logs_dir):
            return None
            
        safe_name = os.path.basename(identifier)
        direct_path = os.path.join(logs_dir, f"device_{safe_name}.json")
        if os.path.isfile(direct_path):
            return direct_path
            
        for filename in os.listdir(logs_dir):
            if filename.startswith("device_") and filename.endswith(".json"):
                filepath = os.path.join(logs_dir, filename)
                try:
                    with open(filepath, "r") as f:
                        data = json.load(f)
                        if data.get("deviceType", {}).get("device_id") == identifier or \
                           data.get("deviceType", {}).get("name") == identifier:
                            return filepath
                except Exception:
                    continue
        return None

    @staticmethod
    async def get_evse_device(identifier: str) -> dict:
        file_path = EVSEService._find_evse_file(identifier)
        if not file_path:
            return None
        with open(file_path, "r") as f:
            return json.load(f)

    @staticmethod
    async def update_evse_state(device_id: str, updates: dict, db: AsyncSession):
        device_uuid = uuid.UUID(device_id)
        result = await db.execute(select(Device).options(selectinload(Device.room)).where(Device.id == device_uuid))
        device = result.scalar_one_or_none()
        if not device:
            return None
            
        metadata = dict(device.extra_data or {})
        metadata.update(updates)
        device.extra_data = metadata
        
        state = DeviceState(
            device_id=device.id,
            state_json=metadata,
        )
        db.add(state)
        await db.commit()
        
        from backend.api.v1.devices import _device_to_response
        device_resp = _device_to_response(device)
        await redis_client.publish_device_update(str(device.id), {
            "action": "device.updated",
            "device": device_resp.model_dump(mode="json"),
        })
        return device

    @staticmethod
    async def get_current_state(device_id: str, db: AsyncSession) -> dict:
        device_uuid = uuid.UUID(device_id)
        result = await db.execute(select(Device).where(Device.id == device_uuid))
        device = result.scalar_one_or_none()
        if not device:
            return {}
        return device.extra_data or {}

evse_service = EVSEService()
