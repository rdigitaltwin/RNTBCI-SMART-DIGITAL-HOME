"""RNTBCI Smart Home Digital Twin - Enterprise Module API Routes.

Covers: Simulation control, Scenarios, HEMS, Metrics, Time Travel, Controller Hub.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, require_admin, require_user_or_admin
from backend.database import get_db
from backend.models import User
from backend.services.controller_hub import controller_hub
from backend.services.hems import energy_manager
from backend.services.location import location_engine
from backend.services.pipeline import data_pipeline
from backend.services.scenarios import scenario_manager
from backend.services.simulation import device_simulator

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)


# =============================================================================
# SCHEMAS
# =============================================================================


class SimulationControlRequest(BaseModel):
    action: str = Field(..., pattern="^(play|pause|reset|change_speed)$")
    speed: float | None = None


class ReplayRequest(BaseModel):
    start_time: datetime
    end_time: datetime
    speed: float = 1.0


class SeekRequest(BaseModel):
    target_time: datetime


class ScenarioActivateRequest(BaseModel):
    scenario_id: str


class ScenarioCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    icon: str = "settings"
    trigger: str = "manual"
    rules: list[dict] = []


class LocationUpdateRequest(BaseModel):
    user_id: str
    name: str
    latitude: float
    longitude: float
    speed_kmh: float = 0.0


class ControllerHubCommandRequest(BaseModel):
    device_id: str
    command: str
    params: dict = {}
    adapter: str | None = None


class HEMSBudgetRequest(BaseModel):
    power_budget_w: float = Field(..., ge=1000, le=50000)


# =============================================================================
# SIMULATION ROUTES
# =============================================================================

simulation_router = APIRouter(prefix="/simulation", tags=["Simulation"])


@simulation_router.get("/status")
@limiter.limit("60/minute")
async def get_simulation_status(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get current simulation engine status."""
    return {
        "running": device_simulator.is_running,
        "paused": device_simulator.is_paused,
        "speed": device_simulator.speed,
        "metrics": device_simulator.metrics,
    }


@simulation_router.post("/control")
@limiter.limit("30/minute")
async def control_simulation(
    request: Request,
    data: SimulationControlRequest,
    current_user: User = Depends(require_user_or_admin),
) -> dict:
    """Control the simulation engine (play/pause/reset/speed)."""
    if data.action == "play":
        device_simulator.play()
    elif data.action == "pause":
        device_simulator.pause()
    elif data.action == "reset":
        device_simulator.reset()
    elif data.action == "change_speed":
        if data.speed is None:
            raise HTTPException(status_code=400, detail="Speed required for change_speed action")
        device_simulator.change_speed(data.speed)

    return {
        "action": data.action,
        "running": device_simulator.is_running,
        "paused": device_simulator.is_paused,
        "speed": device_simulator.speed,
    }


@simulation_router.post("/replay")
@limiter.limit("10/minute")
async def start_replay(
    request: Request,
    data: ReplayRequest,
    current_user: User = Depends(require_user_or_admin),
) -> dict:
    """Start historical replay mode."""
    device_simulator.change_speed(data.speed)
    await device_simulator.start_replay(data.start_time, data.end_time)
    return {
        "status": "replay_started",
        "start": data.start_time.isoformat(),
        "end": data.end_time.isoformat(),
        "speed": data.speed,
    }


@simulation_router.post("/replay/stop")
@limiter.limit("10/minute")
async def stop_replay(
    request: Request,
    current_user: User = Depends(require_user_or_admin),
) -> dict:
    """Stop historical replay and return to live mode."""
    device_simulator.stop_replay()
    return {"status": "live_mode"}


@simulation_router.post("/seek")
@limiter.limit("30/minute")
async def seek_simulation(
    request: Request,
    data: SeekRequest,
    current_user: User = Depends(require_user_or_admin),
) -> dict:
    """Seek to a specific time in history."""
    await device_simulator.seek(data.target_time)
    return {"status": "seeking", "target": data.target_time.isoformat()}


@simulation_router.get("/metrics")
@limiter.limit("60/minute")
async def get_simulation_metrics(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get detailed simulation metrics."""
    return device_simulator.metrics


# =============================================================================
# SCENARIO ROUTES
# =============================================================================

scenario_router = APIRouter(prefix="/scenarios", tags=["Scenarios"])


@scenario_router.get("")
@limiter.limit("60/minute")
async def list_scenarios(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List all available scenarios."""
    return scenario_manager.available_scenarios


@scenario_router.post("/activate")
@limiter.limit("20/minute")
async def activate_scenario(
    request: Request,
    data: ScenarioActivateRequest,
    current_user: User = Depends(require_user_or_admin),
) -> dict:
    """Activate a scenario."""
    try:
        result = await scenario_manager.activate(data.scenario_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@scenario_router.post("/deactivate")
@limiter.limit("20/minute")
async def deactivate_scenario(
    request: Request,
    data: ScenarioActivateRequest,
    current_user: User = Depends(require_user_or_admin),
) -> dict:
    """Deactivate a scenario."""
    return await scenario_manager.deactivate(data.scenario_id)


@scenario_router.post("/create")
@limiter.limit("10/minute")
async def create_custom_scenario(
    request: Request,
    data: ScenarioCreateRequest,
    current_user: User = Depends(require_admin),
) -> dict:
    """Create a custom scenario."""
    scenario_id = data.name.lower().replace(" ", "_")
    return scenario_manager.create_scenario(scenario_id, data.model_dump())


@scenario_router.delete("/{scenario_id}")
@limiter.limit("10/minute")
async def delete_scenario(
    request: Request,
    scenario_id: str,
    current_user: User = Depends(require_admin),
) -> dict:
    """Delete a custom scenario."""
    if scenario_manager.delete_scenario(scenario_id):
        return {"status": "deleted", "scenario_id": scenario_id}
    raise HTTPException(status_code=404, detail="Scenario not found or is built-in")


# =============================================================================
# HEMS ROUTES
# =============================================================================

hems_router = APIRouter(prefix="/hems", tags=["HEMS"])


@hems_router.get("/status")
@limiter.limit("60/minute")
async def get_hems_status(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get HEMS status and current energy analysis."""
    return energy_manager.status


@hems_router.get("/analyze")
@limiter.limit("30/minute")
async def run_hems_analysis(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Run a full HEMS analysis cycle."""
    return await energy_manager.analyze()


@hems_router.post("/optimize")
@limiter.limit("10/minute")
async def run_hems_optimization(
    request: Request,
    current_user: User = Depends(require_admin),
) -> dict:
    """Run HEMS optimization (may auto-adjust devices)."""
    return await energy_manager.optimize()


@hems_router.post("/budget")
@limiter.limit("10/minute")
async def set_power_budget(
    request: Request,
    data: HEMSBudgetRequest,
    current_user: User = Depends(require_admin),
) -> dict:
    """Set the maximum power budget."""
    energy_manager.set_power_budget(data.power_budget_w)
    return {"power_budget_w": data.power_budget_w, "status": "updated"}


# =============================================================================
# CONTROLLER HUB ROUTES
# =============================================================================

hub_router = APIRouter(prefix="/hub", tags=["Controller Hub"])


@hub_router.get("/adapters")
@limiter.limit("60/minute")
async def list_adapters(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> dict:
    """List all registered adapters."""
    return {"adapters": controller_hub.adapters}


@hub_router.post("/command")
@limiter.limit("60/minute")
async def send_hub_command(
    request: Request,
    data: ControllerHubCommandRequest,
    current_user: User = Depends(require_user_or_admin),
) -> dict:
    """Send a command through the Controller Hub."""
    try:
        return await controller_hub.send_command(
            data.device_id, data.command, data.params, data.adapter
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@hub_router.get("/history")
@limiter.limit("60/minute")
async def get_command_history(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Get recent command history."""
    return controller_hub.command_history


# =============================================================================
# LOCATION ROUTES
# =============================================================================

location_router = APIRouter(prefix="/location", tags=["Location"])


@location_router.get("/users")
@limiter.limit("60/minute")
async def get_tracked_users(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Get all tracked user locations."""
    return location_engine.all_users


@location_router.post("/update")
@limiter.limit("60/minute")
async def update_user_location(
    request: Request,
    data: LocationUpdateRequest,
    current_user: User = Depends(require_user_or_admin),
) -> dict:
    """Update a user's location."""
    return location_engine.update_location(
        data.user_id, data.name, data.latitude, data.longitude, data.speed_kmh
    )


# =============================================================================
# DATA PIPELINE ROUTES
# =============================================================================

pipeline_router = APIRouter(prefix="/pipeline", tags=["Data Pipeline"])


@pipeline_router.get("/run")
@limiter.limit("30/minute")
async def run_pipeline(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Run one data pipeline cycle."""
    return await data_pipeline.run_cycle()


@pipeline_router.get("/latest")
@limiter.limit("60/minute")
async def get_pipeline_latest(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get the latest pipeline results."""
    return data_pipeline.last_result


# =============================================================================
# TIME TRAVEL ROUTES
# =============================================================================

timetravel_router = APIRouter(prefix="/timetravel", tags=["Time Travel"])


@timetravel_router.get("/presets")
@limiter.limit("60/minute")
async def get_timetravel_presets(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Get available time travel presets."""
    now = datetime.now(timezone.utc)
    return [
        {"id": "yesterday", "label": "Yesterday",
         "start": (now - timedelta(days=1)).replace(hour=0, minute=0, second=0).isoformat(),
         "end": (now - timedelta(days=1)).replace(hour=23, minute=59, second=59).isoformat()},
        {"id": "last_week", "label": "Last Week",
         "start": (now - timedelta(weeks=1)).isoformat(),
         "end": now.isoformat()},
        {"id": "last_month", "label": "Last Month",
         "start": (now - timedelta(days=30)).isoformat(),
         "end": now.isoformat()},
        {"id": "last_24h", "label": "Last 24 Hours",
         "start": (now - timedelta(hours=24)).isoformat(),
         "end": now.isoformat()},
    ]


@timetravel_router.post("/start")
@limiter.limit("10/minute")
async def start_timetravel(
    request: Request,
    data: ReplayRequest,
    current_user: User = Depends(require_user_or_admin),
) -> dict:
    """Start time travel replay."""
    device_simulator.change_speed(data.speed)
    await device_simulator.start_replay(data.start_time, data.end_time)
    return {
        "status": "time_travel_started",
        "start": data.start_time.isoformat(),
        "end": data.end_time.isoformat(),
        "speed": data.speed,
    }


@timetravel_router.post("/stop")
@limiter.limit("10/minute")
async def stop_timetravel(
    request: Request,
    current_user: User = Depends(require_user_or_admin),
) -> dict:
    """Stop time travel and return to present."""
    device_simulator.stop_replay()
    return {"status": "returned_to_present"}
