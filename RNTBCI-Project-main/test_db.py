import asyncio
from sqlalchemy import select
from backend.database.connection import async_session_factory
from backend.models import Device

async def main():
    async with async_session_factory() as db:
        result = await db.execute(select(Device).where(Device.name.ilike('%Bathroom Light%')))
        device = result.scalars().first()
        if device:
            print(f"Name: {device.name}, Power: {device.energy_usage_kw} kW")
        else:
            print("Not found")

asyncio.run(main())
