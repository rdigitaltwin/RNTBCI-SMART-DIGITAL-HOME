import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from backend.models import Device, DeviceType, DeviceState

DATABASE_URL = "postgresql+asyncpg://postgres:uxETdbfzUFRNXFnIfkElMQlPHVKpWTot@reseau.proxy.rlwy.net:48986/railway"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)

async def update_ev():
    async with async_session() as db:
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
        print(f"Successfully updated {updated_count} EV Vehicles in the remote database.")

if __name__ == "__main__":
    asyncio.run(update_ev())
