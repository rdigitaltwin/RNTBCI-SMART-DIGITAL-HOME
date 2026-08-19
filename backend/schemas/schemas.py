"""RNTBCI Smart Home Digital Twin - Pydantic Schemas.

Request/response validation schemas for all API endpoints.
"""

from __future__ import annotations
import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field, field_validator


# =============================================================================
# AUTH SCHEMAS
# =============================================================================


class RegisterRequest(BaseModel):
    """User registration request."""

    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username must be alphanumeric (underscores and hyphens allowed)")
        return v


class LoginRequest(BaseModel):
    """User login request."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT token pair response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """Token refresh request."""

    refresh_token: str


class UserResponse(BaseModel):
    """Public user profile response."""

    id: uuid.UUID
    email: str
    username: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    last_login: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    """User profile update."""

    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None


# =============================================================================
# ROOM SCHEMAS
# =============================================================================


class RoomResponse(BaseModel):
    """Room data response."""

    id: uuid.UUID
    name: str
    type: str
    floor: int
    position_x: float
    position_y: float
    position_z: float
    width: float
    depth: float
    height: float
    metadata: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class RoomCreateRequest(BaseModel):
    """Room creation request."""

    name: str = Field(..., min_length=1, max_length=100)
    type: str
    floor: int = 0
    position_x: float = 0.0
    position_y: float = 0.0
    position_z: float = 0.0
    width: float = 4.0
    depth: float = 4.0
    height: float = 3.0
    metadata: dict = Field(default_factory=dict)


# =============================================================================
# DEVICE SCHEMAS
# =============================================================================


class DeviceCreateRequest(BaseModel):
    """Device creation request."""

    name: str = Field(..., min_length=1, max_length=200)
    type: str
    room_id: uuid.UUID
    metadata: dict = Field(default_factory=dict)
    position_x: float = 0.0
    position_y: float = 0.0
    position_z: float = 0.0


class DeviceUpdateRequest(BaseModel):
    """Device configuration update."""

    name: str | None = None
    room_id: uuid.UUID | None = None
    metadata: dict | None = None
    position_x: float | None = None
    position_y: float | None = None
    position_z: float | None = None


class DeviceControlRequest(BaseModel):
    """Device control command."""

    command: str = Field(..., min_length=1, max_length=100)
    parameters: dict = Field(default_factory=dict)


class DevicePowerRequest(BaseModel):
    """Device power toggle."""

    power_state: str = Field(..., pattern="^(on|off|standby)$")


class DeviceStateRequest(BaseModel):
    """Device state toggle."""

    status: str = Field(..., pattern="^(ON|OFF)$")


class DeviceResponse(BaseModel):
    """Device data response."""

    id: uuid.UUID
    name: str
    type: str
    room_id: uuid.UUID
    room_name: str | None = None
    status: str
    power_state: str
    connectivity: str
    energy_usage_kw: float
    total_energy_kwh: float
    efficiency_percent: float
    metadata: dict
    position_x: float
    position_y: float
    position_z: float
    turned_on_at: datetime | None
    last_updated: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class DeviceStateResponse(BaseModel):
    """Device state snapshot."""

    id: uuid.UUID
    device_id: uuid.UUID
    state_json: dict
    timestamp: datetime

    model_config = {"from_attributes": True}


class DeviceListResponse(BaseModel):
    """Paginated device list."""

    devices: list[DeviceResponse]
    total: int
    page: int
    per_page: int


class WebhookRegistrationRequest(BaseModel):
    """Webhook registration request."""

    webhook_url: str = Field(..., description="The URL to send webhook events to")


# =============================================================================
# EVENT SCHEMAS
# =============================================================================


class DeviceEventResponse(BaseModel):
    """Device event log entry."""

    id: uuid.UUID
    device_id: uuid.UUID
    device_name: str | None = None
    event_type: str
    severity: str
    message: str
    metadata: dict
    timestamp: datetime

    model_config = {"from_attributes": True}


class EventListResponse(BaseModel):
    """Paginated event list."""

    events: list[DeviceEventResponse]
    total: int
    page: int
    per_page: int


# =============================================================================
# ENERGY SCHEMAS
# =============================================================================


class EnergyRecordResponse(BaseModel):
    """Energy consumption record."""

    id: uuid.UUID
    device_id: uuid.UUID
    power_kw: float
    voltage: float
    current_amps: float
    cost_usd: float
    timestamp: datetime

    model_config = {"from_attributes": True}


class EnergySummaryResponse(BaseModel):
    """Energy analytics summary."""

    total_consumption_kw: float
    peak_load_kw: float
    average_usage_kw: float
    total_cost_usd: float
    efficiency_average: float
    device_count: int
    online_devices: int
    period_start: datetime
    period_end: datetime
    room_breakdown: list[dict]
    device_breakdown: list[dict]
    hourly_data: list[dict]


# =============================================================================
# ALERT SCHEMAS
# =============================================================================


class AlertResponse(BaseModel):
    """Alert data response."""

    id: uuid.UUID
    device_id: uuid.UUID | None
    device_name: str | None = None
    type: str
    severity: str
    message: str
    acknowledged: bool
    metadata: dict
    timestamp: datetime

    model_config = {"from_attributes": True}


class AlertAcknowledgeRequest(BaseModel):
    """Alert acknowledgement."""

    acknowledged: bool = True


# =============================================================================
# DASHBOARD SCHEMAS
# =============================================================================


class DashboardRealtimeResponse(BaseModel):
    """Real-time dashboard aggregation."""

    total_devices: int
    online_devices: int
    offline_devices: int
    faulty_devices: int
    warning_devices: int
    total_energy_kw: float
    peak_load_kw: float
    average_usage_kw: float
    active_alerts: int
    recent_events: list[DeviceEventResponse]
    power_trend: list[dict]
    device_health: dict
    room_stats: list[dict]


# =============================================================================
# POWER HISTORY SCHEMAS
# =============================================================================


class HomePowerHistoryResponse(BaseModel):
    """Single home power history record."""

    id: uuid.UUID
    timestamp: datetime
    total_home_power_consumption_kw: float
    living_room_main_light_kw: float = Field(0.0)
    living_room_main_light_kvar: float = Field(0.0)
    living_room_ac_kw: float = Field(0.0)
    living_room_ac_kvar: float = Field(0.0)
    living_room_switch_kw: float = Field(0.0)
    living_room_switch_kvar: float = Field(0.0)
    kitchen_light_kw: float = Field(0.0)
    kitchen_light_kvar: float = Field(0.0)
    refrigerator_kw: float = Field(0.0)
    refrigerator_kvar: float = Field(0.0)
    dishwasher_kw: float = Field(0.0)
    dishwasher_kvar: float = Field(0.0)
    bedroom_light_kw: float = Field(0.0)
    bedroom_light_kvar: float = Field(0.0)
    bedroom_ac_kw: float = Field(0.0)
    bedroom_ac_kvar: float = Field(0.0)
    door_lock_kw: float = Field(0.0)
    door_lock_kvar: float = Field(0.0)
    bathroom_light_kw: float = Field(0.0)
    bathroom_light_kvar: float = Field(0.0)
    water_heater_kw: float = Field(0.0)
    water_heater_kvar: float = Field(0.0)
    security_camera_kw: float = Field(0.0)
    security_camera_kvar: float = Field(0.0)
    washing_machine_kw: float = Field(0.0)
    washing_machine_kvar: float = Field(0.0)
    smart_plug_dryer_kw: float = Field(0.0)
    smart_plug_dryer_kvar: float = Field(0.0)
    utility_light_kw: float = Field(0.0)
    utility_light_kvar: float = Field(0.0)
    hallway_light_kw: float = Field(0.0)
    hallway_light_kvar: float = Field(0.0)
    front_door_lock_kw: float = Field(0.0)
    front_door_lock_kvar: float = Field(0.0)
    base_load_kw: float = Field(0.0)
    base_load_kvar: float = Field(0.0)
    ev_charger_kw: float = Field(0.0)
    ev_charger_kvar: float = Field(0.0)
    
    solar_generation_kw: float = Field(0.0)
    battery_charge_kw: float = Field(0.0)
    battery_discharge_kw: float = Field(0.0)
    battery_soc_percent: float = Field(0.0)
    ev_discharge_kw: float = Field(0.0)
    grid_import_kw: float = Field(0.0)
    grid_export_kw: float = Field(0.0)

    created_at: datetime

    model_config = {"from_attributes": True}


class HomePowerHistoryListResponse(BaseModel):
    """Paginated home power history."""

    records: list[HomePowerHistoryResponse]
    total: int
    page: int
    per_page: int


class DevicePowerHistoryResponse(BaseModel):
    """Single device power history record."""

    device_id: uuid.UUID
    timestamp: datetime
    total_power_consumption_kw: float

    model_config = {"from_attributes": True}


class DevicePowerHistoryListResponse(BaseModel):
    """Paginated device power history."""

    records: list[DevicePowerHistoryResponse]
    total: int
    page: int
    per_page: int


class DeviceModeRequest(BaseModel):
    """Device mode change request."""

    mode: str = Field(..., min_length=1, max_length=50)


# =============================================================================
# WEBSOCKET SCHEMAS
# =============================================================================


class WSMessage(BaseModel):
    """WebSocket message format."""

    type: str
    payload: dict
    timestamp: datetime | None = None
    event_id: str | None = None

# =============================================================================
# EVSE SCHEMAS
# =============================================================================

class EVSESetTargetsRequest(BaseModel):
    commandId: str = "0x05"
    command: str = "SetTargets"
    chargingTargetSchedules: list = Field(default_factory=list)

class EVSECommandRequest(BaseModel):
    commandId: str
    command: str
