"""RNTBCI Smart Home Digital Twin - Device API Routes."""

import logging
from typing import Optional
import uuid
import os
import json
import csv
import io
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status, BackgroundTasks, Response
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
from backend.services.evse_service import evse_service
from backend.services.solar_service import solar_service
from backend.schemas import (
    DeviceControlRequest,
    DeviceCreateRequest,
    DeviceEventResponse,
    DeviceListResponse,
    DevicePowerRequest,
    DeviceStateRequest,
    EVSESetTargetsRequest,
    EVSECommandRequest,
    DeviceResponse,
    DeviceStateResponse,
    DeviceUpdateRequest,
    EnergyRecordResponse,
    EventListResponse,
    WebhookRegistrationRequest,
)
from backend.utils.device_logger import DeviceLogger
from backend.utils.webhook import dispatch_webhook
from backend.websockets.manager import ws_manager
from backend.services.simulation import device_simulator, DEFAULT_ON_MODE, DEVICE_MODE_PROFILES

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
    room_id: Optional[uuid.UUID] = Query(None),
    device_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
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


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
@limiter.limit("10/minute")
async def delete_device(
    request: Request,
    device_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
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
    background_tasks: BackgroundTasks,
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

    conn = device.connectivity.value if hasattr(device.connectivity, 'value') else device.connectivity
    dev_st = device.status.value if hasattr(device.status, 'value') else device.status
    if conn == "disconnected" or dev_st == "offline":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot operate disconnected device. Simulation and controls are inactive.",
        )

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
    
    webhook_url = (device.extra_data or {}).get("webhook_url")
    if webhook_url:
        payload = {
            "device_id": str(device.id),
            "event": "control_command",
            "command": data.command,
            "parameters": data.parameters,
            "state": device_resp.model_dump(mode="json")
        }
        background_tasks.add_task(dispatch_webhook, webhook_url, payload)

    return device_resp


@router.patch("/{device_id}/power", response_model=DeviceResponse)
@limiter.limit("60/minute")
async def toggle_power(
    request: Request,
    device_id: uuid.UUID,
    data: DevicePowerRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_user_or_admin),
    db: AsyncSession = Depends(get_db),
) -> DeviceResponse:
    """Toggle device power state. Delegates power calculation to the simulation engine."""
    result = await db.execute(
        select(Device)
        .options(selectinload(Device.room))
        .where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    conn = device.connectivity.value if hasattr(device.connectivity, 'value') else device.connectivity
    dev_st = device.status.value if hasattr(device.status, 'value') else device.status
    if conn == "disconnected" or dev_st == "offline":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot operate disconnected device. Simulation and power toggles are inactive.",
        )

    old_state = device.power_state.value if isinstance(device.power_state, PowerState) else device.power_state
    device.power_state = PowerState(data.power_state)
    device.last_updated = datetime.now(timezone.utc)


    # Delegate power management to simulation engine state machine
    device_type_str = device.type.value if isinstance(device.type, DeviceType) else device.type
    tracker = device_simulator.ensure_tracker(str(device.id), device_type_str)
    if data.power_state == "on":
        tracker.set_power_on()  # Enters STARTING phase (30s warm-up, then RUNNING)
        # Power stays 0 until simulation engine transitions to RUNNING after ~30s
    elif data.power_state == "off":
        tracker.set_power_off()  # Enters STOPPING phase (gradual shutdown)
        device.energy_usage_kw = 0.0
    elif data.power_state == "standby":
        tracker.set_power_off()
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
    
    webhook_url = (device.extra_data or {}).get("webhook_url")
    if webhook_url:
        payload = {
            "device_id": str(device.id),
            "event": "power_toggled",
            "state": device_resp.model_dump(mode="json")
        }
        background_tasks.add_task(dispatch_webhook, webhook_url, payload)

    return device_resp


@router.patch("/{device_id}/state", response_model=DeviceResponse)
@limiter.limit("60/minute")
async def toggle_state(
    request: Request,
    device_id: uuid.UUID,
    data: DeviceStateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_user_or_admin),
    db: AsyncSession = Depends(get_db),
) -> DeviceResponse:
    """Toggle device state (ON/OFF). Delegates power to simulation engine state machine."""
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

    # Delegate power management to simulation engine state machine
    device_type_str = device.type.value if isinstance(device.type, DeviceType) else device.type
    tracker = device_simulator.ensure_tracker(str(device.id), device_type_str)
    if power_state_str == "on":
        tracker.set_power_on()  # Enters STARTING phase (30s warm-up)
        # Power will remain 0 for ~30s, then simulation engine will calculate real values
    else:
        tracker.set_power_off()  # Enters STOPPING phase (gradual shutdown)
        device.energy_usage_kw = 0.0

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
    
    phase = tracker.power_phase
    await redis_client.publish_event({
        "device_id": str(device.id),
        "device_name": device.name,
        "event_type": "power_toggle",
        "severity": "info",
        "message": f"{device.name} turned {data.status}. Phase: {phase}. Power will update after warm-up." if data.status == "ON" else f"{device.name} turned {data.status}. Power shutting down.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    
    webhook_url = (device.extra_data or {}).get("webhook_url")
    if webhook_url:
        payload = {
            "device_id": str(device.id),
            "event": "state_changed",
            "state": device_resp.model_dump(mode="json")
        }
        background_tasks.add_task(dispatch_webhook, webhook_url, payload)

    return device_resp


@router.patch("/{device_id}/mode", response_model=DeviceResponse)
@limiter.limit("60/minute")
async def change_device_mode(
    request: Request,
    device_id: uuid.UUID,
    data: dict,
    current_user: User = Depends(require_user_or_admin),
    db: AsyncSession = Depends(get_db),
) -> DeviceResponse:
    """Change the operating mode of a device (e.g., Light: dim/normal/bright, HVAC: fan/eco/cool/heat/boost)."""
    result = await db.execute(
        select(Device)
        .options(selectinload(Device.room))
        .where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    mode = data.get("mode")
    if not mode:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="'mode' field is required")

    device_type_str = device.type.value if isinstance(device.type, DeviceType) else device.type
    profiles = DEVICE_MODE_PROFILES.get(device_type_str, {})
    if mode not in profiles:
        available = [m for m in profiles.keys() if m != "off"]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid mode '{mode}' for {device_type_str}. Available: {available}",
        )

    # Update simulation tracker
    tracker = device_simulator.ensure_tracker(str(device.id), device_type_str)
    old_mode = tracker.operating_mode
    tracker.set_mode(mode)

    # Update device metadata
    metadata = dict(device.extra_data or {})
    metadata["operating_mode"] = mode
    device.extra_data = metadata
    device.last_updated = datetime.now(timezone.utc)

    # Log event
    event = DeviceEvent(
        device_id=device.id,
        event_type="mode_change",
        severity=EventSeverity.INFO,
        message=f"{device.name}: mode changed from {old_mode} to {mode} by {current_user.username}",
        extra_data={"old_mode": old_mode, "new_mode": mode, "user": current_user.username},
    )
    db.add(event)
    await db.commit()

    device_resp = _device_to_response(device)
    await redis_client.publish_device_update(str(device.id), {
        "action": "mode_changed",
        "device": device_resp.model_dump(mode="json"),
    })

    return device_resp

@router.post("/public/light/{device_id}/webhook", response_model=dict)
@limiter.limit("10/minute")
async def public_register_webhook(
    request: Request,
    device_id: uuid.UUID,
    data: WebhookRegistrationRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Register a webhook URL for a light device publicly."""
    result = await db.execute(
        select(Device).where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
        
    if device.type != DeviceType.SMART_LIGHT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only SMART_LIGHT devices can register webhooks via this endpoint.")

    metadata = dict(device.extra_data or {})
    metadata["webhook_url"] = data.webhook_url
    device.extra_data = metadata
    await db.commit()

    return {"status": "success", "message": f"Webhook URL registered for {device.name}"}

@router.get("/public/export/csv")
@limiter.limit("10/minute")
async def public_export_devices_csv(
    request: Request,
    device_type_filter: str = Query(None, alias="type", description="Filter by device type name (e.g., 'light')")
) -> Response:
    """Export all device JSON files into a generic Excel CSV sheet, optionally filtered by type."""
    logs_dir = os.path.join(os.path.dirname(__file__), "../../data")
    
    csv_data = []
    
    if os.path.exists(logs_dir):
        device_files = [f for f in os.listdir(logs_dir) if f.startswith("device_") and f.endswith(".json")]
        
        for filename in device_files:
            filepath = os.path.join(logs_dir, filename)
            try:
                with open(filepath, "r") as f:
                    data = json.load(f)
                    
                device_type = data.get("deviceType", {})
                device_name = device_type.get("name", "")
                
                # Filter by device type if requested
                if device_type_filter and device_type_filter.lower() not in device_name.lower() and device_type_filter.lower() not in filename.lower():
                    continue

                classification = device_type.get("classification", {})
                clusters = device_type.get("clusters", [])
                history = data.get("communication_history", [])
                
                last_event_time = ""
                if history:
                    last_event_time = history[-1].get("timestamp", "")
                    
                csv_data.append({
                    "Filename": filename,
                    "Device Name": device_name,
                    "Device ID (Hex)": device_type.get("id", ""),
                    "UUID": device_type.get("device_id", ""),
                    "Revision": device_type.get("revision", ""),
                    "Class": classification.get("class", ""),
                    "Scope": classification.get("scope", ""),
                    "Number of Clusters": len(clusters),
                    "Number of Events": len(history),
                    "Last Event Timestamp": last_event_time
                })
            except Exception as e:
                logger.error(f"Error parsing {filename} for CSV export: {e}")

    fieldnames = [
        "Filename", "Device Name", "Device ID (Hex)", "UUID", 
        "Revision", "Class", "Scope", "Number of Clusters", 
        "Number of Events", "Last Event Timestamp"
    ]

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(csv_data)
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=devices_summary.csv"}
    )


@router.get("/public/export/postman")
@limiter.limit("10/minute")
async def public_export_postman_collection(
    request: Request
) -> Response:
    """Export the Postman collection JSON file."""
    filepath = os.path.join(os.path.dirname(__file__), "../../../light_device_postman_collection.json")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Postman collection not found")
        
    with open(filepath, "r") as f:
        content = f.read()
        
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=light_device_postman_collection.json"}
    )



@router.get("/public/light/{device_id}", response_model=DeviceResponse)
@limiter.limit("100/minute")
async def public_get_light(
    request: Request,
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> DeviceResponse:
    """Get a single smart light device by ID publicly."""
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
    if device.type != DeviceType.SMART_LIGHT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only SMART_LIGHT devices can be accessed via this public endpoint.")
    
    return _device_to_response(device)


@router.patch("/public/light/{device_id}/state", response_model=DeviceResponse)
@limiter.limit("60/minute")
async def public_toggle_light_state(
    request: Request,
    device_id: uuid.UUID,
    data: DeviceStateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> DeviceResponse:
    """Toggle a smart light state publicly."""
    result = await db.execute(
        select(Device)
        .options(selectinload(Device.room))
        .where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
        
    if device.type != DeviceType.SMART_LIGHT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only SMART_LIGHT devices can be controlled via this public endpoint.")

    power_state_str = "on" if data.status == "ON" else "off"
    old_state = device.power_state.value if isinstance(device.power_state, PowerState) else device.power_state
    device.power_state = PowerState(power_state_str)
    device.last_updated = datetime.now(timezone.utc)

    # Delegate to simulation engine state machine
    tracker = device_simulator.ensure_tracker(str(device.id), "smart_light")
    if power_state_str == "on":
        tracker.set_power_on()  # STARTING phase, power = 0 for 30s
    else:
        tracker.set_power_off()  # STOPPING phase
        device.energy_usage_kw = 0.0

    event = DeviceEvent(
        device_id=device.id,
        event_type="power_toggle",
        severity=EventSeverity.INFO,
        message=f"Power state changed from {old_state} to {power_state_str} via public API",
        extra_data={"old_state": old_state, "new_state": power_state_str, "user": "public_api"},
    )
    db.add(event)

    await db.commit()

    DeviceLogger.log_communication(str(device.id), device.name, "power_toggle", {"power_state": power_state_str})

    device_resp = _device_to_response(device)
    
    await redis_client.publish_device_update(str(device.id), {
        "action": "device.updated",
        "device": device_resp.model_dump(mode="json"),
    })
    
    await redis_client.publish_event({
        "device_id": str(device.id),
        "device_name": device.name,
        "event_type": "power_toggle",
        "severity": "info",
        "message": f"{device.name} turned {data.status} via public API. Power usage dropped by {int(device.energy_usage_kw * 1000)}W" if data.status == "OFF" else f"{device.name} turned {data.status} via public API. Power usage increased by {int(device.energy_usage_kw * 1000)}W",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    
    webhook_url = (device.extra_data or {}).get("webhook_url")
    if webhook_url:
        payload = {
            "device_id": str(device.id),
            "event": "state_changed",
            "state": device_resp.model_dump(mode="json")
        }
        background_tasks.add_task(dispatch_webhook, webhook_url, payload)

    return device_resp


@router.patch("/public/light/{device_id}/control", response_model=DeviceResponse)
@limiter.limit("60/minute")
async def public_control_light(
    request: Request,
    device_id: uuid.UUID,
    data: DeviceControlRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> DeviceResponse:
    """Send a control command to a smart light publicly."""
    result = await db.execute(
        select(Device)
        .options(selectinload(Device.room))
        .where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
        
    if device.type != DeviceType.SMART_LIGHT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only SMART_LIGHT devices can be controlled via this public endpoint.")

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
        message=f"Command '{data.command}' received via public API",
        extra_data={"command": data.command, "parameters": data.parameters, "user": "public_api"},
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
        "message": f"Command '{data.command}' sent to {device.name} via public API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    
    webhook_url = (device.extra_data or {}).get("webhook_url")
    if webhook_url:
        payload = {
            "device_id": str(device.id),
            "event": "control_command",
            "command": data.command,
            "parameters": data.parameters,
            "state": device_resp.model_dump(mode="json")
        }
        background_tasks.add_task(dispatch_webhook, webhook_url, payload)

    return device_resp


@router.get("/public/device-data", response_model=dict)
@limiter.limit("30/minute")
async def public_list_device_data(
    request: Request,
) -> dict:
    """List all available device data files publicly.

    Returns a list of device names that can be queried via
    GET /api/v1/devices/public/device-data/{device_name}
    """
    logs_dir = os.path.join(os.path.dirname(__file__), "../../data")
    logs_dir = os.path.normpath(logs_dir)

    devices = []
    if os.path.isdir(logs_dir):
        for filename in sorted(os.listdir(logs_dir)):
            if filename.startswith("device_") and filename.endswith(".json"):
                device_name = filename[len("device_"):-len(".json")]
                devices.append({
                    "name": device_name,
                    "url": f"/api/v1/devices/public/device-data/{device_name}",
                })

    return {
        "count": len(devices),
        "devices": devices,
    }


@router.get("/public/device-data/{device_name}")
@limiter.limit("30/minute")
async def public_get_device_data(
    request: Request,
    device_name: str,
) -> dict:
    """Get the full Matter-compliant JSON data for a device by name publicly.

    The device_name should match the file naming convention, e.g.:
    - Bathroom_Light
    - Kitchen_Light
    - Living_Room_AC
    - Front_Door_Lock
    - Dishwasher

    Returns the complete device type definition and communication history.
    """
    # Sanitize device_name to prevent path traversal
    safe_name = os.path.basename(device_name)
    if safe_name != device_name or ".." in device_name or "/" in device_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid device name. Use names like 'Bathroom_Light' or 'Kitchen_Light'.",
        )

    logs_dir = os.path.join(os.path.dirname(__file__), "../../data")
    logs_dir = os.path.normpath(logs_dir)
    file_path = os.path.join(logs_dir, f"device_{safe_name}.json")

    # Verify resolved path is still inside logs_dir
    resolved = os.path.realpath(file_path)
    if not resolved.startswith(os.path.realpath(logs_dir)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid device name.",
        )

    if not os.path.isfile(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device data file not found for '{device_name}'. "
                   f"Use GET /api/v1/devices/public/device-data to see available devices.",
        )

    try:
        with open(file_path, "r") as f:
            data = json.load(f)
        return data
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Device data file for '{device_name}' contains invalid JSON.",
        )
    except OSError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read device data file for '{device_name}'.",
        )


def _find_device_file(identifier: str) -> Optional[str]:
    """Find a device JSON file by its device_id or device_name (e.g. Bathroom_Light)."""
    logs_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "../../data"))
    if not os.path.isdir(logs_dir):
        return None
        
    # Check by exact name match first (e.g. Bathroom_Light -> device_Bathroom_Light.json)
    safe_name = os.path.basename(identifier)
    direct_path = os.path.join(logs_dir, f"device_{safe_name}.json")
    if os.path.isfile(direct_path):
        return direct_path
        
    # Search inside files for device_id match
    for filename in os.listdir(logs_dir):
        if filename.startswith("device_") and filename.endswith(".json"):
            filepath = os.path.join(logs_dir, filename)
            try:
                with open(filepath, "r") as f:
                    data = json.load(f)
                    if data.get("deviceType", {}).get("device_id") == identifier:
                        return filepath
            except (IOError, ValueError, json.JSONDecodeError):
                continue
                
    return None


@router.get("/public/matter/{identifier}/endpoint/{endpoint}")
@limiter.limit("60/minute")
async def matter_get_device(
    request: Request,
    identifier: str,
    endpoint: int,
) -> dict:
    """Matter Protocol GET endpoint for a device."""
    file_path = _find_device_file(identifier)
    if not file_path:
        raise HTTPException(status_code=404, detail="Device not found")
        
    try:
        with open(file_path, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load device file: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/public/matter/{identifier}/endpoint/{endpoint}/cluster/{cluster}/{command_path:path}")
@limiter.limit("60/minute")
async def matter_post_command_path(
    request: Request,
    identifier: str,
    endpoint: int,
    cluster: str,
    command_path: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Matter Protocol POST endpoint for commands specified in URL (e.g. /cluster/OnOff/On)."""
    try:
        payload = await request.json()
    except (ValueError, json.JSONDecodeError):
        payload = {}
        
    # Try to extract actual command name
    clean_command_path = command_path.strip("/")
    
    # If the user omitted the cluster name in the URL (e.g. /cluster/toggle instead of /cluster/OnOff/toggle)
    # The 'cluster' variable will accidentally contain the command.
    known_commands = ["triggereffect", "toggle", "on", "off", "setlevel", "capturesnapshot", "copyscene", "occupancy", "movetolevel"]
    if cluster.lower() in known_commands:
        if clean_command_path:
            clean_command_path = f"{cluster}/{clean_command_path}"
        else:
            clean_command_path = cluster
            
    command = payload.get("command", clean_command_path if clean_command_path else cluster)
    
    return await _handle_matter_command(identifier, action=command, payload=payload, db=db, background_tasks=background_tasks)


@router.post("/public/matter/{identifier}/endpoint/{endpoint}/cluster/{cluster}/command")
@limiter.limit("60/minute")
async def matter_post_command_body(
    request: Request,
    identifier: str,
    endpoint: int,
    cluster: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Matter Protocol POST endpoint for commands specified in body (e.g. {"command": "On"})."""
    try:
        payload = await request.json()
    except (ValueError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
        
    command = payload.get("command")
    if not command:
        raise HTTPException(status_code=400, detail="Missing 'command' in body")
        
    return await _handle_matter_command(identifier, action=command, payload=payload, db=db, background_tasks=background_tasks)


async def _handle_matter_command(identifier: str, action: str, payload: dict, db: AsyncSession, background_tasks: BackgroundTasks) -> dict:
    """Internal handler for Matter commands."""
    file_path = _find_device_file(identifier)
    if not file_path:
        raise HTTPException(status_code=404, detail="Device not found")
        
    # Parse file to get real device name and ID if possible
    device_name = identifier.replace("_", " ")
    device_id = ""
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
            # Try to get from JSON, but fallback to identifier if missing
            json_name = data.get("deviceType", {}).get("device_name", "")
            if json_name:
                device_name = json_name
            device_id = data.get("deviceType", {}).get("device_id", "")
    except (IOError, ValueError, json.JSONDecodeError):
        pass
        
    # Also update Postgres DB and fire websockets if it's a known state command
    try:
        if device_id:
            device_uuid = uuid.UUID(device_id)
            result = await db.execute(
                select(Device).options(selectinload(Device.room)).where(Device.id == device_uuid)
            )
            device = result.scalar_one_or_none()
        else:
            # Fallback: search by name
            result = await db.execute(
                select(Device).options(selectinload(Device.room)).where(Device.name == device_name)
            )
            device = result.scalar_one_or_none()
            if device:
                device_id = str(device.id)
                
        if device:
            action_lower = action.lower()
            power_changed = False
            power_state_str = None
            
            if action_lower == "on":
                power_state_str = "on"
                power_changed = True
            elif action_lower == "off":
                power_state_str = "off"
                power_changed = True
            elif action_lower == "toggle":
                old_state = device.power_state.value if isinstance(device.power_state, PowerState) else device.power_state
                power_state_str = "off" if old_state == "on" else "on"
                power_changed = True
                
            if power_changed:
                device.power_state = PowerState(power_state_str)
                device.last_updated = datetime.now(timezone.utc)
                
                # Delegate to simulation engine state machine
                device_type_str = device.type.value if isinstance(device.type, DeviceType) else device.type
                matter_tracker = device_simulator.ensure_tracker(str(device.id), device_type_str)
                if power_state_str == "on":
                    matter_tracker.set_power_on()  # STARTING → RUNNING after 30s
                else:
                    matter_tracker.set_power_off()  # STOPPING → OFF
                    device.energy_usage_kw = 0.0
                
                await db.commit()
                
                # Dispatch WebSockets
                device_resp = _device_to_response(device)
                await redis_client.publish_device_update(str(device.id), {
                    "action": "device.updated",
                    "device": device_resp.model_dump(mode="json"),
                })
                
                webhook_url = (device.extra_data or {}).get("webhook_url")
                if webhook_url:
                    hook_payload = {
                        "device_id": str(device.id),
                        "event": "state_changed",
                        "state": device_resp.model_dump(mode="json")
                    }
                    background_tasks.add_task(dispatch_webhook, webhook_url, hook_payload)
    except Exception as e:
        # Don't block the Matter API if DB sync fails
        pass

    # Compute specific responses based on spec
    action_lower = action.lower().rstrip("/")
    response_data = {"status": "success", "command": action}
    
    if action_lower == "capturesnapshot":
        IST = timezone(timedelta(hours=5, minutes=30))
        response_data = {
            "snapshotUrl": f"/media/{device_name.replace(' ', '_')}/snapshot.jpg",
            "timestamp": datetime.now(IST).isoformat()
        }
    elif action_lower == "triggereffect":
        response_data = {"id": "0x0040", "name": "TriggerEffect"}
    elif action_lower == "copyscene":
        response_data = {
            "mode": payload.get("mode", 1),
            "groupId": payload.get("groupId", 10),
            "sceneId": payload.get("sceneId", 2)
        }
    elif action_lower == "occupancy":
        response_data = {
            "occupied": payload.get("occupied", True)
        }
    elif action_lower.startswith("setlevel/"):
        level_str = action.split("/")[1]
        response_data = {"level": int(level_str), "transitionTime": 2}
    elif action_lower == "movetolevel":
        response_data = {
            "level": payload.get("level", 150),
            "transitionTime": payload.get("transitionTime", 2)
        }
    elif action_lower == "off":
        response_data = {"id": "0x00", "name": "Off"}
    elif action_lower == "on":
        response_data = {"id": "0x01", "name": "On"}
    elif action_lower == "toggle":
        response_data = {"id": "0x02", "name": "Toggle"}
        
    # Now log it to JSON with the generated response as the payload
    try:
        DeviceLogger.log_communication(device_id, device_name, action, response_data, source="matter_api")
    except Exception as e:
        logger.warning(f"DeviceLogger failed to log communication: {e}")
        
    return response_data




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
    severity: Optional[str] = Query(None),
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
        DeviceType.CAMERA: {
            "recording": False,
            "motion_detection": True,
            "night_vision": True,
        },
    }
    return defaults.get(device_type, {})


@router.post("/public/matter/migrate-schemas")
@limiter.limit("5/minute")
async def migrate_all_schemas(request: Request) -> dict:
    """Force migrate all JSON schemas in the logs directory to the new Matter format."""
    logs_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "../../data"))
    if not os.path.isdir(logs_dir):
        return {"status": "error", "message": "Logs directory not found"}
        
    migrated_count = 0
    total_count = 0
    
    for filename in os.listdir(logs_dir):
        if filename.startswith("device_") and filename.endswith(".json"):
            total_count += 1
            file_path = os.path.join(logs_dir, filename)
            try:
                with open(file_path, "r") as f:
                    schema = json.load(f)
                    
                if schema and "endpoints" not in schema.get("deviceType", {}):
                    # It's an old schema! We need to migrate it.
                    safe_name = filename[len("device_"): -len(".json")]
                    device_name = safe_name.replace("_", " ")
                    
                    device_id = schema.get("deviceType", {}).get("device_id", "")
                    history = schema.get("communication_history", [])
                    
                    new_schema = DeviceLogger._get_matter_schema(device_name, device_id)
                    new_schema["communication_history"] = history
                    
                    with open(file_path, "w") as f:
                        json.dump(new_schema, f, indent=4)
                        
                    migrated_count += 1
            except Exception as e:
                pass
                
    return {
        "status": "success",
        "message": f"Successfully migrated {migrated_count} out of {total_count} device schemas.",
        "migrated_count": migrated_count,
        "total_count": total_count
    }


# =============================================================================
# EVSE MATTER SUPPORT (0x050C)
# =============================================================================

@router.get("/{device_id}/endpoint/{endpoint}")
@limiter.limit("60/minute")
async def get_evse_device_details(
    request: Request,
    device_id: str,
    endpoint: int,
    db: AsyncSession = Depends(get_db),
):
    """Get EVSE device details matching the exact Matter JSON spec."""
    try:
        device_uuid = uuid.UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device_id format")

    result = await db.execute(select(Device).where(Device.id == device_uuid))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Load the exact Matter JSON template
    evse_data = await evse_service.get_evse_device("Energy_EVSE")
    if not evse_data:
        raise HTTPException(status_code=404, detail="EVSE Specification data not found")

    # Merge live state from device.extra_data so callers see current EnableCharging/Disable state
    evse_data["live_state"] = device.extra_data or {}

    return evse_data


@router.post("/{device_id}/endpoint/{endpoint}/cluster/{cluster}/disable")
@limiter.limit("60/minute")
async def disable_evse_charging(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    payload: EVSECommandRequest,
    db: AsyncSession = Depends(get_db),
):
    """Disable EVSE charging via Matter command."""
    if payload.command != "Disable":
        raise HTTPException(status_code=400, detail="Invalid command. Expected 'Disable'.")

    device_uuid = uuid.UUID(device_id)
    result = await db.execute(select(Device).where(Device.id == device_uuid))
    device = result.scalar_one_or_none()
    if device:
        device.power_state = PowerState.OFF
        device.last_updated = datetime.now(timezone.utc)
        device.energy_usage_kw = 0.0
        device_type_str = device.type.value if isinstance(device.type, DeviceType) else device.type
        tracker = device_simulator.ensure_tracker(str(device.id), device_type_str)
        tracker.set_power_off()
        await db.commit()

    update_result = await evse_service.update_evse_state(device_id, {"State": "Disabled", "SupplyState": "Disabled"}, db)
    if update_result is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return {
        "status": "success",
        "commandId": payload.commandId,
        "command": payload.command,
        "cluster": cluster,
        "endpoint": endpoint,
        "response": {
            "State": "Disabled",
            "SupplyState": "Disabled"
        }
    }


@router.post("/{device_id}/endpoint/{endpoint}/cluster/{cluster}/enable")
@limiter.limit("60/minute")
async def enable_evse_charging(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    payload: EVSECommandRequest,
    db: AsyncSession = Depends(get_db),
):
    """Enable EVSE charging via Matter command."""
    if payload.command != "EnableCharging":
        raise HTTPException(status_code=400, detail="Invalid command. Expected 'EnableCharging'.")

    device_uuid = uuid.UUID(device_id)
    result = await db.execute(select(Device).where(Device.id == device_uuid))
    device = result.scalar_one_or_none()
    if device:
        device.power_state = PowerState.ON
        device.last_updated = datetime.now(timezone.utc)
        device_type_str = device.type.value if isinstance(device.type, DeviceType) else device.type
        tracker = device_simulator.ensure_tracker(str(device.id), device_type_str)
        tracker.set_power_on()
        await db.commit()

    update_result = await evse_service.update_evse_state(device_id, {"State": "ChargingEnabled", "SupplyState": "ChargingEnabled"}, db)
    if update_result is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return {
        "status": "success",
        "commandId": payload.commandId,
        "command": payload.command,
        "cluster": cluster,
        "endpoint": endpoint,
        "response": {
            "State": "ChargingEnabled",
            "SupplyState": "ChargingEnabled"
        }
    }


@router.post("/{device_id}/endpoint/{endpoint}/cluster/{cluster}/settarget")
@limiter.limit("60/minute")
async def set_evse_targets(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    payload: EVSESetTargetsRequest,
    db: AsyncSession = Depends(get_db),
):
    """Set EVSE charging targets via Matter command."""
    if payload.command != "SetTargets":
        raise HTTPException(status_code=400, detail="Invalid command")

    await evse_service.update_evse_state(device_id, {"chargingTargetSchedules": payload.chargingTargetSchedules}, db)
    return {
        "status": "success",
        "commandId": payload.commandId,
        "command": payload.command,
        "cluster": cluster,
        "endpoint": endpoint,
        "chargingTargetSchedules": payload.chargingTargetSchedules
    }


@router.get("/{device_id}/endpoint/{endpoint}/cluster/{cluster}/gettargets")
@limiter.limit("60/minute")
async def get_evse_targets(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    db: AsyncSession = Depends(get_db),
):
    """Get EVSE charging targets."""
    state = await evse_service.get_current_state(device_id, db)
    return {
        "commandId": "0x06",
        "command": "GetTargets",
        "chargingTargetSchedules": state.get("chargingTargetSchedules", [])
    }


@router.post("/{device_id}/endpoint/{endpoint}/cluster/{cluster}/cleartargets")
@limiter.limit("60/minute")
async def clear_evse_targets(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    payload: EVSECommandRequest,
    db: AsyncSession = Depends(get_db),
):
    """Clear EVSE charging targets."""
    if payload.command != "ClearTargets":
        raise HTTPException(status_code=400, detail="Invalid command. Expected 'ClearTargets'.")

    await evse_service.update_evse_state(device_id, {"chargingTargetSchedules": []}, db)
    return {"status": "success", "cluster": cluster, "endpoint": endpoint}


@router.get("/{device_id}/endpoint/{endpoint}/cluster/{cluster}/stateofcharge")
@limiter.limit("60/minute")
async def get_evse_state_of_charge(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    db: AsyncSession = Depends(get_db),
):
    """Get EVSE state of charge."""
    state = await evse_service.get_current_state(device_id, db)
    return {"StateOfCharge": state.get("StateOfCharge", 62)}


@router.get("/{device_id}/endpoint/{endpoint}/cluster/{cluster}/activepower")
@limiter.limit("60/minute")
async def get_evse_active_power(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    db: AsyncSession = Depends(get_db),
):
    """Get EVSE active power measurement."""
    state = await evse_service.get_current_state(device_id, db)
    return {"ActivePower": state.get("ActivePower", 11000000)}


@router.get("/{device_id}/endpoint/{endpoint}/cluster/{cluster}/voltage")
@limiter.limit("60/minute")
async def get_evse_voltage(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    db: AsyncSession = Depends(get_db),
):
    """Get EVSE voltage measurement."""
    state = await evse_service.get_current_state(device_id, db)
    return {"Voltage": state.get("Voltage", 400000)}


@router.get("/{device_id}/endpoint/{endpoint}/cluster/{cluster}/activecurrent")
@limiter.limit("60/minute")
async def get_evse_current(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    db: AsyncSession = Depends(get_db),
):
    """Get EVSE active current measurement."""
    state = await evse_service.get_current_state(device_id, db)
    return {"ActiveCurrent": state.get("ActiveCurrent", 16000)}


@router.get("/{device_id}/endpoint/{endpoint}/cluster/{cluster}/currentsessionenergy")
@limiter.limit("60/minute")
async def get_evse_session_energy(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    db: AsyncSession = Depends(get_db),
):
    """Get EVSE current session energy."""
    state = await evse_service.get_current_state(device_id, db)
    return {"CurrentSessionEnergy": state.get("CurrentSessionEnergy", 16500000)}


@router.post("/{device_id}/endpoint/{endpoint}/cluster/{cluster}/triggereffect")
@limiter.limit("60/minute")
async def identify_evse(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Trigger identify effect on EVSE."""
    if payload.get("name") != "TriggerEffect":
        raise HTTPException(status_code=400, detail="Invalid identify effect")

    await evse_service.update_evse_state(device_id, {"IdentifyTriggered": True}, db)
    return {"id": "0x0040", "name": "TriggerEffect"}


@router.post("/{device_id}/endpoint/{endpoint}/cluster/{cluster}/setactivepower")
@limiter.limit("60/minute")
async def set_evse_active_power(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Set EVSE active power measurement (milliwatts)."""
    active_power = payload.get("ActivePower")
    if active_power is None:
        raise HTTPException(status_code=400, detail="Missing 'ActivePower' in body")
    await evse_service.update_evse_state(device_id, {"ActivePower": active_power}, db)
    return {
        "status": "success",
        "cluster": cluster,
        "endpoint": endpoint,
        "ActivePower": active_power
    }


@router.post("/{device_id}/endpoint/{endpoint}/cluster/{cluster}/setvoltage")
@limiter.limit("60/minute")
async def set_evse_voltage(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Set EVSE voltage measurement (millivolts)."""
    voltage = payload.get("Voltage")
    if voltage is None:
        raise HTTPException(status_code=400, detail="Missing 'Voltage' in body")
    await evse_service.update_evse_state(device_id, {"Voltage": voltage}, db)
    return {
        "status": "success",
        "cluster": cluster,
        "endpoint": endpoint,
        "Voltage": voltage
    }


@router.post("/{device_id}/endpoint/{endpoint}/cluster/{cluster}/setactivecurrent")
@limiter.limit("60/minute")
async def set_evse_active_current(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Set EVSE active current measurement (milliamps)."""
    active_current = payload.get("ActiveCurrent")
    if active_current is None:
        raise HTTPException(status_code=400, detail="Missing 'ActiveCurrent' in body")
    await evse_service.update_evse_state(device_id, {"ActiveCurrent": active_current}, db)
    return {
        "status": "success",
        "cluster": cluster,
        "endpoint": endpoint,
        "ActiveCurrent": active_current
    }


# =============================================================================
# SOLAR MATTER SUPPORT
# =============================================================================


@router.get("/{device_id}/solar/endpoint/{endpoint}")
@limiter.limit("60/minute")
async def get_solar_device_details(
    request: Request,
    device_id: str,
    endpoint: int,
    db: AsyncSession = Depends(get_db),
):
    """Get Solar device details matching the Matter JSON spec."""
    try:
        device_uuid = uuid.UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device_id format")

    result = await db.execute(select(Device).where(Device.id == device_uuid))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Load the exact Matter JSON template for Solar
    solar_data = await solar_service.get_solar_device("Solar_Panel")
    if not solar_data:
        raise HTTPException(status_code=404, detail="Solar Specification data not found")

    return solar_data


@router.get("/{device_id}/solar/endpoint/{endpoint}/cluster/{cluster}/activepower")
@limiter.limit("60/minute")
async def get_solar_active_power(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    db: AsyncSession = Depends(get_db),
):
    """Get Solar power output."""
    return {
        "ActivePower": 8000000,
        "displayValue": "8 kW"
    }


@router.get("/{device_id}/solar/endpoint/{endpoint}/cluster/{cluster}/cumulativeenergyexported")
@limiter.limit("60/minute")
async def get_solar_cumulative_energy(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    db: AsyncSession = Depends(get_db),
):
    """Get total Energy generated."""
    return {
        "Energy": 245000000,
        "displayValue": "245 kWh"
    }


@router.get("/{device_id}/solar/endpoint/{endpoint}/cluster/{cluster}/voltage")
@limiter.limit("60/minute")
async def get_solar_voltage(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    db: AsyncSession = Depends(get_db),
):
    """Get Solar Voltage."""
    return {
        "Voltage": 380000,
        "displayValue": "380 V"
    }


@router.get("/{device_id}/solar/endpoint/{endpoint}/cluster/{cluster}/activecurrent")
@limiter.limit("60/minute")
async def get_solar_active_current(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    db: AsyncSession = Depends(get_db),
):
    """Get Solar current."""
    return {
        "ActiveCurrent": 21000,
        "displayValue": "21 A"
    }


@router.get("/{device_id}/solar/endpoint/{endpoint}/cluster/{cluster}/frequency")
@limiter.limit("60/minute")
async def get_solar_frequency(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    db: AsyncSession = Depends(get_db),
):
    """Get Grid frequency."""
    return {
        "Frequency": 50000,
        "displayValue": "50 Hz"
    }


@router.get("/{device_id}/solar/endpoint/{endpoint}/cluster/{cluster}/powerfactor")
@limiter.limit("60/minute")
async def get_solar_power_factor(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    db: AsyncSession = Depends(get_db),
):
    """Get Power Factor."""
    return {
        "Voltage": 400000
    }


@router.post("/{device_id}/solar/endpoint/{endpoint}/cluster/{cluster}/triggereffect")
@limiter.limit("60/minute")
async def identify_solar(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Trigger identify effect on Solar Panel."""
    if body.get("name") != "TriggerEffect":
        raise HTTPException(status_code=400, detail="Invalid identify effect")

    await solar_service.update_solar_state(device_id, {"IdentifyTriggered": True}, db)
    return {"id": "0x0040", "name": "TriggerEffect"}


@router.get("/{device_id}/solar/endpoint/{endpoint}/cluster/{cluster}/labellist")
@limiter.limit("60/minute")
async def get_solar_user_label(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    db: AsyncSession = Depends(get_db),
):
    """Get User Label."""
    return {
        "label": "RoofTop",
        "value": "SolarArray01"
    }


@router.post("/{device_id}/solar/endpoint/{endpoint}/cluster/{cluster}/labellist")
@limiter.limit("60/minute")
async def set_solar_user_label(
    request: Request,
    device_id: str,
    endpoint: int,
    cluster: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Set User Label."""
    if "label" not in body or "value" not in body:
        raise HTTPException(status_code=400, detail="Missing label or value in request body")
        
    await solar_service.update_solar_state(device_id, {"LabelList": [{"label": body["label"], "value": body["value"]}]}, db)
    return {
        "label": body["label"],
        "value": body["value"]
    }


# =============================================================================
# EV VEHICLE MATTER SUPPORT
# =============================================================================

# In-memory store for EV Vehicle state (used when device doesn't exist in DB)
_ev_vehicle_state: dict = {
    "HVBATVoltage": 400,
    "HVSoC": 75,
    "AuxBatVoltage": 12,
    "AvgSpeed": 60,
}


@router.get("/{device_id}/endpoint/{endpoint}/cluster/EvVehicleData/hvbatvoltage")
@limiter.limit("60/minute")
async def get_ev_vehicle_hvbatvoltage(
    request: Request,
    device_id: str,
    endpoint: int,
    db: AsyncSession = Depends(get_db),
):
    """Get EV Vehicle HV Battery Voltage."""
    return {
        "HVBATVoltage": _ev_vehicle_state.get("HVBATVoltage", 400),
        "unit": "V"
    }


@router.post("/{device_id}/endpoint/{endpoint}/cluster/EvVehicleData/hvbatvoltage")
@limiter.limit("60/minute")
async def set_ev_vehicle_hvbatvoltage(
    request: Request,
    device_id: str,
    endpoint: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Set EV Vehicle HV Battery Voltage."""
    value = body.get("value")
    if value is None:
        raise HTTPException(status_code=400, detail="Missing 'value' in request body")
    _ev_vehicle_state["HVBATVoltage"] = value
    return {"value": value}


@router.get("/{device_id}/endpoint/{endpoint}/cluster/EvVehicleData/hvsoc")
@limiter.limit("60/minute")
async def get_ev_vehicle_hvsoc(
    request: Request,
    device_id: str,
    endpoint: int,
    db: AsyncSession = Depends(get_db),
):
    """Get EV Vehicle HV State of Charge."""
    return {
        "HVSoC": _ev_vehicle_state.get("HVSoC", 75),
        "unit": "%"
    }


@router.post("/{device_id}/endpoint/{endpoint}/cluster/EvVehicleData/hvsoc")
@limiter.limit("60/minute")
async def set_ev_vehicle_hvsoc(
    request: Request,
    device_id: str,
    endpoint: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Set EV Vehicle HV State of Charge."""
    value = body.get("value")
    if value is None:
        raise HTTPException(status_code=400, detail="Missing 'value' in request body")
    _ev_vehicle_state["HVSoC"] = value
    return {"value": value}


@router.get("/{device_id}/endpoint/{endpoint}/cluster/EvVehicleData/auxbatvoltage")
@limiter.limit("60/minute")
async def get_ev_vehicle_auxbatvoltage(
    request: Request,
    device_id: str,
    endpoint: int,
    db: AsyncSession = Depends(get_db),
):
    """Get EV Vehicle Auxiliary Battery Voltage."""
    return {
        "AuxBatVoltage": _ev_vehicle_state.get("AuxBatVoltage", 12),
        "unit": "V"
    }


@router.post("/{device_id}/endpoint/{endpoint}/cluster/EvVehicleData/auxbatvoltage")
@limiter.limit("60/minute")
async def set_ev_vehicle_auxbatvoltage(
    request: Request,
    device_id: str,
    endpoint: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Set EV Vehicle Auxiliary Battery Voltage."""
    value = body.get("value")
    if value is None:
        raise HTTPException(status_code=400, detail="Missing 'value' in request body")
    _ev_vehicle_state["AuxBatVoltage"] = value
    return {"value": value}


@router.get("/{device_id}/endpoint/{endpoint}/cluster/EvVehicleData/avgspeed")
@limiter.limit("60/minute")
async def get_ev_vehicle_avgspeed(
    request: Request,
    device_id: str,
    endpoint: int,
    db: AsyncSession = Depends(get_db),
):
    """Get EV Vehicle Average Speed."""
    return {
        "AvgSpeed": _ev_vehicle_state.get("AvgSpeed", 60),
        "unit": "km/h"
    }


@router.post("/{device_id}/endpoint/{endpoint}/cluster/EvVehicleData/avgspeed")
@limiter.limit("60/minute")
async def set_ev_vehicle_avgspeed(
    request: Request,
    device_id: str,
    endpoint: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Set EV Vehicle Average Speed."""
    value = body.get("value")
    if value is None:
        raise HTTPException(status_code=400, detail="Missing 'value' in request body")
    _ev_vehicle_state["AvgSpeed"] = value
    return {"value": value}


# =============================================================================
# MCB SYNCHRONIZATION
# =============================================================================

@router.post("/{device_id}/mcb/sync")
@limiter.limit("60/minute")
async def sync_mcb_state(
    request: Request,
    device_id: str,
    body: DeviceStateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Synchronize physical MCB state with the Digital Twin."""
    try:
        device_uuid = uuid.UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device_id format")

    result = await db.execute(select(Device).where(Device.id == device_uuid))
    device = result.scalar_one_or_none()
    
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    power_state = PowerState.ON if body.status == "ON" else PowerState.OFF
    device.power_state = power_state
    device.last_updated = datetime.now(timezone.utc)
    
    await db.commit()
    
    device_resp = _device_to_response(device)
    await redis_client.publish_device_update(str(device.id), {
        "action": "mcb_synced",
        "device": device_resp.model_dump(mode="json"),
        "status": body.status
    })
    
    return {"status": "success", "device_id": device_id, "new_state": body.status}
