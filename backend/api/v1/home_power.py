"""RNTBCI Smart Home Digital Twin - Home Power History API.

Endpoints for querying and exporting total home power consumption time-series.
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

from backend.auth.dependencies import get_current_user
from backend.database import get_db
from backend.models import HomePowerHistory, User
from backend.schemas import HomePowerHistoryListResponse, HomePowerHistoryResponse

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

home_power_router = APIRouter(prefix="/home-power", tags=["Home Power"])


@home_power_router.get("/history", response_model=HomePowerHistoryListResponse)
@limiter.limit("60/minute")
async def get_home_power_history(
    request: Request,
    start_date: datetime | None = Query(None, description="Start date (ISO 8601)"),
    end_date: datetime | None = Query(None, description="End date (ISO 8601)"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=1000),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HomePowerHistoryListResponse:
    """Get paginated total home power consumption history.

    Supports date range filtering, pagination, and sort order.
    """
    query = select(HomePowerHistory)
    filters = []

    if start_date:
        filters.append(HomePowerHistory.timestamp >= start_date)
    if end_date:
        filters.append(HomePowerHistory.timestamp <= end_date)

    if filters:
        query = query.where(and_(*filters))

    # Count total (Optimized)
    count_query = select(func.count(HomePowerHistory.id))
    if filters:
        count_query = count_query.where(and_(*filters))
        
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply sort and pagination
    if sort_order == "asc":
        query = query.order_by(HomePowerHistory.timestamp.asc())
    else:
        query = query.order_by(HomePowerHistory.timestamp.desc())

    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    records = result.scalars().all()

    return HomePowerHistoryListResponse(
        records=[
            HomePowerHistoryResponse.model_validate(r)
            for r in records
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@home_power_router.get("/download/csv")
@limiter.limit("10/minute")
async def download_home_power_csv(
    request: Request,
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Download home power consumption history as CSV.

    Includes timestamp and total_home_power_consumption_kw columns.
    """
    query = select(HomePowerHistory)
    filters = []
    if start_date:
        filters.append(HomePowerHistory.timestamp >= start_date)
    if end_date:
        filters.append(HomePowerHistory.timestamp <= end_date)
    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(HomePowerHistory.timestamp.asc()).limit(50000)
    result = await db.execute(query)
    records = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Dynamically get all float columns (excluding id and timestamp)
    val_cols = [c.key for c in HomePowerHistory.__table__.columns if c.key not in ("id", "timestamp")]
    
    writer.writerow(["timestamp"] + val_cols)

    for r in records:
        ist_time = r.timestamp.astimezone(zoneinfo.ZoneInfo("Asia/Kolkata")) if r.timestamp.tzinfo else r.timestamp.replace(tzinfo=timezone.utc).astimezone(zoneinfo.ZoneInfo("Asia/Kolkata"))
        row = [ist_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + " IST"]
        for col in val_cols:
            val = getattr(r, col, 0.0)
            row.append(round(val, 4) if isinstance(val, (float, int)) else val)
        writer.writerow(row)

    output.seek(0)
    ist_now = datetime.now(timezone.utc).astimezone(zoneinfo.ZoneInfo("Asia/Kolkata"))
    filename = f"home_power_history_{ist_now.strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@home_power_router.get("/download/xlsx")
@limiter.limit("10/minute")
async def download_home_power_xlsx(
    request: Request,
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Download home power consumption history as XLSX (Excel).

    Includes timestamp and total_home_power_consumption_kw columns.
    """
    from openpyxl import Workbook

    query = select(HomePowerHistory)
    filters = []
    if start_date:
        filters.append(HomePowerHistory.timestamp >= start_date)
    if end_date:
        filters.append(HomePowerHistory.timestamp <= end_date)
    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(HomePowerHistory.timestamp.asc()).limit(50000)
    result = await db.execute(query)
    records = result.scalars().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Home Power History"
    
    # Dynamically get all float columns (excluding id and timestamp)
    val_cols = [c.key for c in HomePowerHistory.__table__.columns if c.key not in ("id", "timestamp")]
    
    headers = ["Timestamp"] + [c.replace("_", " ").title() for c in val_cols]
    ws.append(headers)

    for r in records:
        ist_time = r.timestamp.astimezone(zoneinfo.ZoneInfo("Asia/Kolkata")) if r.timestamp.tzinfo else r.timestamp.replace(tzinfo=timezone.utc).astimezone(zoneinfo.ZoneInfo("Asia/Kolkata"))
        row = [ist_time.strftime("%Y-%m-%d %H:%M:%S IST")]
        for col in val_cols:
            val = getattr(r, col, 0.0)
            row.append(round(val, 4) if isinstance(val, (float, int)) else val)
        ws.append(row)

    # Auto-width columns
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = max_len + 2

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    ist_now = datetime.now(timezone.utc).astimezone(zoneinfo.ZoneInfo("Asia/Kolkata"))
    filename = f"home_power_history_{ist_now.strftime('%Y%m%d_%H%M%S')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
