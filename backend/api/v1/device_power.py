"""RNTBCI Smart Home Digital Twin - Device Power History API.

Endpoints for querying and exporting per-device power consumption time-series.
Exports support wide-format pivoting (each device becomes its own kW/kVAR column pair).
"""

import csv
import io
import logging
import zoneinfo
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.database import get_db
from backend.models import DevicePowerHistory, User
from backend.schemas import DevicePowerHistoryListResponse, DevicePowerHistoryResponse

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

device_power_router = APIRouter(prefix="/device-power", tags=["Device Power"])


@device_power_router.get("/history", response_model=DevicePowerHistoryListResponse)
@limiter.limit("60/minute")
async def get_device_power_history(
    request: Request,
    device_id: str | None = Query(None, description="Filter by device UUID"),
    device_name: str | None = Query(None, description="Filter by device name (partial match)"),
    start_date: datetime | None = Query(None, description="Start date (ISO 8601)"),
    end_date: datetime | None = Query(None, description="End date (ISO 8601)"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=10000),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DevicePowerHistoryListResponse:
    """Get paginated per-device power consumption history.

    Supports filtering by device ID, device name, date range, pagination, and sort.
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

    if device_name:
        filters.append(DevicePowerHistory.device_name.ilike(f"%{device_name}%"))
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
                id=r.id,
                timestamp=r.timestamp,
                device_id=r.device_id,
                device_name=r.device_name,
                mode=r.mode,
                kw=r.kw,
                kvar=r.kvar,
                power_factor=r.power_factor,
                energy_kwh=r.energy_kwh,
                created_at=r.created_at,
            )
            for r in records
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


def _pivot_records(records: list) -> tuple[list[str], list[dict]]:
    """Pivot normalized device power records into wide format.

    Returns:
        Tuple of (header list, list of row dicts).

    Output format:
        timestamp | base_kW | base_kVAR | fridge_kW | fridge_kVAR | hvac_kW | ...
    """
    # Group by timestamp
    time_buckets: dict[str, dict[str, dict[str, float]]] = defaultdict(dict)
    device_names: set[str] = set()

    for r in records:
        ist_time = r.timestamp.astimezone(zoneinfo.ZoneInfo("Asia/Kolkata")) if r.timestamp.tzinfo else r.timestamp.replace(tzinfo=timezone.utc).astimezone(zoneinfo.ZoneInfo("Asia/Kolkata"))
        ts = ist_time.strftime("%Y-%m-%d %H:%M:%S IST")
        # Normalize name for column: "Living Room AC" → "living_room_ac"
        col_name = r.device_name.lower().replace(" ", "_")
        device_names.add(col_name)
        time_buckets[ts][col_name] = {
            "kw": round(r.kw, 4),
            "kvar": round(r.kvar, 4),
        }

    # Sort devices alphabetically for consistent column order
    sorted_devices = sorted(device_names)

    # Build headers
    headers = ["timestamp"]
    for name in sorted_devices:
        headers.append(f"{name}_kW")
        headers.append(f"{name}_kVAR")

    # Build rows
    rows = []
    for ts in sorted(time_buckets.keys()):
        row = {"timestamp": ts}
        for name in sorted_devices:
            data = time_buckets[ts].get(name, {"kw": 0.0, "kvar": 0.0})
            row[f"{name}_kW"] = data["kw"]
            row[f"{name}_kVAR"] = data["kvar"]
        rows.append(row)

    return headers, rows


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
    """Download device power history as wide-format CSV.

    Columns: timestamp, device1_kW, device1_kVAR, device2_kW, device2_kVAR, ...
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

    headers, rows = _pivot_records(records)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    writer.writerows(rows)

    output.seek(0)
    ist_now = datetime.now(timezone.utc).astimezone(zoneinfo.ZoneInfo("Asia/Kolkata"))
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
    """Download device power history as wide-format XLSX.

    Columns: timestamp, device1_kW, device1_kVAR, device2_kW, device2_kVAR, ...
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

    headers, rows = _pivot_records(records)

    wb = Workbook()
    ws = wb.active
    ws.title = "Device Power History"
    ws.append(headers)

    for row in rows:
        ws.append([row.get(h, 0) for h in headers])

    # Auto-width columns
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = max_len + 2

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    ist_now = datetime.now(timezone.utc).astimezone(zoneinfo.ZoneInfo("Asia/Kolkata"))
    filename = f"device_power_history_{ist_now.strftime('%Y%m%d_%H%M%S')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
