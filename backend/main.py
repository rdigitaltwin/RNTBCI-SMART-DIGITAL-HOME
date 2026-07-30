"""RNTBCI Smart Home Digital Twin - FastAPI Application Entry Point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from backend.api.router import api_v1_router
from backend.config import get_settings
from backend.database import close_db, init_db
from backend.middleware.security import setup_middleware
from backend.redis.client import redis_client
from backend.services.simulation import device_simulator
from backend.websockets.manager import ws_manager

import os
from pythonjsonlogger import jsonlogger

# Set up JSON logging to file
log_dir = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, "system.log")

root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)

# JSON File Handler
file_handler = logging.FileHandler(log_file)
formatter = jsonlogger.JsonFormatter('%(asctime)s %(levelname)s %(name)s %(message)s')
file_handler.setFormatter(formatter)
root_logger.addHandler(file_handler)

# Standard Console Handler
console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
root_logger.addHandler(console_handler)

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager."""
    logger.info("Starting RNTBCI Smart Home Digital Twin v%s", settings.app_version)

    import asyncio

    # Start database initialization and seeding in the background 
    # so the application can start even if the database is temporarily offline
    async def startup_db_tasks():
        db_ready = await init_db()
        if not db_ready:
            logger.warning("Database unavailable.")

    asyncio.create_task(startup_db_tasks())

    # Connect Redis (Redis client handles its own offline states usually)
    try:
        await redis_client.connect()
    except Exception as e:
        logger.error(f"Redis connection failed during startup: {e}")

    # Start WebSocket manager
    await ws_manager.start()

    # Start simulation engine
    await device_simulator.start()
    logger.info("Simulation engine started")

    yield

    # Shutdown
    logger.info("Shutting down RNTBCI Smart Home Digital Twin")
    await device_simulator.stop()
    await ws_manager.stop()
    await redis_client.disconnect()
    await close_db()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Enterprise-grade Smart Home Digital Twin Platform with immersive 3D visualization, "
                "real-time device simulation, energy management, and intelligent automation.",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# Setup middleware (CORS, security headers, rate limiting)
setup_middleware(app)

# Include API routes
app.include_router(api_v1_router)


# WebSocket endpoint
@app.websocket("/api/v1/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None):
    """WebSocket endpoint for real-time updates.

    Connect with optional JWT token for authenticated sessions.
    Supports channels: device:updates, events:stream, system:alerts,
    system:metrics, system:hems, system:pipeline, system:replay.
    """
    conn_id = await ws_manager.connect(websocket, token)
    if not conn_id:
        return

    try:
        while True:
            data = await websocket.receive_text()
            await ws_manager.handle_message(conn_id, data)
    except WebSocketDisconnect:
        await ws_manager.disconnect(conn_id)
    except Exception as e:
        logger.error("WebSocket error: %s", str(e))
        await ws_manager.disconnect(conn_id)


# Health check
@app.get("/health")
async def health_check():
    """Application health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.app_version,
        "redis": redis_client.is_connected,
        "websocket_connections": ws_manager.active_connections,
        "simulation_running": device_simulator.is_running,
        "simulation_speed": device_simulator.speed,
    }


# Rooms endpoint
@app.get("/api/v1/rooms")
async def list_rooms():
    """List all rooms in the smart home."""
    from sqlalchemy import select
    from backend.database import async_session_factory
    from backend.models import Room

    async with async_session_factory() as db:
        result = await db.execute(select(Room))
        rooms = result.scalars().all()
        return [
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
                "metadata": r.extra_data or {},
            }
            for r in rooms
        ]

# Add debug router
try:
    from backend.api.v1.debug import router as debug_router
    app.include_router(debug_router, prefix="/api/v1")
except Exception as e:
    pass

@app.post("/api/v1/seed")
async def trigger_seed():
    """Temporary endpoint to trigger database seed on Railway."""
    from backend.utils.seed import seed_database
    from backend.database.connection import engine, Base
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # First drop everything to start fresh
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        
        # Then seed
        await seed_database(force=True)
        return {"status": "success", "message": "Database seeded successfully."}
    except Exception as e:
        logger.error(f"Seed error: {e}")
        return {"status": "error", "message": str(e)}
