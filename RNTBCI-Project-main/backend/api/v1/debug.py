from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend.database.connection import get_db
from backend.models import Device

router = APIRouter(tags=["debug"])

@router.get("/debug/devices")
async def get_all_devices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Device))
    devices = result.scalars().all()
    return [{"id": str(d.id), "name": d.name, "type": d.type} for d in devices]
