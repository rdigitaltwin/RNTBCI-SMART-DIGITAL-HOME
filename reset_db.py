import asyncio
import os
import sys

# Ensure backend can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database.connection import engine, Base
from backend.models.models import *  # import all models so they are registered in Base.metadata

async def reset():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        print("Successfully dropped all tables on Railway!")

if __name__ == "__main__":
    asyncio.run(reset())
