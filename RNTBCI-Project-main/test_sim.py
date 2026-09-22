import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from backend.models.models import Device
from backend.services.simulation import simulation_engine

async def main():
    engine = create_async_engine("postgresql+asyncpg://postgres:uxETdbfzUFRNXFnIfkElMQlPHVKpWTot@reseau.proxy.rlwy.net:48986/railway")
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as db:
        result = await db.execute(select(Device).where(Device.type == "energy_evse"))
        evse = result.scalar_one_or_none()
        if evse:
            tracker = simulation_engine.ensure_tracker(str(evse.id), "energy_evse")
            tracker.set_power_on()
            tracker.power_phase = "running"
            tracker.phase_timer = 10
            kw, kvar, pf = tracker.get_power_kw_kvar()
            print(f"Power: {kw} kW, Mode: {tracker.operating_mode}, Phase: {tracker.power_phase}")
        else:
            print("No EVSE found")

asyncio.run(main())
