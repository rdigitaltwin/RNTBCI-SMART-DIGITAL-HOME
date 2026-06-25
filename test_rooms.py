import asyncio
import json
from sqlalchemy import select
from backend.database import async_session_factory
from backend.models import Room

async def test():
    async with async_session_factory() as db:
        result = await db.execute(select(Room))
        rooms = result.scalars().all()
        data = [
            {
                "id": str(r.id),
                "name": r.name,
                "type": r.type.value if hasattr(r.type, "value") else r.type,
                "floor": r.floor,
                "position_x": r.position_x,
                "position_y": r.position_y,
                "position_z": r.position_z,
                "width": r.width,
                "depth": r.depth,
                "height": r.height,
                "metadata": r.metadata or {},
            }
            for r in rooms
        ]
        try:
            print(json.dumps(data))
            print("Serialization successful!")
        except Exception as e:
            print("Serialization error:", type(e), e)

asyncio.run(test())
