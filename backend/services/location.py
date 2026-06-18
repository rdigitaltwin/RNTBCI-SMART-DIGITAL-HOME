"""RNTBCI Smart Home Digital Twin - Location-Based Automation Engine.

Geofencing, ETA prediction, and location-triggered home automation.
"""

import asyncio
import logging
import math
from datetime import datetime, timezone
from typing import Any

from backend.redis.client import redis_client
from backend.services.scenarios import scenario_manager

logger = logging.getLogger(__name__)


class UserLocation:
    """Represents a user's current location and movement."""

    def __init__(self, user_id: str, name: str) -> None:
        self.user_id = user_id
        self.name = name
        self.latitude: float = 0.0
        self.longitude: float = 0.0
        self.speed_kmh: float = 0.0
        self.heading: float = 0.0
        self.last_update: datetime = datetime.now(timezone.utc)
        self.is_moving: bool = False
        self.is_home: bool = True

    @property
    def eta_minutes(self) -> float | None:
        """Calculate ETA to home in minutes based on distance and speed."""
        if self.is_home or self.speed_kmh < 1:
            return 0 if self.is_home else None
        distance_km = self._distance_to_home()
        if distance_km < 0.05:
            return 0
        return (distance_km / self.speed_kmh) * 60

    def _distance_to_home(self) -> float:
        """Calculate distance to home using Haversine formula."""
        # Default home location (configurable)
        home_lat, home_lon = 28.6139, 77.2090  # New Delhi default
        R = 6371  # Earth's radius in km

        lat1, lat2 = math.radians(self.latitude), math.radians(home_lat)
        dlat = math.radians(home_lat - self.latitude)
        dlon = math.radians(home_lon - self.longitude)

        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "name": self.name,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "speed_kmh": self.speed_kmh,
            "heading": self.heading,
            "is_moving": self.is_moving,
            "is_home": self.is_home,
            "eta_minutes": self.eta_minutes,
            "distance_km": round(self._distance_to_home(), 2),
            "last_update": self.last_update.isoformat(),
        }


# Automation rule triggers
ARRIVAL_RULES: list[dict[str, Any]] = [
    {
        "trigger": "10_min_before",
        "eta_threshold": 10,
        "actions": [
            {"device_type": "hvac", "command": "power_on", "params": {"target_temperature": 23}},
            {"device_type": "water_heater", "command": "boost", "params": {"target_temperature": 60}},
        ],
        "description": "Pre-cool/heat home and boost water heater",
    },
    {
        "trigger": "5_min_before",
        "eta_threshold": 5,
        "actions": [
            {"device_type": "smart_light", "rooms": ["hallway", "living_room"],
             "command": "power_on", "params": {"brightness": 80}},
        ],
        "description": "Turn on entry and living room lights",
    },
    {
        "trigger": "arrival",
        "eta_threshold": 0.5,
        "actions": [
            {"device_type": "garage_door", "command": "open", "params": {}},
            {"device_type": "door_lock", "command": "unlock", "params": {}},
            {"device_type": "camera", "command": "set_mode", "params": {"recording": True}},
            {"device_type": "smart_tv", "rooms": ["living_room"],
             "command": "power_on", "params": {"volume": 20}},
        ],
        "description": "Open garage, unlock door, activate cameras, start media",
    },
]

DEPARTURE_RULES: list[dict[str, Any]] = [
    {
        "trigger": "departure",
        "actions": [
            {"device_type": "door_lock", "command": "lock", "params": {"auto_lock": True}},
            {"device_type": "garage_door", "command": "close", "params": {}},
            {"device_type": "smart_light", "rooms": ["*"], "command": "power_off", "params": {}},
            {"device_type": "hvac", "command": "set_mode", "params": {"mode": "eco", "target_temperature": 28}},
            {"device_type": "camera", "command": "set_mode", "params": {"recording": True, "motion_detection": True}},
        ],
        "description": "Secure home on departure",
    },
]


class LocationAutomationEngine:
    """Manages location-based home automation with geofencing and ETA prediction."""

    def __init__(self) -> None:
        self._users: dict[str, UserLocation] = {}
        self._triggered_rules: dict[str, set[str]] = {}  # user_id -> set of triggered rule IDs
        self._geofence_radius_km: float = 0.1  # 100m home radius
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        """Start the location monitoring loop."""
        self._running = True
        self._task = asyncio.create_task(self._monitor_loop())
        logger.info("Location automation engine started")

    async def stop(self) -> None:
        """Stop the location monitoring loop."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    def update_location(self, user_id: str, name: str, lat: float, lon: float, speed: float = 0) -> dict:
        """Update a user's location."""
        if user_id not in self._users:
            self._users[user_id] = UserLocation(user_id, name)
            self._triggered_rules[user_id] = set()

        user = self._users[user_id]
        was_home = user.is_home

        user.latitude = lat
        user.longitude = lon
        user.speed_kmh = speed
        user.is_moving = speed > 2
        user.is_home = user._distance_to_home() < self._geofence_radius_km
        user.last_update = datetime.now(timezone.utc)

        # Detect arrival/departure transitions
        result = user.to_dict()
        if not was_home and user.is_home:
            result["transition"] = "arrived"
        elif was_home and not user.is_home:
            result["transition"] = "departed"
        else:
            result["transition"] = None

        return result

    @property
    def all_users(self) -> list[dict]:
        """Get all tracked users."""
        return [u.to_dict() for u in self._users.values()]

    async def _monitor_loop(self) -> None:
        """Monitor user locations and trigger automation rules."""
        while self._running:
            try:
                for user_id, user in self._users.items():
                    if not user.is_moving and not user.is_home:
                        continue

                    eta = user.eta_minutes
                    triggered = self._triggered_rules.get(user_id, set())

                    # Check arrival rules
                    if not user.is_home and eta is not None:
                        for rule in ARRIVAL_RULES:
                            rule_id = rule["trigger"]
                            if rule_id not in triggered and eta <= rule["eta_threshold"]:
                                await self._execute_rule(rule, user)
                                triggered.add(rule_id)

                    # Check if arrived
                    if user.is_home and "arrival" not in triggered:
                        for rule in ARRIVAL_RULES:
                            if rule["trigger"] == "arrival" and "arrival" not in triggered:
                                await self._execute_rule(rule, user)
                                triggered.add("arrival")

                    # Reset triggers when user leaves
                    if not user.is_home and user.is_moving:
                        if "departure" not in triggered:
                            for rule in DEPARTURE_RULES:
                                await self._execute_rule(rule, user)
                            triggered.add("departure")
                    elif user.is_home:
                        # Clear departure trigger when home
                        triggered.discard("departure")

                    self._triggered_rules[user_id] = triggered

                # Publish location data
                await redis_client.publish("system:locations", {
                    "users": self.all_users,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

                await asyncio.sleep(5)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Location monitor error: %s", str(e))
                await asyncio.sleep(10)

    async def _execute_rule(self, rule: dict, user: UserLocation) -> None:
        """Execute a location-based automation rule."""
        logger.info("Location rule triggered: %s for user %s", rule["trigger"], user.name)

        await redis_client.publish_event({
            "event_type": "location_automation",
            "severity": "info",
            "message": f"Location rule '{rule['trigger']}' triggered for {user.name}: {rule['description']}",
            "device_id": "",
            "device_name": "Location Engine",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "user": user.name,
                "eta_minutes": user.eta_minutes,
                "distance_km": round(user._distance_to_home(), 2),
            },
        })


# Singleton
location_engine = LocationAutomationEngine()
