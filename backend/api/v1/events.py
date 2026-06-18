"""RNTBCI Smart Home Digital Twin - Events & Alerts API Routes."""

import csv
import io
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.auth.dependencies import get_current_user, require_user_or_admin
from backend.database import get_db
from backend.models import (
    Alert,
    Device,
    DeviceEvent,
    EventSeverity,
    User,
)
from backend.redis.client import redis_client
from backend.schemas import (
    AlertAcknowledgeRequest,
    AlertResponse,
    DeviceEventResponse,
    EventListResponse,
)

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

events_router = APIRouter(prefix="/events", tags=["Events"])
alerts_router = APIRouter(prefix="/alerts", tags=["Alerts"])


@events_router.get("", response_model=EventListResponse)
@limiter.limit("100/minute")
async def list_events(
    request: Request,
    severity: str | None = Query(None),
    device_id: uuid.UUID | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EventListResponse:
    """List all events with filters."""
    query = select(DeviceEvent).options(selectinload(DeviceEvent.device))

    if severity:
        query = query.where(DeviceEvent.severity == severity)
    if device_id:
        query = query.where(DeviceEvent.device_id == device_id)
    if search:
        query = query.where(DeviceEvent.message.ilike(f"%{search}%"))

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
                device_name=e.device.name if e.device else None,
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


@events_router.get("/export")
@limiter.limit("10/minute")
async def export_events_csv(
    request: Request,
    severity: str | None = Query(None),
    current_user: User = Depends(require_user_or_admin),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Export events as CSV file."""
    query = select(DeviceEvent).options(selectinload(DeviceEvent.device))

    if severity:
        query = query.where(DeviceEvent.severity == severity)

    query = query.order_by(DeviceEvent.timestamp.desc()).limit(10000)
    result = await db.execute(query)
    events = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Device", "Event Type", "Severity", "Message"])

    for e in events:
        writer.writerow([
            e.timestamp.isoformat(),
            e.device.name if e.device else "Unknown",
            e.event_type,
            e.severity.value if isinstance(e.severity, EventSeverity) else e.severity,
            e.message,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=events_export.csv",
            "X-Content-Type-Options": "nosniff",
        },
    )


@alerts_router.get("", response_model=list[AlertResponse])
@limiter.limit("100/minute")
async def list_alerts(
    request: Request,
    acknowledged: bool | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AlertResponse]:
    """List alerts."""
    query = select(Alert).options(selectinload(Alert.device))

    if acknowledged is not None:
        query = query.where(Alert.acknowledged == acknowledged)

    query = query.order_by(Alert.timestamp.desc()).limit(100)
    result = await db.execute(query)
    alerts = result.scalars().all()

    return [
        AlertResponse(
            id=a.id,
            device_id=a.device_id,
            device_name=a.device.name if a.device else None,
            type=a.type.value if hasattr(a.type, 'value') else a.type,
            severity=a.severity.value if isinstance(a.severity, EventSeverity) else a.severity,
            message=a.message,
            acknowledged=a.acknowledged,
            metadata=a.extra_data or {},
            timestamp=a.timestamp,
        )
        for a in alerts
    ]


@alerts_router.patch("/{alert_id}", response_model=AlertResponse)
@limiter.limit("30/minute")
async def acknowledge_alert(
    request: Request,
    alert_id: uuid.UUID,
    data: AlertAcknowledgeRequest,
    current_user: User = Depends(require_user_or_admin),
    db: AsyncSession = Depends(get_db),
) -> AlertResponse:
    """Acknowledge or dismiss an alert."""
    result = await db.execute(
        select(Alert)
        .options(selectinload(Alert.device))
        .where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    alert.acknowledged = data.acknowledged
    alert.acknowledged_by = current_user.id
    await db.commit()

    await redis_client.publish_alert({
        "action": "alert_acknowledged",
        "alert_id": str(alert.id),
        "acknowledged_by": current_user.username,
    })

    return AlertResponse(
        id=alert.id,
        device_id=alert.device_id,
        device_name=alert.device.name if alert.device else None,
        type=alert.type.value if hasattr(alert.type, 'value') else alert.type,
        severity=alert.severity.value if isinstance(alert.severity, EventSeverity) else alert.severity,
        message=alert.message,
        acknowledged=alert.acknowledged,
        metadata=alert.extra_data or {},
        timestamp=alert.timestamp,
    )
