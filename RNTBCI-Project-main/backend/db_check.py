import asyncio
import os
import sys

from backend.database.connection import engine
from sqlalchemy import text

async def check():
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT DISTINCT type FROM devices"))
        print("Distinct device types in DB:")
        for row in result:
            print(row[0])
            
        result = await conn.execute(text("SELECT id, name, type FROM devices WHERE type = 'cooking' OR type = 'COOKING'"))
        print("\nDevices with type COOKING:")
        for row in result:
            print(row)

if __name__ == "__main__":
    asyncio.run(check())
