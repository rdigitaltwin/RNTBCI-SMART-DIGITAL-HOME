"""RNTBCI Smart Home Digital Twin - Device Power History API.

Endpoints for querying and exporting per-device power consumption time-series.
Table schema: device_id | timestamp (IST) | total_power_consumption_kw
"""

from __future__ import annotations
import csv
import io
import logging
import zoneinfo
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.auth.dependencies import get_current_user
from backend.database import get_db
from backend.models import Device, DevicePowerHistory, User
from backend.schemas import DevicePowerHistoryListResponse, DevicePowerHistoryResponse

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

device_power_router = APIRouter(prefix="/device-power", tags=["Device Power"])

IST = zoneinfo.ZoneInfo("Asia/Kolkata")


@device_power_router.get("/history", response_model=DevicePowerHistoryListResponse)
@limiter.limit("60/minute")
async def get_device_power_history(
    request: Request,
    device_id: str | None = Query(None, description="Filter by device UUID"),
    start_date: datetime | None = Query(None, description="Start date (ISO 8601)"),
    end_date: datetime | None = Query(None, description="End date (ISO 8601)"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=10000),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DevicePowerHistoryListResponse:
    """Get paginated per-device power consumption history.

    Returns: device_id, timestamp (IST), total_power_consumption_kw
    """
    query = select(DevicePowerHistory)
    filters = []

    if device_id:
        import uuid as uuid_mod
        try:
            parsed_id = uuid_mod.UUID(device_id)
            filters.append(DevicePowerHistory.device_id == parsed_id)
        except ValueError:
            pass

    if start_date:
        filters.append(DevicePowerHistory.timestamp >= start_date)
    if end_date:
        filters.append(DevicePowerHistory.timestamp <= end_date)

    if filters:
        query = query.where(and_(*filters))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Sort and paginate
    if sort_order == "asc":
        query = query.order_by(DevicePowerHistory.timestamp.asc())
    else:
        query = query.order_by(DevicePowerHistory.timestamp.desc())

    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    records = result.scalars().all()

    return DevicePowerHistoryListResponse(
        records=[
            DevicePowerHistoryResponse(
                device_id=r.device_id,
                timestamp=r.timestamp,
                total_power_consumption_kw=r.total_power_consumption_kw,
            )
            for r in records
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@device_power_router.get("/calculate")
@limiter.limit("60/minute")
async def calculate_device_power(
    request: Request,
    device_id: str = Query(..., description="Device UUID"),
    start_date: datetime = Query(..., description="Start date (ISO 8601)"),
    end_date: datetime = Query(..., description="End date (ISO 8601)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Calculate the total accumulated power consumption for a specific device between two times.
    
    This performs a database-level sum over the historical time-series data.
    """
    import uuid as uuid_mod
    try:
        parsed_id = uuid_mod.UUID(device_id)
    except ValueError:
        return {"error": "Invalid device UUID format."}
        
    query = select(func.sum(DevicePowerHistory.total_power_consumption_kw)).where(
        and_(
            DevicePowerHistory.device_id == parsed_id,
            DevicePowerHistory.timestamp >= start_date,
            DevicePowerHistory.timestamp <= end_date
        )
    )
    
    result = await db.execute(query)
    total_power = result.scalar() or 0.0
    
    return {
        "device_id": str(parsed_id),
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_consumed_kw": round(total_power, 4)
    }


@device_power_router.get("/download/csv")
@limiter.limit("10/minute")
async def download_device_power_csv(
    request: Request,
    device_id: str | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Download device power history as CSV.

    Columns: device_id, timestamp, total_power_consumption_kw
    """
    query = select(DevicePowerHistory)
    filters = []
    if device_id:
        import uuid as uuid_mod
        try:
            parsed_id = uuid_mod.UUID(device_id)
            filters.append(DevicePowerHistory.device_id == parsed_id)
        except ValueError:
            pass
    if start_date:
        filters.append(DevicePowerHistory.timestamp >= start_date)
    if end_date:
        filters.append(DevicePowerHistory.timestamp <= end_date)
    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(DevicePowerHistory.timestamp.asc())
    result = await db.execute(query)
    records = result.scalars().all()

    headers = ["device_id", "timestamp", "total_power_consumption_kw"]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)

    for r in records:
        ist_time = r.timestamp.astimezone(IST) if r.timestamp.tzinfo else r.timestamp.replace(tzinfo=timezone.utc).astimezone(IST)
        writer.writerow([
            str(r.device_id),
            ist_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + " IST",
            round(r.total_power_consumption_kw, 4),
        ])

    output.seek(0)
    ist_now = datetime.now(timezone.utc).astimezone(IST)
    filename = f"device_power_history_{ist_now.strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@device_power_router.get("/download/xlsx")
@limiter.limit("10/minute")
async def download_device_power_xlsx(
    request: Request,
    device_id: str | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Download device power history as XLSX.

    Columns: device_id, timestamp, total_power_consumption_kw
    """
    from openpyxl import Workbook

    query = select(DevicePowerHistory)
    filters = []
    if device_id:
        import uuid as uuid_mod
        try:
            parsed_id = uuid_mod.UUID(device_id)
            filters.append(DevicePowerHistory.device_id == parsed_id)
        except ValueError:
            pass
    if start_date:
        filters.append(DevicePowerHistory.timestamp >= start_date)
    if end_date:
        filters.append(DevicePowerHistory.timestamp <= end_date)
    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(DevicePowerHistory.timestamp.asc())
    result = await db.execute(query)
    records = result.scalars().all()

    headers = ["device_id", "timestamp", "total_power_consumption_kw"]

    wb = Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "Device Power History"
    ws.append(headers)

    for r in records:
        ist_time = r.timestamp.astimezone(IST) if r.timestamp.tzinfo else r.timestamp.replace(tzinfo=timezone.utc).astimezone(IST)
        ws.append([
            str(r.device_id),
            ist_time.strftime("%Y-%m-%d %H:%M:%S"),
            round(r.total_power_consumption_kw, 4),
        ])

    # Auto-width columns
    from openpyxl.cell import Cell
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        first_cell = col[0]
        if isinstance(first_cell, Cell):
            ws.column_dimensions[first_cell.column_letter].width = max_len + 2

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    ist_now = datetime.now(timezone.utc).astimezone(IST)
    filename = f"device_power_history_{ist_now.strftime('%Y%m%d_%H%M%S')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
