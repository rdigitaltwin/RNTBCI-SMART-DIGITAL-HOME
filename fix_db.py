import asyncio
from backend.database.connection import async_session_factory
from backend.models import Device, DeviceType, DeviceState
from sqlalchemy import select

async def update_ev():
    async with async_session_factory() as db:
        result = await db.execute(select(Device).where(Device.type == DeviceType.EV_VEHICLE))
        devices = result.scalars().all()
        for device in devices:
            metadata = dict(device.extra_data or {})
            if metadata.get("HVBATVoltage", 0) == 0:
                metadata["HVBATVoltage"] = 400
                metadata["HVSoC"] = 80
                metadata["AuxBatVoltage"] = 12.6
                metadata["AvgSpeed"] = 45
                device.extra_data = metadata
                db.add(DeviceState(device_id=device.id, state_json=metadata))
        await db.commit()
        print("Updated successfully")

if __name__ == "__main__":
    asyncio.run(update_ev())
