import asyncio
import os
import sys

from backend.database.connection import engine
from backend.utils.seed import seed_database
from backend.models.models import Base

async def run():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await seed_database(force=True)
    print("Database seeded successfully")

if __name__ == "__main__":
    asyncio.run(run())
