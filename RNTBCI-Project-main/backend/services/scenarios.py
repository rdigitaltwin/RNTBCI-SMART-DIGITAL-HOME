"""RNTBCI Smart Home Digital Twin - Scenario Manager.

Manages predefined and custom automation scenarios like Morning Routine,
Night Routine, Vacation Mode, Emergency Mode, etc.
"""

from __future__ import annotations
import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import async_session_factory
from backend.models import Device, DeviceEvent, DeviceType, EventSeverity, PowerState
from backend.redis.client import redis_client

logger = logging.getLogger(__name__)


# =============================================================================
# SCENARIO DEFINITIONS
# =============================================================================

BUILT_IN_SCENARIOS: dict[str, dict[str, Any]] = {
    "morning_routine": {
        "name": "Morning Routine",
        "description": "Prepare the home for the day ahead",
        "icon": "sunrise",
        "trigger": "schedule",
        "trigger_time": "07:00",
        "rules": [
            {"device_type": "smart_light", "rooms": ["master_bedroom", "kitchen", "bathroom"],
             "action": "power_on", "params": {"brightness": 80, "color_temperature": 5000}},
            {"device_type": "hvac", "rooms": ["*"],
             "action": "set_mode", "params": {"mode": "cooling", "target_temperature": 23, "fan_speed": "auto"}},

            {"device_type": "water_heater", "rooms": ["*"],
             "action": "set_temperature", "params": {"target_temperature": 55}},
            {"device_type": "camera", "rooms": ["*"],
             "action": "set_mode", "params": {"recording": True, "motion_detection": True}},
        ],
    },
    "night_routine": {
        "name": "Night Routine",
        "description": "Secure the home and prepare for sleep",
        "icon": "moon",
        "trigger": "schedule",
        "trigger_time": "22:00",
        "rules": [
            {"device_type": "smart_light", "rooms": ["*"],
             "action": "power_off", "params": {}},
            {"device_type": "smart_light", "rooms": ["hallway"],
             "action": "power_on", "params": {"brightness": 10, "rgb": {"r": 255, "g": 150, "b": 50}}},
            {"device_type": "door_lock", "rooms": ["*"],
             "action": "lock", "params": {"auto_lock": True}},

            {"device_type": "hvac", "rooms": ["master_bedroom"],
             "action": "set_mode", "params": {"mode": "cooling", "target_temperature": 21, "fan_speed": "low"}},

            {"device_type": "camera", "rooms": ["*"],
             "action": "set_mode", "params": {"recording": True, "night_vision": True}},
        ],
    },
    "vacation_mode": {
        "name": "Vacation Mode",
        "description": "Simulate occupancy and minimize energy while away",
        "icon": "plane",
        "trigger": "manual",
        "rules": [
            {"device_type": "smart_light", "rooms": ["living_room", "master_bedroom"],
             "action": "random_toggle", "params": {"interval_min": 1800, "interval_max": 7200}},
            {"device_type": "door_lock", "rooms": ["*"],
             "action": "lock", "params": {"auto_lock": True}},

            {"device_type": "camera", "rooms": ["*"],
             "action": "set_mode", "params": {"recording": True, "motion_detection": True}},
            {"device_type": "hvac", "rooms": ["*"],
             "action": "set_mode", "params": {"mode": "cooling", "target_temperature": 28, "fan_speed": "low"}},

            {"device_type": "water_heater", "rooms": ["*"],
             "action": "power_off", "params": {}},
        ],
    },
    "emergency_mode": {
        "name": "Emergency Mode",
        "description": "Maximum security and visibility during emergencies",
        "icon": "alert-triangle",
        "trigger": "manual",
        "rules": [
            {"device_type": "smart_light", "rooms": ["*"],
             "action": "power_on", "params": {"brightness": 100, "rgb": {"r": 255, "g": 0, "b": 0}}},
            {"device_type": "door_lock", "rooms": ["*"],
             "action": "unlock", "params": {}},

            {"device_type": "camera", "rooms": ["*"],
             "action": "set_mode", "params": {"recording": True, "motion_detection": True}},

        ],
    },
    "energy_saver": {
        "name": "Energy Saver",
        "description": "Minimize energy consumption across all devices",
        "icon": "battery",
        "trigger": "manual",
        "rules": [
            {"device_type": "smart_light", "rooms": ["*"],
             "action": "set_brightness", "params": {"brightness": 30}},
            {"device_type": "hvac", "rooms": ["*"],
             "action": "set_mode", "params": {"mode": "fan_only", "fan_speed": "low"}},
            {"device_type": "water_heater", "rooms": ["*"],
             "action": "set_temperature", "params": {"target_temperature": 40}},

        ],
    },
    "movie_night": {
        "name": "Movie Night",
        "description": "Set the perfect ambiance for watching movies",
        "icon": "film",
        "trigger": "manual",
        "rules": [
            {"device_type": "smart_light", "rooms": ["living_room"],
             "action": "power_on", "params": {"brightness": 10, "rgb": {"r": 30, "g": 0, "b": 80}}},
            {"device_type": "smart_light", "rooms": ["kitchen", "hallway", "master_bedroom", "bathroom"],
             "action": "power_off", "params": {}},

            {"device_type": "hvac", "rooms": ["living_room"],
             "action": "set_mode", "params": {"target_temperature": 22, "fan_speed": "low"}},
        ],
    },
    "normal": {
        "name": "Normal",
        "description": "Standard household operation",
        "icon": "home",
        "trigger": "manual",
        "rules": [
            {"device_type": "energy_evse", "rooms": ["*"], "action": "set_mode", "params": {"mode": "cc_charging"}},
            {"device_type": "battery_storage", "rooms": ["*"], "action": "set_mode", "params": {"mode": "auto"}},
        ],
    },
    "solar_priority": {
        "name": "Solar Priority",
        "description": "Maximize solar self-consumption, limit grid draw",
        "icon": "sun",
        "trigger": "manual",
        "rules": [
            {"device_type": "energy_evse", "rooms": ["*"], "action": "set_mode", "params": {"mode": "solar_charge"}},
            {"device_type": "battery_storage", "rooms": ["*"], "action": "set_mode", "params": {"mode": "charge_from_solar"}},
            {"device_type": "hvac", "rooms": ["*"], "action": "set_mode", "params": {"mode": "eco"}},
        ],
    },
    "backup": {
        "name": "Backup",
        "description": "Discharge EV and Battery to power the home during outages",
        "icon": "battery-charging",
        "trigger": "manual",
        "rules": [
            {"device_type": "energy_evse", "rooms": ["*"], "action": "set_mode", "params": {"mode": "backup"}},
            {"device_type": "battery_storage", "rooms": ["*"], "action": "set_mode", "params": {"mode": "backup"}},
            {"device_type": "hvac", "rooms": ["*"], "action": "set_mode", "params": {"mode": "eco"}},
        ],
    },
}


class ScenarioManager:
    """Manages and executes home automation scenarios."""

    def __init__(self) -> None:
        self._active_scenarios: dict[str, dict] = {}
        self._custom_scenarios: dict[str, dict] = {}
        self._vacation_task: asyncio.Task | None = None

    @property
    def available_scenarios(self) -> list[dict]:
        """Get all available scenarios (built-in + custom)."""
        scenarios = []
        for key, scenario in BUILT_IN_SCENARIOS.items():
            scenarios.append({
                "id": key,
                "name": scenario["name"],
                "description": scenario["description"],
                "icon": scenario["icon"],
                "trigger": scenario["trigger"],
                "active": key in self._active_scenarios,
                "built_in": True,
            })
        for key, scenario in self._custom_scenarios.items():
            scenarios.append({
                "id": key,
                "name": scenario["name"],
                "description": scenario.get("description", ""),
                "icon": scenario.get("icon", "settings"),
                "trigger": scenario.get("trigger", "manual"),
                "active": key in self._active_scenarios,
                "built_in": False,
            })
        return scenarios

    def create_scenario(self, scenario_id: str, scenario: dict) -> dict:
        """Create a custom scenario."""
        self._custom_scenarios[scenario_id] = scenario
        return {"id": scenario_id, **scenario}

    def delete_scenario(self, scenario_id: str) -> bool:
        """Delete a custom scenario."""
        if scenario_id in self._custom_scenarios:
            del self._custom_scenarios[scenario_id]
            self._active_scenarios.pop(scenario_id, None)
            return True
        return False

    async def activate(self, scenario_id: str) -> dict:
        """Activate a scenario and apply its rules."""
        scenario = BUILT_IN_SCENARIOS.get(scenario_id) or self._custom_scenarios.get(scenario_id)
        if not scenario:
            raise ValueError(f"Scenario not found: {scenario_id}")

        self._active_scenarios[scenario_id] = scenario
        applied = await self._apply_rules(scenario["rules"])

        # Publish activation event
        await redis_client.publish_event({
            "event_type": "scenario_activated",
            "severity": "info",
            "message": f"Scenario '{scenario['name']}' activated - {applied} devices affected",
            "device_id": "",
            "device_name": "System",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Start vacation light randomizer if needed
        if scenario_id == "vacation_mode":
            if self._vacation_task:
                self._vacation_task.cancel()
            self._vacation_task = asyncio.create_task(self._vacation_light_loop())

        logger.info("Scenario '%s' activated (%d devices)", scenario["name"], applied)
        return {"scenario": scenario_id, "devices_affected": applied}

    async def deactivate(self, scenario_id: str) -> dict:
        """Deactivate a scenario."""
        if scenario_id not in self._active_scenarios:
            return {"scenario": scenario_id, "status": "not_active"}

        scenario = self._active_scenarios.pop(scenario_id)

        if scenario_id == "vacation_mode" and self._vacation_task:
            self._vacation_task.cancel()
            self._vacation_task = None

        await redis_client.publish_event({
            "event_type": "scenario_deactivated",
            "severity": "info",
            "message": f"Scenario '{scenario['name']}' deactivated",
            "device_id": "",
            "device_name": "System",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        logger.info("Scenario '%s' deactivated", scenario["name"])
        return {"scenario": scenario_id, "status": "deactivated"}

    async def _apply_rules(self, rules: list[dict]) -> int:
        """Apply scenario rules to devices."""
        affected = 0
        async with async_session_factory() as db:
            try:
                result = await db.execute(select(Device))
                devices = result.scalars().all()

                for rule in rules:
                    target_type = rule.get("device_type")
                    target_rooms = rule.get("rooms", ["*"])
                    action = rule.get("action", "")
                    params = rule.get("params", {})

                    for device in devices:
                        dtype = device.type.value if hasattr(device.type, "value") else device.type
                        if dtype != target_type:
                            continue

                        # Room matching - load room data
                        if "*" not in target_rooms:
                            from backend.models import Room
                            room_result = await db.execute(
                                select(Room).where(Room.id == device.room_id)
                            )
                            room = room_result.scalar_one_or_none()
                            if room:
                                room_type = room.type.value if hasattr(room.type, "value") else room.type
                                if room_type not in target_rooms:
                                    continue

                        # Apply action
                        if action in ("power_on", "set_mode", "set_brightness", "set_temperature", "lock", "open", "random_toggle"):
                            device.power_state = PowerState.ON
                        elif action in ("power_off", "close"):
                            device.power_state = PowerState.OFF

                        if action == "lock":
                            device.power_state = PowerState.ON

                        # Update metadata
                        metadata = dict(device.extra_data or {})
                        metadata.update(params)
                        device.extra_data = metadata
                        device.last_updated = datetime.now(timezone.utc)
                        affected += 1

                        # Log event
                        event = DeviceEvent(
                            device_id=device.id,
                            event_type="scenario_action",
                            severity=EventSeverity.INFO,
                            message=f"Scenario applied: {action} on {device.name}",
                            metadata={"action": action, "params": params},
                        )
                        db.add(event)

                await db.commit()
            except Exception as e:
                await db.rollback()
                logger.error("Scenario apply error: %s", str(e))

        return affected

    async def _vacation_light_loop(self) -> None:
        """Randomly toggle lights during vacation mode to simulate occupancy."""
        import random as rng

        while True:
            try:
                wait_time = rng.randint(1800, 7200)  # 30 min to 2 hours
                await asyncio.sleep(wait_time)

                async with async_session_factory() as db:
                    result = await db.execute(
                        select(Device).where(Device.type == DeviceType.SMART_LIGHT)
                    )
                    lights = result.scalars().all()

                    if lights:
                        light = rng.choice(lights)
                        new_state = PowerState.ON if light.power_state == PowerState.OFF else PowerState.OFF
                        light.power_state = new_state
                        light.last_updated = datetime.now(timezone.utc)

                        event = DeviceEvent(
                            device_id=light.id,
                            event_type="vacation_toggle",
                            severity=EventSeverity.INFO,
                            message=f"Vacation mode: {light.name} toggled {new_state.value}",
                        )
                        db.add(event)
                        await db.commit()

                        await redis_client.publish_device_update(str(light.id), {
                            "action": "vacation_toggle",
                            "device_id": str(light.id),
                            "power_state": new_state.value,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        })

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Vacation loop error: %s", str(e))
                await asyncio.sleep(60)


# Singleton
scenario_manager = ScenarioManager()
