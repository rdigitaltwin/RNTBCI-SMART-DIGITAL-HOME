import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.connection import engine
from utils.seed import seed_database
from models.models import Base

async def run():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await seed_database(force=True)
    print("Database seeded successfully")

if __name__ == "__main__":
    asyncio.run(run())
