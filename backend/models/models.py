"""RNTBCI Smart Home Digital Twin - SQLAlchemy Models.

All 12 database tables for the platform:
- Users, Roles, Permissions (Auth & RBAC)
- Rooms, Devices, DeviceStates, DeviceEvents (Home & Devices)
- EnergyHistory (Energy Tracking)
- Alerts, AuditLogs, Notifications, WebSocketSessions (Operations)
"""

from __future__ import annotations
import enum
import uuid
from typing import Optional
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.connection import Base


def utcnow() -> datetime:
    """Return current UTC timestamp."""
    return datetime.now(timezone.utc)


def new_uuid() -> uuid.UUID:
    """Generate a new UUID4."""
    return uuid.uuid4()


# =============================================================================
# ENUMS
# =============================================================================


class RoleName(str, enum.Enum):
    """User roles."""

    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"


class DeviceType(str, enum.Enum):
    """Supported device types."""

    SMART_LIGHT = "smart_light"
    SMART_SWITCH = "smart_switch"
    SMART_PLUG = "smart_plug"
    DOOR_LOCK = "door_lock"
    GARAGE_DOOR = "garage_door"
    HVAC = "hvac"
    WASHING_MACHINE = "washing_machine"
    DISHWASHER = "dishwasher"
    REFRIGERATOR = "refrigerator"
    WATER_HEATER = "water_heater"
    NEBULIZER = "nebulizer"
    ROUTER = "router"
    CAMERA = "camera"
    SMART_TV = "smart_tv"
    COOKING = "cooking"
    BASE_LOAD = "base_load"
    ENERGY_EVSE = "energy_evse"
    SOLAR_PV = "solar_pv"
    BATTERY_STORAGE = "battery_storage"
    MCB = "mcb"


class DeviceStatus(str, enum.Enum):
    """Device operational status."""

    ONLINE = "online"
    OFFLINE = "offline"
    FAULTY = "faulty"
    WARNING = "warning"


class PowerState(str, enum.Enum):
    """Device power state."""

    ON = "on"
    OFF = "off"
    STANDBY = "standby"


class DevicePowerPhase(str, enum.Enum):
    """Device power lifecycle phase for state machine."""

    OFF = "off"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"


class ConnectivityStatus(str, enum.Enum):
    """Device connectivity."""

    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    WEAK = "weak"


class EventSeverity(str, enum.Enum):
    """Event severity levels."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertType(str, enum.Enum):
    """Alert types."""

    DOOR_LEFT_OPEN = "door_left_open"
    WATER_LEAKAGE = "water_leakage"
    INTERNET_DISCONNECTED = "internet_disconnected"
    TEMPERATURE_HIGH = "temperature_high"
    ENERGY_SPIKE = "energy_spike"
    DEVICE_OFFLINE = "device_offline"
    MOTION_DETECTED = "motion_detected"
    SECURITY_BREACH = "security_breach"
    OVERLOAD = "overload"
    BREAKER_TRIP = "breaker_trip"


class RoomType(str, enum.Enum):
    """Room types in the house."""

    LIVING_ROOM = "living_room"
    KITCHEN = "kitchen"
    MASTER_BEDROOM = "master_bedroom"
    BATHROOM = "bathroom"
    GARAGE = "garage"
    UTILITY_ROOM = "utility_room"
    HALLWAY = "hallway"


class HomeCategory(str, enum.Enum):
    """Household electrical capacity category."""

    SMALL_VILLA = "small_villa"        # 6-12 kVA, 30-60 A, single-phase
    MEDIUM_FAMILY = "medium_family"    # 9-12 kVA, 30-45 A, single-phase
    LARGE_VILLA = "large_villa"        # 12-24 kVA, 45-90 A, three-phase


class PhaseType(str, enum.Enum):
    """Electrical supply phase configuration."""

    SINGLE_PHASE = "single_phase"      # 230V, 1 live wire
    THREE_PHASE = "three_phase"        # 400V, 3 live wires


# =============================================================================
# AUTH MODELS
# =============================================================================


class Role(Base):
    """User role for RBAC."""

    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    name: Mapped[str] = mapped_column(
        Enum(RoleName), unique=True, nullable=False
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    # Relationships
    users: Mapped[list["User"]] = relationship("User", back_populates="role")
    permissions: Mapped[list["Permission"]] = relationship(
        "Permission", back_populates="role", cascade="all, delete-orphan"
    )


class User(Base):
    """Platform user."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    username: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    # Relationships
    role: Mapped["Role"] = relationship("Role", back_populates="users")
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        "AuditLog", back_populates="user"
    )
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification", back_populates="user"
    )
    websocket_sessions: Mapped[list["WebSocketSession"]] = relationship(
        "WebSocketSession", back_populates="user"
    )


class Permission(Base):
    """RBAC permission entry."""

    __tablename__ = "permissions"
    __table_args__ = (
        UniqueConstraint("role_id", "resource", "action", name="uq_role_resource_action"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False
    )
    resource: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)

    # Relationships
    role: Mapped["Role"] = relationship("Role", back_populates="permissions")


# =============================================================================
# HOME & DEVICE MODELS
# =============================================================================


class Room(Base):
    """Room in the smart home."""

    __tablename__ = "rooms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(Enum(RoomType), nullable=False)
    floor: Mapped[int] = mapped_column(Integer, default=0)
    position_x: Mapped[float] = mapped_column(Float, default=0.0)
    position_y: Mapped[float] = mapped_column(Float, default=0.0)
    position_z: Mapped[float] = mapped_column(Float, default=0.0)
    width: Mapped[float] = mapped_column(Float, default=4.0)
    depth: Mapped[float] = mapped_column(Float, default=4.0)
    height: Mapped[float] = mapped_column(Float, default=3.0)
    extra_data: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    # Relationships
    devices: Mapped[list["Device"]] = relationship("Device", back_populates="room")


class HouseConfig(Base):
    """Household electrical infrastructure configuration.

    Models the physical electrical constraints of the home:
    supply voltage, contracted power, breaker ratings, and phase type.
    Only ONE HouseConfig row should exist per deployment (singleton).
    """

    __tablename__ = "house_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    name: Mapped[str] = mapped_column(
        String(200), nullable=False, default="Default Home"
    )
    category: Mapped[str] = mapped_column(
        Enum(HomeCategory), default=HomeCategory.MEDIUM_FAMILY
    )
    phase_type: Mapped[str] = mapped_column(
        Enum(PhaseType), default=PhaseType.SINGLE_PHASE
    )
    supply_voltage_v: Mapped[float] = mapped_column(
        Float, default=230.0, comment="Nominal supply voltage in Volts"
    )
    contracted_power_kva: Mapped[float] = mapped_column(
        Float, default=9.2, comment="Contracted apparent power in kVA"
    )
    main_breaker_a: Mapped[float] = mapped_column(
        Float, default=40.0, comment="Main breaker / MCB rating in Amps"
    )
    max_load_kw: Mapped[float] = mapped_column(
        Float, default=8.0,
        comment="Maximum allowed real power draw in kW (derived from contracted_power × PF)"
    )
    overload_trip_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True,
        comment="Whether to simulate breaker trips on overload"
    )
    overload_tolerance_pct: Mapped[float] = mapped_column(
        Float, default=10.0,
        comment="Percentage over max_load_kw before trip (accounts for inrush)"
    )
    has_solar_pv: Mapped[bool] = mapped_column(Boolean, default=False)
    solar_capacity_kwp: Mapped[float] = mapped_column(
        Float, default=0.0, comment="Installed solar PV capacity in kWp"
    )
    has_battery: Mapped[bool] = mapped_column(Boolean, default=False)
    battery_capacity_kwh: Mapped[float] = mapped_column(
        Float, default=0.0, comment="Battery storage capacity in kWh"
    )
    battery_max_charge_kw: Mapped[float] = mapped_column(
        Float, default=0.0, comment="Max battery charge rate in kW"
    )
    battery_max_discharge_kw: Mapped[float] = mapped_column(
        Float, default=0.0, comment="Max battery discharge rate in kW"
    )
    extra_data: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class Device(Base):
    """IoT device in the smart home."""

    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(Enum(DeviceType), nullable=False)
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        Enum(DeviceStatus), default=DeviceStatus.ONLINE
    )
    power_state: Mapped[str] = mapped_column(
        Enum(PowerState), default=PowerState.OFF
    )
    connectivity: Mapped[str] = mapped_column(
        Enum(ConnectivityStatus), default=ConnectivityStatus.CONNECTED
    )
    energy_usage_kw: Mapped[float] = mapped_column(Float, default=0.0)
    total_energy_kwh: Mapped[float] = mapped_column(Float, default=0.0)
    efficiency_percent: Mapped[float] = mapped_column(Float, default=100.0)
    turned_on_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    extra_data: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    position_x: Mapped[float] = mapped_column(Float, default=0.0)
    position_y: Mapped[float] = mapped_column(Float, default=0.0)
    position_z: Mapped[float] = mapped_column(Float, default=0.0)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    # Relationships
    room: Mapped["Room"] = relationship("Room", back_populates="devices")
    states: Mapped[list["DeviceState"]] = relationship(
        "DeviceState", back_populates="device", cascade="all, delete-orphan"
    )
    events: Mapped[list["DeviceEvent"]] = relationship(
        "DeviceEvent", back_populates="device", cascade="all, delete-orphan"
    )
    energy_history: Mapped[list["EnergyHistory"]] = relationship(
        "EnergyHistory", back_populates="device", cascade="all, delete-orphan"
    )
    alerts: Mapped[list["Alert"]] = relationship(
        "Alert", back_populates="device", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_devices_room_type", "room_id", "type"),
        Index("ix_devices_status", "status"),
    )


class DeviceState(Base):
    """Snapshot of device state at a point in time."""

    __tablename__ = "device_states"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    state_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    # Relationships
    device: Mapped["Device"] = relationship("Device", back_populates="states")


class DeviceEvent(Base):
    """Event log entry for a device."""

    __tablename__ = "device_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(
        Enum(EventSeverity), default=EventSeverity.INFO
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    extra_data: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    # Relationships
    device: Mapped["Device"] = relationship("Device", back_populates="events")

    __table_args__ = (
        Index("ix_device_events_severity", "severity"),
        Index("ix_device_events_device_time", "device_id", "timestamp"),
    )


# =============================================================================
# ENERGY TRACKING
# =============================================================================


class EnergyHistory(Base):
    """Energy consumption record."""

    __tablename__ = "energy_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    power_kw: Mapped[float] = mapped_column(Float, nullable=False)
    voltage: Mapped[float] = mapped_column(Float, default=230.0)
    current_amps: Mapped[float] = mapped_column(Float, default=0.0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    # Relationships
    device: Mapped["Device"] = relationship("Device", back_populates="energy_history")

    __table_args__ = (
        Index("ix_energy_device_time", "device_id", "timestamp"),
    )


# =============================================================================
# OPERATIONS
# =============================================================================


class Alert(Base):
    """System alert."""

    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    device_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"), nullable=True
    )
    type: Mapped[str] = mapped_column(Enum(AlertType), nullable=False)
    severity: Mapped[str] = mapped_column(
        Enum(EventSeverity), default=EventSeverity.WARNING
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    acknowledged_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    extra_data: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    # Relationships
    device: Mapped[Optional["Device"]] = relationship("Device", back_populates="alerts")


class AuditLog(Base):
    """Security audit log."""

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource: Mapped[str] = mapped_column(String(200), nullable=False)
    details: Mapped[dict] = mapped_column("details", JSONB, default=dict)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")


class Notification(Base):
    """User notification."""

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="notifications")


class WebSocketSession(Base):
    """Active WebSocket connection tracking."""

    __tablename__ = "websocket_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    session_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    connected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    last_ping: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="websocket_sessions")


# =============================================================================
# POWER HISTORY MODELS
# =============================================================================


class HomePowerHistory(Base):
    """Total home power consumption time-series record."""

    __tablename__ = "home_power_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    total_home_power_consumption_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    living_room_main_light_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    living_room_main_light_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    living_room_ac_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    living_room_ac_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    smart_tv_65_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    smart_tv_65_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    living_room_switch_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    living_room_switch_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    kitchen_light_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    kitchen_light_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    refrigerator_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    refrigerator_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    dishwasher_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    dishwasher_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    bedroom_light_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    bedroom_light_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    bedroom_ac_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    bedroom_ac_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    door_lock_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    door_lock_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    bathroom_light_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    bathroom_light_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    water_heater_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    water_heater_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    nebulizer_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    nebulizer_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    garage_door_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    garage_door_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    garage_light_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    garage_light_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    security_camera_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    security_camera_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    washing_machine_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    washing_machine_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    smart_plug_dryer_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    smart_plug_dryer_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    utility_light_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    utility_light_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    hallway_light_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    hallway_light_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    wifi_router_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    wifi_router_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    front_door_lock_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    front_door_lock_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    induction_cooktop_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    induction_cooktop_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    base_load_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    base_load_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    ev_charger_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    ev_charger_kvar: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    
    # Battery Power Mapping
    solar_generation_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    battery_charge_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    battery_discharge_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    battery_soc_percent: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    ev_discharge_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    grid_import_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    grid_export_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)


    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    __table_args__ = (
        Index("ix_home_power_timestamp", "timestamp"),
    )


class DevicePowerHistory(Base):
    """Per-device power consumption time-series record.

    Simplified to three columns matching the project dataset schema:
    device_id | timestamp (IST) | total_power_consumption_kw
    """

    __tablename__ = "device_power_history"

    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"),
        primary_key=True, nullable=False
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, nullable=False
    )
    total_power_consumption_kw: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )

    # Relationships
    device: Mapped["Device"] = relationship("Device")

    __table_args__ = (
        Index("ix_device_power_device_time", "device_id", "timestamp"),
        Index("ix_device_power_timestamp", "timestamp"),
    )

