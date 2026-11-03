"""Modbus shunt meter and internal EPM routes.

Mounted alongside existing routers. Does not change device Matter paths.
Load values (current/power) follow the architecture: readable only while the
linked device is ON. GRID001 is always readable.
"""

from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user
from backend.database import get_db
from backend.services import metering as metering_service

limiter = Limiter(key_func=get_remote_address)

shunt_router = APIRouter(
    prefix="/shunt",
    tags=["Shunt Meter Integration"],
    dependencies=[Depends(get_current_user)],
)
device_metering_router = APIRouter(
    prefix="/devices",
    tags=["Shunt Meter Integration"],
    dependencies=[Depends(get_current_user)],
)
catalog_router = APIRouter(
    prefix="/metering",
    tags=["Shunt Meter Integration"],
    dependencies=[Depends(get_current_user)],
)


async def _device_or_404(device_id: str, db: AsyncSession):
    device = await metering_service.find_device(device_id, db)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@catalog_router.get("/catalog")
@limiter.limit("60/minute")
async def get_metering_catalog(request: Request, db: AsyncSession = Depends(get_db)):
    """Architecture map: every device, its category, and the URL used to read it."""
    return await metering_service.architecture_catalog(db)


@catalog_router.post("/seed")
@limiter.limit("10/minute")
async def seed_metering(request: Request, db: AsyncSession = Depends(get_db)):
    """Idempotent seed for categories, GRID001, SHUNT001-005, and Category 1 EPM rows."""
    from backend.utils.seed_shunt_meters import seed_shunt_metering

    created = await seed_shunt_metering(db)
    catalog = await metering_service.architecture_catalog(db)
    return {"created": created, "grid": catalog.get("grid"), "deviceCount": len(catalog.get("devices") or [])}


@shunt_router.get("")
@limiter.limit("60/minute")
async def list_shunt_meters(request: Request, db: AsyncSession = Depends(get_db)):
    """List every shunt meter including GRID001 (Modbus shunt meter Main)."""
    return await metering_service.list_shunts(db)


@shunt_router.get("/{meter_id}")
@limiter.limit("60/minute")
async def get_shunt_meter(request: Request, meter_id: str, db: AsyncSession = Depends(get_db)):
    meter = await metering_service.get_shunt(meter_id, db)
    device = await metering_service.linked_device(meter, db)
    return metering_service.shunt_payload(meter, device)


@shunt_router.get("/{meter_id}/{field}")
@limiter.limit("60/minute")
async def get_shunt_field(
    request: Request,
    meter_id: str,
    field: str,
    db: AsyncSession = Depends(get_db),
):
    name = metering_service.normalize_field(field)
    meter = await metering_service.get_shunt(meter_id, db)
    device = await metering_service.linked_device(meter, db)
    available = metering_service.shunt_available(meter, device)
    metering_service.require_load_access(name, available)
    payload = metering_service.shunt_payload(meter, device)
    return metering_service.field_payload(
        "meterId",
        meter.meter_id,
        name,
        payload["measurements"][name],
        extra={"available": available, "devicePowerState": payload["devicePowerState"]},
    )


@shunt_router.post("/{meter_id}/measurements")
@limiter.limit("60/minute")
async def post_shunt_measurements(
    request: Request,
    meter_id: str,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    meter = await metering_service.get_shunt(meter_id, db)
    device = await metering_service.linked_device(meter, db)
    values = metering_service.parse_measurements(body)
    values = metering_service.enforce_off_write(
        values,
        is_on=metering_service.shunt_available(meter, device),
        is_grid=meter.role == "grid",
    )
    await metering_service.write_shunt(meter, values, posted=True)
    await db.commit()
    return metering_service.shunt_payload(meter, device)


@device_metering_router.get("/{device_id}/epm")
@limiter.limit("60/minute")
async def get_device_epm(request: Request, device_id: str, db: AsyncSession = Depends(get_db)):
    device = await _device_or_404(device_id, db)
    row = await metering_service.get_epm(device, db)
    return metering_service.epm_payload(row, device)


@device_metering_router.get("/{device_id}/epm/{field}")
@limiter.limit("60/minute")
async def get_device_epm_field(
    request: Request,
    device_id: str,
    field: str,
    db: AsyncSession = Depends(get_db),
):
    name = metering_service.normalize_field(field)
    device = await _device_or_404(device_id, db)
    row = await metering_service.get_epm(device, db)
    available = metering_service.device_is_on(device)
    metering_service.require_load_access(name, available)
    payload = metering_service.epm_payload(row, device)
    return metering_service.field_payload(
        "deviceId",
        str(device.id),
        name,
        payload["epm"][name],
        extra={"available": available, "devicePowerState": payload["devicePowerState"]},
    )


@device_metering_router.post("/{device_id}/epm")
@limiter.limit("60/minute")
async def post_device_epm(
    request: Request,
    device_id: str,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    device = await _device_or_404(device_id, db)
    row = await metering_service.get_epm(device, db)
    values = metering_service.parse_measurements(body)
    values = metering_service.enforce_off_write(
        values, is_on=metering_service.device_is_on(device), is_grid=False
    )
    await metering_service.write_epm(row, values, posted=True)
    await db.commit()
    return metering_service.epm_payload(row, device)


@device_metering_router.get("/{device_id}/shunt")
@limiter.limit("60/minute")
async def get_device_shunt(request: Request, device_id: str, db: AsyncSession = Depends(get_db)):
    """Category 2: read the shunt attached to this device (diagram access path)."""
    device = await _device_or_404(device_id, db)
    meter = await metering_service.get_device_shunt(device, db)
    return metering_service.shunt_payload(meter, device)


@device_metering_router.get("/{device_id}/shunt/{field}")
@limiter.limit("60/minute")
async def get_device_shunt_field(
    request: Request,
    device_id: str,
    field: str,
    db: AsyncSession = Depends(get_db),
):
    name = metering_service.normalize_field(field)
    device = await _device_or_404(device_id, db)
    meter = await metering_service.get_device_shunt(device, db)
    available = metering_service.shunt_available(meter, device)
    metering_service.require_load_access(name, available)
    payload = metering_service.shunt_payload(meter, device)
    return metering_service.field_payload(
        "meterId",
        meter.meter_id,
        name,
        payload["measurements"][name],
        extra={"available": available, "devicePowerState": payload["devicePowerState"]},
    )


@device_metering_router.get("/{device_id}/metering")
@limiter.limit("60/minute")
async def get_device_metering(
    request: Request,
    device_id: str,
    db: AsyncSession = Depends(get_db),
):
    device = await _device_or_404(device_id, db)
    return await metering_service.resolve_device_metering(device, db)
