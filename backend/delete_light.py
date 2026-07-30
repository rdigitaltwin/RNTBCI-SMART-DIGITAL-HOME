import asyncio
from sqlalchemy import select, delete
from backend.database.connection import async_session_factory
from backend.models import Device

async def delete_light():
    async with async_session_factory() as db:
        await db.execute(delete(Device).where(Device.name == 'Light'))
        await db.commit()
        print("Deleted any generic 'Light' devices.")

if __name__ == "__main__":
    asyncio.run(delete_light())
