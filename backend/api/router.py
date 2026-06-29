"""RNTBCI Smart Home Digital Twin - API Router Assembly."""

from fastapi import APIRouter

from backend.api.v1.auth import router as auth_router
from backend.api.v1.dashboard import dashboard_router, energy_router
from backend.api.v1.devices import router as devices_router
from backend.api.v1.enterprise import (
    hems_router,
    hub_router,
    location_router,
    pipeline_router,
    scenario_router,
    simulation_router,
    timetravel_router,
)
from backend.api.v1.events import alerts_router, events_router
from backend.api.v1.system import router as system_router

api_v1_router = APIRouter(prefix="/api/v1")

# Core routes
api_v1_router.include_router(auth_router)
api_v1_router.include_router(devices_router)
api_v1_router.include_router(dashboard_router)
api_v1_router.include_router(energy_router)
api_v1_router.include_router(events_router)
api_v1_router.include_router(alerts_router)
api_v1_router.include_router(system_router)

# Enterprise modules
api_v1_router.include_router(simulation_router)
api_v1_router.include_router(scenario_router)
api_v1_router.include_router(hems_router)
api_v1_router.include_router(hub_router)
api_v1_router.include_router(location_router)
api_v1_router.include_router(pipeline_router)
api_v1_router.include_router(timetravel_router)
