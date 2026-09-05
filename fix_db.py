import asyncio
import os
import sys

# Ensure backend can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database.connection import async_session_factory
from backend.models import Device, DeviceType, DeviceState
from sqlalchemy import select

async def update_ev():
    try:
        async with async_session_factory() as db:
            result = await db.execute(select(Device).where(Device.type == DeviceType.EV_VEHICLE))
            devices = result.scalars().all()
            updated_count = 0
            for device in devices:
                metadata = dict(device.extra_data or {})
                if metadata.get("HVBATVoltage", 0) == 0:
                    metadata["HVBATVoltage"] = 400
                    metadata["HVSoC"] = 80
                    metadata["AuxBatVoltage"] = 12.6
                    metadata["AvgSpeed"] = 45
                    device.extra_data = metadata
                    db.add(DeviceState(device_id=device.id, state_json=metadata))
                    updated_count += 1
            await db.commit()
            print(f"✅ Successfully updated {updated_count} EV Vehicles with default metrics in the database.")
    except Exception as e:
        print(f"⚠️ Warning: Could not run fix_db script: {e}")

if __name__ == "__main__":
    asyncio.run(update_ev())
