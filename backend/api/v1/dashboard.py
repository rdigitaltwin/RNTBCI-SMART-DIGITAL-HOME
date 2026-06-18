"""RNTBCI Smart Home Digital Twin - Dashboard & Energy API Routes."""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.database import get_db
from backend.models import (
    Alert,
    Device,
    DeviceEvent,
    DeviceStatus,
    EnergyHistory,
    EventSeverity,
    Room,
    User,
)
from backend.schemas import (
    DashboardRealtimeResponse,
    DeviceEventResponse,
    EnergySummaryResponse,
)

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
energy_router = APIRouter(prefix="/energy", tags=["Energy"])


@dashboard_router.get("/realtime", response_model=DashboardRealtimeResponse)
@limiter.limit("60/minute")
async def get_realtime_dashboard(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardRealtimeResponse:
    """Get real-time dashboard aggregation data."""
    # Device counts by status
    status_counts = {}
    for status_val in DeviceStatus:
        result = await db.execute(
            select(func.count()).where(Device.status == status_val)
        )
        status_counts[status_val.value] = result.scalar() or 0

    total_devices = sum(status_counts.values())

    # Energy totals
    energy_result = await db.execute(
        select(
            func.sum(Device.energy_usage_kw),
            func.max(Device.energy_usage_kw),
            func.avg(Device.energy_usage_kw),
        )
    )
    energy_row = energy_result.one()
    total_energy = float(energy_row[0] or 0)
    peak_load = float(energy_row[1] or 0)
    avg_usage = float(energy_row[2] or 0)

    # Active alerts
    alert_result = await db.execute(
        select(func.count()).where(Alert.acknowledged == False)
    )
    active_alerts = alert_result.scalar() or 0

    # Recent events (last 20)
    recent_events_result = await db.execute(
        select(DeviceEvent)
        .order_by(DeviceEvent.timestamp.desc())
        .limit(20)
    )
    recent_events = [
        DeviceEventResponse(
            id=e.id,
            device_id=e.device_id,
            event_type=e.event_type,
            severity=e.severity.value if isinstance(e.severity, EventSeverity) else e.severity,
            message=e.message,
            metadata=e.extra_data or {},
            timestamp=e.timestamp,
        )
        for e in recent_events_result.scalars().all()
    ]

    # Power trend (last 24h, hourly)
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    power_trend_result = await db.execute(
        select(
            func.date_trunc("hour", EnergyHistory.timestamp).label("hour"),
            func.avg(EnergyHistory.power_kw).label("avg_power"),
        )
        .where(EnergyHistory.timestamp >= day_ago)
        .group_by("hour")
        .order_by("hour")
    )
    power_trend = [
        {"timestamp": str(row.hour), "power_kw": round(float(row.avg_power), 3)}
        for row in power_trend_result.all()
    ]

    # Room stats
    room_stats_result = await db.execute(
        select(
            Room.name,
            func.count(Device.id).label("device_count"),
            func.sum(Device.energy_usage_kw).label("total_energy"),
        )
        .join(Device, Device.room_id == Room.id)
        .group_by(Room.name)
    )
    room_stats = [
        {
            "room": row.name,
            "device_count": row.device_count,
            "total_energy_kw": round(float(row.total_energy or 0), 3),
        }
        for row in room_stats_result.all()
    ]

    return DashboardRealtimeResponse(
        total_devices=total_devices,
        online_devices=status_counts.get("online", 0),
        offline_devices=status_counts.get("offline", 0),
        faulty_devices=status_counts.get("faulty", 0),
        warning_devices=status_counts.get("warning", 0),
        total_energy_kw=round(total_energy, 3),
        peak_load_kw=round(peak_load, 3),
        average_usage_kw=round(avg_usage, 3),
        active_alerts=active_alerts,
        recent_events=recent_events,
        power_trend=power_trend,
        device_health={
            "online": status_counts.get("online", 0),
            "offline": status_counts.get("offline", 0),
            "faulty": status_counts.get("faulty", 0),
            "warning": status_counts.get("warning", 0),
        },
        room_stats=room_stats,
    )


@energy_router.get("/summary", response_model=EnergySummaryResponse)
@limiter.limit("60/minute")
async def get_energy_summary(
    request: Request,
    period: str = Query("day", regex="^(day|week|month)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EnergySummaryResponse:
    """Get energy analytics summary."""
    now = datetime.now(timezone.utc)

    if period == "day":
        start = now - timedelta(days=1)
    elif period == "week":
        start = now - timedelta(weeks=1)
    else:
        start = now - timedelta(days=30)

    # Overall energy stats
    energy_result = await db.execute(
        select(
            func.sum(EnergyHistory.power_kw),
            func.max(EnergyHistory.power_kw),
            func.avg(EnergyHistory.power_kw),
            func.sum(EnergyHistory.cost_usd),
        )
        .where(EnergyHistory.timestamp >= start)
    )
    row = energy_result.one()

    # Device counts
    device_count_result = await db.execute(select(func.count()).select_from(Device))
    device_count = device_count_result.scalar() or 0

    online_result = await db.execute(
        select(func.count()).where(Device.status == DeviceStatus.ONLINE)
    )
    online_count = online_result.scalar() or 0

    # Efficiency average
    eff_result = await db.execute(select(func.avg(Device.efficiency_percent)))
    eff_avg = float(eff_result.scalar() or 100)

    # Room breakdown
    room_breakdown_result = await db.execute(
        select(
            Room.name.label("room_name"),
            func.sum(EnergyHistory.power_kw).label("total_power"),
            func.avg(EnergyHistory.power_kw).label("avg_power"),
            func.sum(EnergyHistory.cost_usd).label("total_cost"),
        )
        .join(Device, EnergyHistory.device_id == Device.id)
        .join(Room, Device.room_id == Room.id)
        .where(EnergyHistory.timestamp >= start)
        .group_by(Room.name)
    )
    room_breakdown = [
        {
            "room": r.room_name,
            "total_power_kw": round(float(r.total_power or 0), 3),
            "avg_power_kw": round(float(r.avg_power or 0), 3),
            "total_cost_usd": round(float(r.total_cost or 0), 2),
        }
        for r in room_breakdown_result.all()
    ]

    # Device breakdown
    device_breakdown_result = await db.execute(
        select(
            Device.name.label("device_name"),
            Device.type.label("device_type"),
            func.sum(EnergyHistory.power_kw).label("total_power"),
            func.avg(EnergyHistory.power_kw).label("avg_power"),
        )
        .join(Device, EnergyHistory.device_id == Device.id)
        .where(EnergyHistory.timestamp >= start)
        .group_by(Device.name, Device.type)
        .order_by(func.sum(EnergyHistory.power_kw).desc())
    )
    device_breakdown = [
        {
            "device": d.device_name,
            "type": d.device_type.value if hasattr(d.device_type, 'value') else d.device_type,
            "total_power_kw": round(float(d.total_power or 0), 3),
            "avg_power_kw": round(float(d.avg_power or 0), 3),
        }
        for d in device_breakdown_result.all()
    ]

    # Hourly data
    hourly_result = await db.execute(
        select(
            func.date_trunc("hour", EnergyHistory.timestamp).label("hour"),
            func.sum(EnergyHistory.power_kw).label("total_power"),
            func.avg(EnergyHistory.power_kw).label("avg_power"),
            func.sum(EnergyHistory.cost_usd).label("total_cost"),
        )
        .where(EnergyHistory.timestamp >= start)
        .group_by("hour")
        .order_by("hour")
    )
    hourly_data = [
        {
            "timestamp": str(h.hour),
            "total_power_kw": round(float(h.total_power or 0), 3),
            "avg_power_kw": round(float(h.avg_power or 0), 3),
            "total_cost_usd": round(float(h.total_cost or 0), 2),
        }
        for h in hourly_result.all()
    ]

    return EnergySummaryResponse(
        total_consumption_kw=round(float(row[0] or 0), 3),
        peak_load_kw=round(float(row[1] or 0), 3),
        average_usage_kw=round(float(row[2] or 0), 3),
        total_cost_usd=round(float(row[3] or 0), 2),
        efficiency_average=round(eff_avg, 1),
        device_count=device_count,
        online_devices=online_count,
        period_start=start,
        period_end=now,
        room_breakdown=room_breakdown,
        device_breakdown=device_breakdown,
        hourly_data=hourly_data,
    )
