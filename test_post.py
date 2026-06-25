import asyncio
import json
from sqlalchemy import select
from backend.database import async_session_factory
from backend.models import Room, Device, DeviceType, DeviceEvent, EventSeverity, DeviceState
from fastapi import Request

async def test():
    data = {"name": "Test Device", "type": "smart_tv", "room_id": "473a8d77-54f9-4147-b8d7-564cdc448aaf", "position_x": 0, "position_y": 0, "position_z": 0, "metadata": {}}
    
    async with async_session_factory() as db:
        room_result = await db.execute(select(Room).limit(1))
        room = room_result.scalar_one_or_none()
        
        device_type = DeviceType("smart_tv")
        
        device = Device(
            name="Test Device",
            type=device_type,
            room_id=room.id,
            extra_data={},
            position_x=0,
            position_y=0,
            position_z=0,
        )
        db.add(device)
        
        try:
            await db.flush()
            print("Device flush worked")
        except Exception as e:
            print("Device flush failed:", e)
            return
            
        initial_state = {}
        state = DeviceState(
            device_id=device.id,
            state_json=initial_state,
        )
        db.add(state)
        
        event = DeviceEvent(
            device_id=device.id,
            event_type="device_registered",
            severity=EventSeverity.INFO,
            message=f"Device registered to {room.name}",
            extra_data={"type": "smart_tv", "room": room.name},
        )
        db.add(event)
        
        try:
            await db.commit()
            print("Full commit worked")
        except Exception as e:
            print("Commit failed:", e)

asyncio.run(test())
