"""RNTBCI Smart Home Digital Twin - Device API Routes."""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.auth.dependencies import get_current_user, require_admin, require_user_or_admin
from backend.database import get_db
from backend.models import (
    AuditLog,
    Device,
    DeviceEvent,
    DeviceState,
    DeviceStatus,
    DeviceType,
    EnergyHistory,
    EventSeverity,
    PowerState,
    Room,
    User,
)
from backend.redis.client import redis_client
from backend.schemas import (
    DeviceControlRequest,
    DeviceCreateRequest,
    DeviceEventResponse,
    DeviceListResponse,
    DevicePowerRequest,
    DeviceStateRequest,
    DeviceResponse,
    DeviceStateResponse,
    DeviceUpdateRequest,
    EnergyRecordResponse,
    EventListResponse,
)
from backend.utils.device_logger import DeviceLogger
from backend.websockets.manager import ws_manager

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/devices", tags=["Devices"])


def _device_to_response(device: Device) -> DeviceResponse:
    """Convert a Device model to a DeviceResponse schema."""
    return DeviceResponse(
        id=device.id,
        name=device.name,
        type=device.type.value if isinstance(device.type, DeviceType) else device.type,
        room_id=device.room_id,
        room_name=device.room.name if device.room else None,
        status=device.status.value if isinstance(device.status, DeviceStatus) else device.status,
        power_state=device.power_state.value if isinstance(device.power_state, PowerState) else device.power_state,
        connectivity=device.connectivity.value if hasattr(device.connectivity, 'value') else device.connectivity,
        energy_usage_kw=device.energy_usage_kw,
        total_energy_kwh=device.total_energy_kwh,
        efficiency_percent=device.efficiency_percent,
        metadata=device.extra_data or {},
        position_x=device.position_x,
        position_y=device.position_y,
        position_z=device.position_z,
        turned_on_at=device.turned_on_at,
        last_updated=device.last_updated,
        created_at=device.created_at,
    )


@router.get("", response_model=DeviceListResponse)
@limiter.limit("100/minute")
async def list_devices(
    request: Request,
    room_id: uuid.UUID | None = Query(None),
    device_type: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeviceListResponse:
    """List all devices with optional filters."""
    query = select(Device).options(selectinload(Device.room))

    if room_id:
        query = query.where(Device.room_id == room_id)
    if device_type:
        query = query.where(Device.type == device_type)
    if status_filter:
        query = query.where(Device.status == status_filter)
    if search:
        query = query.where(Device.name.ilike(f"%{search}%"))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    query = query.offset((page - 1) * per_page).limit(per_page)
    query = query.order_by(Device.name)

    result = await db.execute(query)
    devices = result.scalars().all()

    return DeviceListResponse(
        devices=[_device_to_response(d) for d in devices],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_device(
    request: Request,
    data: DeviceCreateRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> DeviceResponse:
    """Create a new device (Admin only)."""
    # Validate room exists
    room_result = await db.execute(select(Room).where(Room.id == data.room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    # Validate device type
    try:
        device_type = DeviceType(data.type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid device type: {data.type}",
        )

    device = Device(
        name=data.name,
        type=device_type,
        room_id=data.room_id,
        extra_data=data.metadata,
        position_x=data.position_x,
        position_y=data.position_y,
        position_z=data.position_z,
    )
    db.add(device)
    await db.flush()

    # Create initial state
    initial_state = _get_default_state(device_type)
    state = DeviceState(
        device_id=device.id,
        state_json=initial_state,
    )
    db.add(state)

    # Create registration event
    event = DeviceEvent(
        device_id=device.id,
        event_type="device_registered",
        severity=EventSeverity.INFO,
        message=f"Device '{data.name}' registered to {room.name}",
        extra_data={"type": data.type, "room": room.name},
    )
    db.add(event)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="create_device",
        resource="devices",
        details={"device_name": data.name, "device_type": data.type, "room": room.name},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    await db.flush()
    device.room = room

    await db.commit()

    # Publish to real-time channels
    device_resp = _device_to_response(device)
    await redis_client.publish_device_update(str(device.id), {
        "action": "device_created",
        "device": device_resp.model_dump(mode="json"),
    })
    await redis_client.publish_event({
        "device_id": str(device.id),
        "device_name": data.name,
        "event_type": "device_registered",
        "severity": "info",
        "message": f"Device '{data.name}' registered in {room.name}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return device_resp


@router.get("/{device_id}", response_model=DeviceResponse)
@limiter.limit("100/minute")
async def get_device(
    request: Request,
    device_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeviceResponse:
    """Get a single device by ID."""
    result = await db.execute(
        select(Device)
        .options(selectinload(Device.room))
        .where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )
    return _device_to_response(device)


@router.patch("/{device_id}", response_model=DeviceResponse)
@limiter.limit("50/minute")
async def update_device(
    request: Request,
    device_id: uuid.UUID,
    data: DeviceUpdateRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> DeviceResponse:
    """Update device configuration (Admin only)."""
    result = await db.execute(
        select(Device)
        .options(selectinload(Device.room))
        .where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    if data.name is not None:
        device.name = data.name
    if data.room_id is not None:
        room_result = await db.execute(select(Room).where(Room.id == data.room_id))
        if not room_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
        device.room_id = data.room_id
    if data.metadata is not None:
        device.extra_data = data.metadata
    if data.position_x is not None:
        device.position_x = data.position_x
    if data.position_y is not None:
        device.position_y = data.position_y
    if data.position_z is not None:
        device.position_z = data.position_z

    await db.commit()

    # Log device update communication
    DeviceLogger.log_communication(str(device.id), device.name, "update_device", data.model_dump(exclude_unset=True))

    # Reload room relationship
    await db.refresh(device, ["room"])

    device_resp = _device_to_response(device)
    await redis_client.publish_device_update(str(device.id), {
        "action": "device_updated",
        "device": device_resp.model_dump(mode="json"),
    })

    return device_resp


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def delete_device(
    request: Request,
    device_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a device (Admin only)."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    device_name = device.name

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="delete_device",
        resource="devices",
        details={"device_name": device_name, "device_id": str(device_id)},
        ip_address=request.client.host if request.client else None,
    )
    db.add(audit)

    await db.delete(device)
    await db.commit()

    await redis_client.publish_device_update(str(device_id), {
        "action": "device_deleted",
        "device_id": str(device_id),
    })


@router.get("/{device_id}/state", response_model=DeviceStateResponse)
@limiter.limit("100/minute")
async def get_device_state(
    request: Request,
    device_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeviceStateResponse:
    """Get the current state of a device."""
    # Try Redis cache first
    cached = await redis_client.get_device_state(str(device_id))
    if cached:
        return DeviceStateResponse(
            id=uuid.UUID(cached.get("id", str(uuid.uuid4()))),
            device_id=device_id,
            state_json=cached.get("state_json", {}),
            timestamp=datetime.fromisoformat(cached["timestamp"]) if "timestamp" in cached else datetime.now(timezone.utc),
        )

    # Fallback to DB
    result = await db.execute(
        select(DeviceState)
        .where(DeviceState.device_id == device_id)
        .order_by(DeviceState.timestamp.desc())
        .limit(1)
    )
    state = result.scalar_one_or_none()
    if not state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device state not found")

    return DeviceStateResponse(
        id=state.id,
        device_id=state.device_id,
        state_json=state.state_json,
        timestamp=state.timestamp,
    )


@router.patch("/{device_id}/control", response_model=DeviceResponse)
@limiter.limit("60/minute")
async def control_device(
    request: Request,
    device_id: uuid.UUID,
    data: DeviceControlRequest,
    current_user: User = Depends(require_user_or_admin),
    db: AsyncSession = Depends(get_db),
) -> DeviceResponse:
    """Send a control command to a device."""
    result = await db.execute(
        select(Device)
        .options(selectinload(Device.room))
        .where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    # Apply control command
    new_metadata = dict(device.extra_data or {})
    new_metadata.update(data.parameters)
    device.extra_data = new_metadata
    device.last_updated = datetime.now(timezone.utc)

    # Save new state
    state = DeviceState(
        device_id=device.id,
        state_json={"command": data.command, "parameters": data.parameters, **new_metadata},
    )
    db.add(state)

    # Log event
    event = DeviceEvent(
        device_id=device.id,
        event_type="control_command",
        severity=EventSeverity.INFO,
        message=f"Command '{data.command}' received from {current_user.username}",
        extra_data={"command": data.command, "parameters": data.parameters, "user": current_user.username},
    )
    db.add(event)

    await db.commit()

    # Log device communication
    DeviceLogger.log_communication(str(device.id), device.name, "control_command", {"command": data.command, "parameters": data.parameters})

    # Cache and publish
    await redis_client.set_device_state(str(device.id), {
        "id": str(state.id),
        "state_json": state.state_json,
        "timestamp": state.timestamp.isoformat(),
    })

    device_resp = _device_to_response(device)
    await redis_client.publish_device_update(str(device.id), {
        "action": "device_controlled",
        "command": data.command,
        "device": device_resp.model_dump(mode="json"),
    })
    await redis_client.publish_event({
        "device_id": str(device.id),
        "device_name": device.name,
        "event_type": "control_command",
        "severity": "info",
        "message": f"Command '{data.command}' sent to {device.name}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return device_resp


@router.patch("/{device_id}/power", response_model=DeviceResponse)
@limiter.limit("60/minute")
async def toggle_power(
    request: Request,
    device_id: uuid.UUID,
    data: DevicePowerRequest,
    current_user: User = Depends(require_user_or_admin),
    db: AsyncSession = Depends(get_db),
) -> DeviceResponse:
    """Toggle device power state."""
    result = await db.execute(
        select(Device)
        .options(selectinload(Device.room))
        .where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    old_state = device.power_state.value if isinstance(device.power_state, PowerState) else device.power_state
    device.power_state = PowerState(data.power_state)
    device.last_updated = datetime.now(timezone.utc)

    # Update energy usage based on power state
    if data.power_state == "off":
        device.energy_usage_kw = 0.0
    elif data.power_state == "standby":
        device.energy_usage_kw = max(device.energy_usage_kw * 0.05, 0.001)

    # Log event
    event = DeviceEvent(
        device_id=device.id,
        event_type="power_toggle",
        severity=EventSeverity.INFO,
        message=f"Power state changed from {old_state} to {data.power_state} by {current_user.username}",
        extra_data={"old_state": old_state, "new_state": data.power_state, "user": current_user.username},
    )
    db.add(event)

    await db.commit()

    # Log device communication
    DeviceLogger.log_communication(str(device.id), device.name, "power_toggle", {"power_state": data.power_state})

    device_resp = _device_to_response(device)
    await redis_client.publish_device_update(str(device.id), {
        "action": "power_toggled",
        "device": device_resp.model_dump(mode="json"),
    })
    await redis_client.publish_event({
        "device_id": str(device.id),
        "device_name": device.name,
        "event_type": "power_toggle",
        "severity": "info",
        "message": f"{device.name}: {old_state} → {data.power_state}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return device_resp


@router.patch("/{device_id}/state", response_model=DeviceResponse)
@limiter.limit("60/minute")
async def toggle_state(
    request: Request,
    device_id: uuid.UUID,
    data: DeviceStateRequest,
    current_user: User = Depends(require_user_or_admin),
    db: AsyncSession = Depends(get_db),
) -> DeviceResponse:
    """Toggle device state (ON/OFF)."""
    result = await db.execute(
        select(Device)
        .options(selectinload(Device.room))
        .where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    power_state_str = "on" if data.status == "ON" else "off"
    old_state = device.power_state.value if isinstance(device.power_state, PowerState) else device.power_state
    device.power_state = PowerState(power_state_str)
    device.last_updated = datetime.now(timezone.utc)

    # Typical power load estimations based on device type
    typical_loads = {
        DeviceType.HVAC: 2100.0,
        DeviceType.WATER_HEATER: 1500.0,
        DeviceType.SMART_TV: 120.0,
        DeviceType.ROUTER: 12.0,
        DeviceType.SMART_LIGHT: 15.0,
        DeviceType.WASHING_MACHINE: 500.0,
        DeviceType.REFRIGERATOR: 150.0,
    }
    
    # Update energy usage based on power state
    if power_state_str == "off":
        device.energy_usage_kw = 0.0
    else:
        # If no specific load, we just leave it or set a generic fallback
        default_load = typical_loads.get(device.type, 50.0) / 1000.0
        device.energy_usage_kw = default_load

    # Log event
    event = DeviceEvent(
        device_id=device.id,
        event_type="power_toggle",
        severity=EventSeverity.INFO,
        message=f"Power state changed from {old_state} to {power_state_str} by {current_user.username}",
        extra_data={"old_state": old_state, "new_state": power_state_str, "user": current_user.username},
    )
    db.add(event)

    await db.commit()

    # Log device communication
    DeviceLogger.log_communication(str(device.id), device.name, "power_toggle", {"power_state": power_state_str})

    device_resp = _device_to_response(device)
    
    # The user specifically requested this event structure if websockets exist
    await redis_client.publish_device_update(str(device.id), {
        "action": "device.updated",
        "device": device_resp.model_dump(mode="json"),
    })
    
    await redis_client.publish_event({
        "device_id": str(device.id),
        "device_name": device.name,
        "event_type": "power_toggle",
        "severity": "info",
        "message": f"{device.name} turned {data.status}. Power usage dropped by {int(device.energy_usage_kw * 1000)}W" if data.status == "OFF" else f"{device.name} turned {data.status}. Power usage increased by {int(device.energy_usage_kw * 1000)}W",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return device_resp


@router.get("/{device_id}/energy", response_model=list[EnergyRecordResponse])
@limiter.limit("100/minute")
async def get_device_energy(
    request: Request,
    device_id: uuid.UUID,
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[EnergyRecordResponse]:
    """Get energy history for a device."""
    result = await db.execute(
        select(EnergyHistory)
        .where(EnergyHistory.device_id == device_id)
        .order_by(EnergyHistory.timestamp.desc())
        .limit(limit)
    )
    records = result.scalars().all()
    return [
        EnergyRecordResponse(
            id=r.id,
            device_id=r.device_id,
            power_kw=r.power_kw,
            voltage=r.voltage,
            current_amps=r.current_amps,
            cost_usd=r.cost_usd,
            timestamp=r.timestamp,
        )
        for r in records
    ]


@router.get("/{device_id}/events", response_model=EventListResponse)
@limiter.limit("100/minute")
async def get_device_events(
    request: Request,
    device_id: uuid.UUID,
    severity: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EventListResponse:
    """Get events for a device."""
    query = select(DeviceEvent).where(DeviceEvent.device_id == device_id)

    if severity:
        query = query.where(DeviceEvent.severity == severity)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(DeviceEvent.timestamp.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    events = result.scalars().all()

    return EventListResponse(
        events=[
            DeviceEventResponse(
                id=e.id,
                device_id=e.device_id,
                event_type=e.event_type,
                severity=e.severity.value if isinstance(e.severity, EventSeverity) else e.severity,
                message=e.message,
                metadata=e.extra_data or {},
                timestamp=e.timestamp,
            )
            for e in events
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


def _get_default_state(device_type: DeviceType) -> dict:
    """Get default state configuration for a device type."""
    defaults = {
        DeviceType.SMART_LIGHT: {
            "brightness": 100,
            "rgb": {"r": 255, "g": 255, "b": 255},
            "color_temperature": 4000,
        },
        DeviceType.SMART_SWITCH: {
            "state": "off",
        },
        DeviceType.SMART_PLUG: {
            "voltage": 220.0,
            "current": 0.0,
            "energy_usage": 0.0,
        },
        DeviceType.DOOR_LOCK: {
            "lock_state": "locked",
            "auto_lock": True,
            "auto_lock_delay": 30,
        },
        DeviceType.GARAGE_DOOR: {
            "position": "closed",
        },
        DeviceType.HVAC: {
            "temperature": 22.0,
            "target_temperature": 22.0,
            "mode": "cooling",
            "fan_speed": "auto",
        },
        DeviceType.WASHING_MACHINE: {
            "wash_mode": "normal",
            "spin_speed": 1000,
            "remaining_time": 0,
            "running": False,
        },
        DeviceType.DISHWASHER: {
            "wash_mode": "normal",
            "cycle": "idle",
        },
        DeviceType.REFRIGERATOR: {
            "temperature": 4.0,
            "door_state": "closed",
            "cooling_status": "active",
        },
        DeviceType.WATER_HEATER: {
            "temperature": 45.0,
            "target_temperature": 50.0,
        },
        DeviceType.NEBULIZER: {
            "intensity": 50,
            "duration": 0,
            "running": False,
        },
        DeviceType.ROUTER: {
            "upload_speed": 50.0,
            "download_speed": 100.0,
            "internet_status": "connected",
            "connected_clients": 0,
        },
        DeviceType.CAMERA: {
            "recording": False,
            "motion_detection": True,
            "night_vision": True,
        },
        DeviceType.SMART_TV: {
            "volume": 30,
            "channel": 1,
            "input_source": "hdmi1",
        },
    }
    return defaults.get(device_type, {})
