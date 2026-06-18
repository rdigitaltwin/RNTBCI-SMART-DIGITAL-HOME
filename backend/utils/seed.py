"""RNTBCI Smart Home Digital Twin - Database Seeder.

Creates a realistic smart home setup with:
- 3 users (admin, user, guest) with proper roles & permissions
- 7 rooms with 3D positions
- 22 devices across all 14 types
- 30 days of historical energy data
- 500+ historical events
- Sample alerts
"""

import asyncio
import logging
import math
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.jwt_handler import hash_password
from backend.database import async_session_factory, init_db
from backend.models import (
    Alert,
    AlertType,
    ConnectivityStatus,
    Device,
    DeviceEvent,
    DeviceState,
    DeviceStatus,
    DeviceType,
    EnergyHistory,
    EventSeverity,
    Notification,
    Permission,
    PowerState,
    Role,
    RoleName,
    Room,
    RoomType,
    User,
)

logger = logging.getLogger(__name__)


async def seed_database() -> None:
    """Execute full database seeding."""
    async with async_session_factory() as db:
        # Check if already seeded
        existing = await db.execute(select(Role))
        if existing.scalars().first():
            logger.info("Database already seeded, skipping")
            return

        logger.info("=== Seeding RNTBCI Database ===")

        # 1. Roles
        roles = await _seed_roles(db)
        logger.info("Seeded %d roles", len(roles))

        # 2. Permissions
        await _seed_permissions(db, roles)
        logger.info("Seeded permissions")

        # 3. Users
        users = await _seed_users(db, roles)
        logger.info("Seeded %d users", len(users))

        # 4. Rooms
        rooms = await _seed_rooms(db)
        logger.info("Seeded %d rooms", len(rooms))

        # 5. Devices
        devices = await _seed_devices(db, rooms)
        logger.info("Seeded %d devices", len(devices))

        # 6. Historical data
        await _seed_energy_history(db, devices)
        logger.info("Seeded energy history (30 days)")

        # 7. Events
        await _seed_events(db, devices)
        logger.info("Seeded events")

        # 8. Alerts
        await _seed_alerts(db, devices)
        logger.info("Seeded alerts")

        # 9. Notifications
        await _seed_notifications(db, users)
        logger.info("Seeded notifications")

        await db.commit()
        logger.info("=== Database seeding complete ===")


async def _seed_roles(db: AsyncSession) -> dict[str, Role]:
    roles = {}
    for role_name, desc in [
        (RoleName.ADMIN, "Full system access - manage devices, users, and settings"),
        (RoleName.USER, "Standard access - control assigned devices and view dashboards"),
        (RoleName.GUEST, "View-only access - no device control"),
    ]:
        role = Role(name=role_name, description=desc)
        db.add(role)
        roles[role_name.value] = role
    await db.flush()
    return roles


async def _seed_permissions(db: AsyncSession, roles: dict[str, Role]) -> None:
    # Admin: full access to everything
    admin_perms = [
        ("devices", "create"), ("devices", "read"), ("devices", "update"),
        ("devices", "delete"), ("devices", "control"),
        ("users", "create"), ("users", "read"), ("users", "update"), ("users", "delete"),
        ("dashboard", "read"), ("analytics", "read"),
        ("events", "read"), ("events", "export"),
        ("alerts", "read"), ("alerts", "manage"),
        ("settings", "read"), ("settings", "update"),
        ("scenarios", "create"), ("scenarios", "activate"), ("scenarios", "delete"),
        ("simulation", "control"), ("hems", "manage"),
    ]
    for resource, action in admin_perms:
        db.add(Permission(role_id=roles["admin"].id, resource=resource, action=action))

    # User: read + control assigned devices
    user_perms = [
        ("devices", "read"), ("devices", "control"),
        ("dashboard", "read"), ("analytics", "read"),
        ("events", "read"),
        ("alerts", "read"),
        ("settings", "read"),
        ("scenarios", "activate"),
        ("simulation", "control"),
    ]
    for resource, action in user_perms:
        db.add(Permission(role_id=roles["user"].id, resource=resource, action=action))

    # Guest: read only
    guest_perms = [
        ("devices", "read"),
        ("dashboard", "read"),
        ("analytics", "read"),
    ]
    for resource, action in guest_perms:
        db.add(Permission(role_id=roles["guest"].id, resource=resource, action=action))

    await db.flush()


async def _seed_users(db: AsyncSession, roles: dict[str, Role]) -> list[User]:
    users = []
    user_data = [
        ("admin@rntbci.io", "admin", "Arun", "Nair", "admin", "Admin@12345"),
        ("user@rntbci.io", "arunuser", "Priya", "Sharma", "user", "User@12345"),
        ("guest@rntbci.io", "guestview", "Raj", "Kumar", "guest", "Guest@12345"),
    ]
    for email, username, first, last, role_key, password in user_data:
        user = User(
            email=email,
            username=username,
            password_hash=hash_password(password),
            first_name=first,
            last_name=last,
            role_id=roles[role_key].id,
            is_active=True,
        )
        db.add(user)
        users.append(user)
    await db.flush()
    return users


async def _seed_rooms(db: AsyncSession) -> dict[str, Room]:
    rooms = {}
    room_data = [
        ("Living Room", RoomType.LIVING_ROOM, 0, 0.0, 0.0, 0.0, 6.0, 5.0, 3.0),
        ("Kitchen", RoomType.KITCHEN, 0, 6.5, 0.0, 0.0, 4.0, 4.0, 3.0),
        ("Master Bedroom", RoomType.MASTER_BEDROOM, 0, 0.0, 0.0, 5.5, 5.0, 4.5, 3.0),
        ("Bathroom", RoomType.BATHROOM, 0, 5.5, 0.0, 5.5, 3.0, 3.0, 3.0),
        ("Garage", RoomType.GARAGE, 0, -5.5, 0.0, 0.0, 5.0, 5.5, 3.5),
        ("Utility Room", RoomType.UTILITY_ROOM, 0, 6.5, 0.0, 4.5, 4.0, 3.0, 3.0),
        ("Hallway", RoomType.HALLWAY, 0, 3.0, 0.0, 2.5, 1.5, 6.0, 3.0),
    ]
    for name, rtype, floor, x, y, z, w, d, h in room_data:
        room = Room(
            name=name, type=rtype, floor=floor,
            position_x=x, position_y=y, position_z=z,
            width=w, depth=d, height=h,
            metadata={"color": "#1a1a2e", "opacity": 0.3},
        )
        db.add(room)
        rooms[rtype.value] = room
    await db.flush()
    return rooms


async def _seed_devices(db: AsyncSession, rooms: dict[str, Room]) -> list[Device]:
    devices = []
    device_configs = [
        # Living Room
        ("Living Room Main Light", DeviceType.SMART_LIGHT, "living_room", PowerState.ON, 0.012,
         {"brightness": 85, "rgb": {"r": 255, "g": 240, "b": 220}, "color_temperature": 4000}, 1.0, 2.8, 1.0),
        ("Living Room AC", DeviceType.HVAC, "living_room", PowerState.ON, 2.1,
         {"temperature": 23.5, "target_temperature": 22, "mode": "cooling", "fan_speed": "medium"}, 0.5, 2.5, 0.0),
        ("Smart TV 65\"", DeviceType.SMART_TV, "living_room", PowerState.ON, 0.12,
         {"volume": 35, "channel": 1, "input_source": "hdmi1"}, 3.0, 0.1, 1.2),
        ("Living Room Switch", DeviceType.SMART_SWITCH, "living_room", PowerState.ON, 0.001,
         {"state": "on"}, 0.0, 1.2, 5.0),

        # Kitchen
        ("Kitchen Light", DeviceType.SMART_LIGHT, "kitchen", PowerState.ON, 0.015,
         {"brightness": 100, "rgb": {"r": 255, "g": 255, "b": 255}, "color_temperature": 5500}, 7.5, 2.8, 1.5),
        ("Refrigerator", DeviceType.REFRIGERATOR, "kitchen", PowerState.ON, 0.08,
         {"temperature": 3.8, "door_state": "closed", "cooling_status": "active"}, 9.5, 0.3, 0.0),
        ("Dishwasher", DeviceType.DISHWASHER, "kitchen", PowerState.OFF, 0.0,
         {"wash_mode": "normal", "cycle": "idle"}, 8.0, 0.3, 0.0),

        # Master Bedroom
        ("Bedroom Light", DeviceType.SMART_LIGHT, "master_bedroom", PowerState.OFF, 0.0,
         {"brightness": 50, "rgb": {"r": 255, "g": 200, "b": 150}, "color_temperature": 3000}, 2.0, 2.8, 7.0),
        ("Bedroom AC", DeviceType.HVAC, "master_bedroom", PowerState.ON, 1.8,
         {"temperature": 21.0, "target_temperature": 21, "mode": "cooling", "fan_speed": "low"}, 0.5, 2.5, 5.5),
        ("Door Lock", DeviceType.DOOR_LOCK, "master_bedroom", PowerState.ON, 0.003,
         {"lock_state": "locked", "auto_lock": True, "auto_lock_delay": 30}, 0.0, 1.0, 5.5),

        # Bathroom
        ("Bathroom Light", DeviceType.SMART_LIGHT, "bathroom", PowerState.OFF, 0.0,
         {"brightness": 100, "rgb": {"r": 255, "g": 255, "b": 255}, "color_temperature": 5000}, 6.5, 2.8, 6.5),
        ("Water Heater", DeviceType.WATER_HEATER, "bathroom", PowerState.ON, 1.2,
         {"temperature": 48, "target_temperature": 50}, 7.5, 0.5, 5.5),
        ("Nebulizer", DeviceType.NEBULIZER, "bathroom", PowerState.OFF, 0.0,
         {"intensity": 50, "duration": 0, "running": False}, 6.0, 1.0, 7.0),

        # Garage
        ("Garage Door", DeviceType.GARAGE_DOOR, "garage", PowerState.ON, 0.005,
         {"position": "closed"}, -5.5, 0.0, 2.5),
        ("Garage Light", DeviceType.SMART_LIGHT, "garage", PowerState.OFF, 0.0,
         {"brightness": 100, "rgb": {"r": 255, "g": 255, "b": 255}, "color_temperature": 6000}, -5.5, 2.8, 0.0),
        ("Security Camera", DeviceType.CAMERA, "garage", PowerState.ON, 0.015,
         {"recording": True, "motion_detection": True, "night_vision": False}, -3.0, 2.5, 0.0),

        # Utility Room
        ("Washing Machine", DeviceType.WASHING_MACHINE, "utility_room", PowerState.OFF, 0.0,
         {"wash_mode": "normal", "spin_speed": 1000, "remaining_time": 0, "running": False}, 7.5, 0.5, 5.0),
        ("Smart Plug - Dryer", DeviceType.SMART_PLUG, "utility_room", PowerState.ON, 0.8,
         {"voltage": 220, "current": 3.6, "energy_usage": 0.8}, 7.5, 0.5, 4.0),
        ("Utility Light", DeviceType.SMART_LIGHT, "utility_room", PowerState.ON, 0.01,
         {"brightness": 60, "rgb": {"r": 255, "g": 255, "b": 255}, "color_temperature": 4500}, 8.0, 2.8, 5.5),

        # Hallway
        ("Hallway Light", DeviceType.SMART_LIGHT, "hallway", PowerState.ON, 0.008,
         {"brightness": 40, "rgb": {"r": 200, "g": 200, "b": 255}, "color_temperature": 4000}, 3.0, 2.8, 4.0),
        ("WiFi Router", DeviceType.ROUTER, "hallway", PowerState.ON, 0.012,
         {"upload_speed": 45, "download_speed": 95, "internet_status": "connected", "connected_clients": 8}, 3.5, 2.0, 2.5),
        ("Front Door Lock", DeviceType.DOOR_LOCK, "hallway", PowerState.ON, 0.003,
         {"lock_state": "locked", "auto_lock": True, "auto_lock_delay": 60}, 3.0, 1.0, 0.0),
    ]

    for name, dtype, room_key, pstate, energy, meta, px, py, pz in device_configs:
        room = rooms[room_key]
        device = Device(
            name=name,
            type=dtype,
            room_id=room.id,
            status=DeviceStatus.ONLINE,
            power_state=pstate,
            connectivity=ConnectivityStatus.CONNECTED,
            energy_usage_kw=energy,
            efficiency_percent=round(85 + random.random() * 15, 1),
            metadata=meta,
            position_x=px, position_y=py, position_z=pz,
        )
        db.add(device)
        devices.append(device)

    await db.flush()
    return devices


async def _seed_energy_history(db: AsyncSession, devices: list[Device]) -> None:
    """Generate 30 days of realistic energy history."""
    now = datetime.now(timezone.utc)
    records = []

    for device in devices:
        dtype = device.type if isinstance(device.type, DeviceType) else DeviceType(device.type)
        base_power = device.energy_usage_kw if device.energy_usage_kw > 0 else 0.01

        # Generate data points every 15 minutes for 30 days = 2880 points per device
        for day_offset in range(30, 0, -1):
            for hour in range(0, 24):
                for minute in [0, 15, 30, 45]:
                    timestamp = now - timedelta(days=day_offset, hours=24 - hour, minutes=60 - minute)

                    # Time-of-day power curve
                    time_factor = 0.3 + 0.7 * math.sin((hour - 6) * math.pi / 12)

                    # Weekend boost
                    is_weekend = timestamp.weekday() >= 5
                    weekend_factor = 1.15 if is_weekend else 1.0

                    # Device-specific patterns
                    if dtype == DeviceType.HVAC:
                        # AC peaks in afternoon
                        hvac_factor = 0.5 + 0.5 * math.sin((hour - 14) * math.pi / 10)
                        power = base_power * hvac_factor * weekend_factor
                    elif dtype == DeviceType.REFRIGERATOR:
                        # Constant with compressor cycles
                        cycle_factor = 0.4 + 0.6 * (math.sin(hour * math.pi / 3) > 0)
                        power = base_power * cycle_factor
                    elif dtype == DeviceType.SMART_LIGHT:
                        # Off during day
                        if 8 <= hour <= 17:
                            power = 0.001
                        else:
                            power = base_power * (0.5 + 0.5 * time_factor)
                    elif dtype == DeviceType.SMART_TV:
                        # Evening usage
                        if 18 <= hour <= 23:
                            power = base_power * weekend_factor
                        else:
                            power = 0.001
                    else:
                        power = base_power * time_factor * weekend_factor

                    power += random.gauss(0, power * 0.1)
                    power = max(0, power)

                    voltage = 220 + random.gauss(0, 2)
                    current = (power * 1000) / voltage if voltage > 0 else 0
                    cost = power * 0.25 * 0.12  # 15 min = 0.25 hr

                    records.append(EnergyHistory(
                        device_id=device.id,
                        power_kw=round(power, 4),
                        voltage=round(voltage, 1),
                        current_amps=round(current, 3),
                        cost_usd=round(cost, 6),
                        timestamp=timestamp,
                    ))

        # Batch insert for performance
        if len(records) >= 5000:
            db.add_all(records)
            await db.flush()
            records = []

    if records:
        db.add_all(records)
        await db.flush()


async def _seed_events(db: AsyncSession, devices: list[Device]) -> None:
    """Generate realistic historical events."""
    now = datetime.now(timezone.utc)
    events = []

    event_templates = [
        ("power_toggle", EventSeverity.INFO, "{name}: OFF → ON"),
        ("power_toggle", EventSeverity.INFO, "{name}: ON → OFF"),
        ("state_change", EventSeverity.INFO, "{name}: state updated"),
        ("temperature_reached", EventSeverity.INFO, "{name}: target temperature reached"),
        ("filter_check", EventSeverity.WARNING, "{name}: maintenance recommended"),
        ("motion_detected", EventSeverity.INFO, "{name}: motion detected"),
        ("door_opened", EventSeverity.INFO, "{name}: door opened"),
        ("connectivity_restored", EventSeverity.INFO, "{name}: connectivity restored"),
        ("energy_spike", EventSeverity.WARNING, "{name}: unusual energy consumption"),
        ("firmware_update", EventSeverity.INFO, "{name}: firmware updated to latest version"),
    ]

    for device in devices:
        # 15-50 events per device over 30 days
        num_events = random.randint(15, 50)
        for _ in range(num_events):
            template = random.choice(event_templates)
            timestamp = now - timedelta(
                days=random.randint(0, 30),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
            )
            events.append(DeviceEvent(
                device_id=device.id,
                event_type=template[0],
                severity=template[1],
                message=template[2].format(name=device.name),
                metadata={"automated": True, "seeded": True},
                timestamp=timestamp,
            ))

    db.add_all(events)
    await db.flush()


async def _seed_alerts(db: AsyncSession, devices: list[Device]) -> None:
    """Generate sample alerts."""
    now = datetime.now(timezone.utc)
    alerts = []

    alert_templates = [
        (AlertType.TEMPERATURE_HIGH, EventSeverity.WARNING, "Temperature exceeding threshold"),
        (AlertType.DOOR_LEFT_OPEN, EventSeverity.WARNING, "Door left open for extended period"),
        (AlertType.ENERGY_SPIKE, EventSeverity.WARNING, "Unusual energy consumption detected"),
        (AlertType.INTERNET_DISCONNECTED, EventSeverity.ERROR, "Internet connectivity lost"),
        (AlertType.MOTION_DETECTED, EventSeverity.INFO, "Motion detected in secured area"),
    ]

    for i, template in enumerate(alert_templates):
        device = random.choice(devices)
        alerts.append(Alert(
            device_id=device.id,
            type=template[0],
            severity=template[1],
            message=f"{device.name}: {template[2]}",
            acknowledged=i >= 3,  # First 3 unacknowledged
            metadata={"seeded": True},
            timestamp=now - timedelta(hours=random.randint(1, 48)),
        ))

    db.add_all(alerts)
    await db.flush()


async def _seed_notifications(db: AsyncSession, users: list[User]) -> None:
    """Generate sample notifications."""
    now = datetime.now(timezone.utc)
    notifications = []

    notif_templates = [
        ("System Update", "RNTBCI firmware updated to v2.1.0"),
        ("Energy Report", "Daily energy consumption: 18.4 kWh ($2.21)"),
        ("Security Alert", "Front door lock auto-engaged"),
        ("Maintenance Due", "HVAC filter replacement recommended"),
        ("Welcome", "Welcome to RNTBCI Smart Home Digital Twin"),
    ]

    for user in users:
        for i, (title, body) in enumerate(notif_templates):
            notifications.append(Notification(
                user_id=user.id,
                title=title,
                body=body,
                read=i >= 2,
                timestamp=now - timedelta(hours=i * 12),
            ))

    db.add_all(notifications)
    await db.flush()


# CLI entry point
if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent.parent.parent))

    async def main():
        await init_db()
        await seed_database()

    asyncio.run(main())
