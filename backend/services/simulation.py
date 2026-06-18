"""RNTBCI Smart Home Digital Twin - Advanced Simulation Engine.

Enterprise-grade device simulation with realistic load profiles,
state machines, scenario management, and historical replay.
Runs at 1-second intervals with physically accurate power curves.
"""

import asyncio
import logging
import math
import random
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import async_session_factory
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
    PowerState,
)
from backend.redis.client import redis_client

logger = logging.getLogger(__name__)
settings = get_settings()


# =============================================================================
# DEVICE STATE MACHINES
# =============================================================================


class RefrigeratorState(str, Enum):
    IDLE = "idle"
    COMPRESSOR_ON = "compressor_on"
    COOLING = "cooling"
    COMPRESSOR_OFF = "compressor_off"


class WashingMachineState(str, Enum):
    IDLE = "idle"
    PRE_WASH = "pre_wash"
    WASH = "wash"
    SPIN = "spin"
    DRAIN = "drain"
    COMPLETE = "complete"


class DishwasherState(str, Enum):
    IDLE = "idle"
    PREWASH = "prewash"
    WASH = "wash"
    DRY = "dry"
    COMPLETE = "complete"


class HVACState(str, Enum):
    IDLE = "idle"
    COOLING = "cooling"
    HEATING = "heating"
    FAN_ONLY = "fan_only"
    DEFROST = "defrost"


# =============================================================================
# LOAD PROFILE DEFINITIONS (Watts)
# =============================================================================


LOAD_PROFILES = {
    DeviceType.REFRIGERATOR: {
        RefrigeratorState.IDLE: {"power_w": 40, "duration_s": (300, 600), "noise": 5},
        RefrigeratorState.COMPRESSOR_ON: {"power_w": 180, "duration_s": (30, 60), "noise": 15},
        RefrigeratorState.COOLING: {"power_w": 80, "duration_s": (120, 300), "noise": 10},
        RefrigeratorState.COMPRESSOR_OFF: {"power_w": 40, "duration_s": (60, 120), "noise": 5},
        "cycle": [RefrigeratorState.IDLE, RefrigeratorState.COMPRESSOR_ON,
                  RefrigeratorState.COOLING, RefrigeratorState.COMPRESSOR_OFF],
    },
    DeviceType.WASHING_MACHINE: {
        WashingMachineState.IDLE: {"power_w": 5, "duration_s": (0, 0), "noise": 1},
        WashingMachineState.PRE_WASH: {"power_w": 200, "duration_s": (120, 180), "noise": 20},
        WashingMachineState.WASH: {"power_w": 500, "duration_s": (600, 1200), "noise": 50},
        WashingMachineState.SPIN: {"power_w": 800, "duration_s": (300, 600), "noise": 80},
        WashingMachineState.DRAIN: {"power_w": 150, "duration_s": (120, 180), "noise": 15},
        WashingMachineState.COMPLETE: {"power_w": 2, "duration_s": (0, 0), "noise": 0},
        "cycle": [WashingMachineState.PRE_WASH, WashingMachineState.WASH,
                  WashingMachineState.SPIN, WashingMachineState.DRAIN, WashingMachineState.COMPLETE],
    },
    DeviceType.DISHWASHER: {
        DishwasherState.IDLE: {"power_w": 3, "duration_s": (0, 0), "noise": 1},
        DishwasherState.PREWASH: {"power_w": 100, "duration_s": (180, 300), "noise": 10},
        DishwasherState.WASH: {"power_w": 1800, "duration_s": (1200, 1800), "noise": 100},
        DishwasherState.DRY: {"power_w": 600, "duration_s": (600, 900), "noise": 50},
        DishwasherState.COMPLETE: {"power_w": 2, "duration_s": (0, 0), "noise": 0},
        "cycle": [DishwasherState.PREWASH, DishwasherState.WASH,
                  DishwasherState.DRY, DishwasherState.COMPLETE],
    },
    DeviceType.HVAC: {
        HVACState.IDLE: {"power_w": 50, "duration_s": (120, 300), "noise": 5},
        HVACState.COOLING: {"power_w": 2500, "duration_s": (300, 900), "noise": 200},
        HVACState.HEATING: {"power_w": 3000, "duration_s": (300, 900), "noise": 250},
        HVACState.FAN_ONLY: {"power_w": 150, "duration_s": (180, 600), "noise": 15},
        HVACState.DEFROST: {"power_w": 1800, "duration_s": (120, 300), "noise": 100},
    },
    DeviceType.SMART_LIGHT: {
        "on": {"power_w": 12, "noise": 1},
        "dimmed": {"power_w": 5, "noise": 0.5},
        "off": {"power_w": 0.5, "noise": 0.1},
    },
    DeviceType.SMART_SWITCH: {
        "on": {"power_w": 1.5, "noise": 0.1},
        "off": {"power_w": 0.5, "noise": 0.05},
    },
    DeviceType.SMART_PLUG: {
        "on": {"power_w": 800, "noise": 80},  # depends on connected device
        "off": {"power_w": 0.5, "noise": 0.1},
    },
    DeviceType.DOOR_LOCK: {
        "locked": {"power_w": 2, "noise": 0.2},
        "unlocking": {"power_w": 8, "noise": 1},
        "unlocked": {"power_w": 3, "noise": 0.3},
    },
    DeviceType.GARAGE_DOOR: {
        "closed": {"power_w": 3, "noise": 0.3},
        "opening": {"power_w": 450, "noise": 30},
        "open": {"power_w": 5, "noise": 0.5},
        "closing": {"power_w": 450, "noise": 30},
    },
    DeviceType.WATER_HEATER: {
        "idle": {"power_w": 30, "noise": 3},
        "heating": {"power_w": 4500, "noise": 200},
        "maintaining": {"power_w": 800, "noise": 80},
    },
    DeviceType.NEBULIZER: {
        "off": {"power_w": 0.5, "noise": 0.05},
        "low": {"power_w": 25, "noise": 2},
        "medium": {"power_w": 40, "noise": 4},
        "high": {"power_w": 55, "noise": 5},
    },
    DeviceType.ROUTER: {
        "active": {"power_w": 12, "noise": 1.5},
        "idle": {"power_w": 8, "noise": 0.8},
    },
    DeviceType.CAMERA: {
        "recording": {"power_w": 15, "noise": 1.5},
        "standby": {"power_w": 5, "noise": 0.5},
        "night_vision": {"power_w": 18, "noise": 2},
    },
    DeviceType.SMART_TV: {
        "on": {"power_w": 120, "noise": 10},
        "standby": {"power_w": 1, "noise": 0.1},
        "off": {"power_w": 0.3, "noise": 0.02},
    },
}


# =============================================================================
# DEVICE STATE TRACKER
# =============================================================================


class DeviceStateTracker:
    """Tracks the internal state machine for a single device."""

    def __init__(self, device_id: str, device_type: DeviceType) -> None:
        self.device_id = device_id
        self.device_type = device_type
        self.current_state: str = "idle"
        self.state_timer: float = 0
        self.state_duration: float = 0
        self.cycle_index: int = 0
        self.running_cycle: bool = False
        self.metadata: dict[str, Any] = {}

    def get_power_watts(self) -> float:
        """Calculate current power consumption in watts with realistic noise."""
        profile = LOAD_PROFILES.get(self.device_type, {})
        state_profile = profile.get(self.current_state, {})

        if not state_profile or isinstance(state_profile, list):
            return 0.0

        base_power = state_profile.get("power_w", 0)
        noise = state_profile.get("noise", 0)

        power = base_power + random.gauss(0, noise)
        return max(0, power)

    def tick(self, elapsed_s: float = 1.0) -> dict[str, Any]:
        """Advance the state machine by elapsed_s seconds.

        Returns dict with state change info if state changed.
        """
        result = {"changed": False}

        if not self.running_cycle:
            return result

        self.state_timer += elapsed_s

        if self.state_timer >= self.state_duration:
            result = self._advance_state()

        return result

    def start_cycle(self) -> None:
        """Start a device operation cycle."""
        profile = LOAD_PROFILES.get(self.device_type, {})
        cycle = profile.get("cycle")

        if cycle:
            self.running_cycle = True
            self.cycle_index = 0
            self._enter_state(cycle[0])
        else:
            self.running_cycle = True

    def stop_cycle(self) -> None:
        """Stop the current cycle."""
        self.running_cycle = False
        self.current_state = "idle"
        self.state_timer = 0
        self.state_duration = 0

    def _advance_state(self) -> dict[str, Any]:
        """Move to the next state in the cycle."""
        profile = LOAD_PROFILES.get(self.device_type, {})
        cycle = profile.get("cycle")

        if not cycle:
            return {"changed": False}

        old_state = self.current_state
        self.cycle_index += 1

        if self.cycle_index >= len(cycle):
            self.running_cycle = False
            self.current_state = "idle"
            self.state_timer = 0
            return {
                "changed": True,
                "old_state": old_state,
                "new_state": "idle",
                "cycle_complete": True,
            }

        new_state = cycle[self.cycle_index]
        self._enter_state(new_state)

        return {
            "changed": True,
            "old_state": old_state,
            "new_state": self.current_state,
            "cycle_complete": False,
        }

    def _enter_state(self, state) -> None:
        """Enter a new state with randomized duration."""
        self.current_state = state.value if hasattr(state, "value") else state
        self.state_timer = 0

        profile = LOAD_PROFILES.get(self.device_type, {})
        state_profile = profile.get(state, {})
        if isinstance(state_profile, dict):
            duration_range = state_profile.get("duration_s", (60, 120))
            if isinstance(duration_range, tuple) and len(duration_range) == 2:
                self.state_duration = random.uniform(duration_range[0], duration_range[1])
            else:
                self.state_duration = 60
        else:
            self.state_duration = 60


# =============================================================================
# SIMULATION ENGINE
# =============================================================================


class SimulationEngine:
    """Enterprise-grade simulation engine with playback, scenarios, and metrics."""

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._running = False
        self._paused = False
        self._speed: float = 1.0
        self._trackers: dict[str, DeviceStateTracker] = {}
        self._tick_count: int = 0
        self._events_per_second: float = 0
        self._total_events: int = 0
        self._simulation_fps: float = 0
        self._last_tick_time: float = 0

        # Historical playback
        self._playback_mode = False
        self._playback_time: datetime | None = None
        self._playback_end: datetime | None = None

        # Metrics
        self._metrics: dict[str, float] = {
            "simulation_fps": 0,
            "total_power_w": 0,
            "peak_power_w": 0,
            "average_power_w": 0,
            "events_per_second": 0,
            "total_energy_kwh": 0,
            "electricity_cost_usd": 0,
            "api_latency_ms": 0,
            "ws_latency_ms": 0,
            "connected_devices": 0,
            "uptime_percent": 100,
        }

    @property
    def speed(self) -> float:
        return self._speed

    @property
    def is_running(self) -> bool:
        return self._running and not self._paused

    @property
    def is_paused(self) -> bool:
        return self._paused

    @property
    def metrics(self) -> dict[str, float]:
        return dict(self._metrics)

    async def start(self) -> None:
        """Start the simulation engine."""
        self._running = True
        self._paused = False
        self._task = asyncio.create_task(self._engine_loop())
        logger.info("Simulation engine started (speed: %.1fx)", self._speed)

    async def stop(self) -> None:
        """Stop the simulation engine."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Simulation engine stopped")

    def play(self) -> None:
        """Resume simulation."""
        self._paused = False
        logger.info("Simulation resumed")

    def pause(self) -> None:
        """Pause simulation."""
        self._paused = True
        logger.info("Simulation paused")

    def reset(self) -> None:
        """Reset all device states."""
        for tracker in self._trackers.values():
            tracker.stop_cycle()
        self._tick_count = 0
        self._total_events = 0
        logger.info("Simulation reset")

    def change_speed(self, speed: float) -> None:
        """Change simulation speed (1x, 2x, 5x, 10x)."""
        self._speed = max(0.1, min(10.0, speed))
        logger.info("Simulation speed changed to %.1fx", self._speed)

    async def seek(self, target_time: datetime) -> None:
        """Seek to a specific point in history."""
        self._playback_mode = True
        self._playback_time = target_time
        logger.info("Seeking to %s", target_time.isoformat())

    async def start_replay(self, start_time: datetime, end_time: datetime) -> None:
        """Start historical replay mode."""
        self._playback_mode = True
        self._playback_time = start_time
        self._playback_end = end_time
        logger.info("Replay started: %s -> %s", start_time.isoformat(), end_time.isoformat())

    def stop_replay(self) -> None:
        """Stop historical replay and return to live mode."""
        self._playback_mode = False
        self._playback_time = None
        self._playback_end = None
        logger.info("Replay stopped, returning to live mode")

    async def _engine_loop(self) -> None:
        """Main simulation loop - targets 1-second intervals."""
        import time

        while self._running:
            try:
                if self._paused:
                    await asyncio.sleep(0.1)
                    continue

                loop_start = time.monotonic()

                if self._playback_mode:
                    await self._replay_tick()
                else:
                    await self._live_tick()

                loop_duration = time.monotonic() - loop_start
                self._simulation_fps = 1.0 / max(loop_duration, 0.001)
                self._metrics["simulation_fps"] = round(self._simulation_fps, 1)

                # Sleep to maintain interval, adjusted for speed
                sleep_time = max(0.05, (1.0 / self._speed) - loop_duration)
                await asyncio.sleep(sleep_time)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Simulation engine error: %s", str(e))
                await asyncio.sleep(1)

    async def _live_tick(self) -> None:
        """Execute one live simulation tick."""
        async with async_session_factory() as db:
            try:
                result = await db.execute(select(Device))
                devices = result.scalars().all()

                if not devices:
                    return

                now = datetime.now(timezone.utc)
                hour = now.hour
                total_power_w = 0.0

                for device in devices:
                    device_type = device.type if isinstance(device.type, DeviceType) else DeviceType(device.type)
                    power_state = device.power_state if isinstance(device.power_state, PowerState) else PowerState(device.power_state)
                    device_id = str(device.id)

                    # Initialize tracker if needed
                    if device_id not in self._trackers:
                        tracker = DeviceStateTracker(device_id, device_type)
                        self._trackers[device_id] = tracker
                        if power_state == PowerState.ON:
                            tracker.start_cycle()

                    tracker = self._trackers[device_id]

                    # Skip powered-off devices
                    if power_state == PowerState.OFF:
                        device.energy_usage_kw = 0.0
                        continue

                    # Advance state machine
                    state_change = tracker.tick(self._speed)

                    # Calculate power
                    power_w = tracker.get_power_watts()

                    # Apply time-of-day modulation for non-cyclic devices
                    if not tracker.running_cycle:
                        time_factor = 0.6 + 0.4 * math.sin((hour - 6) * math.pi / 12)
                        power_w *= time_factor

                    power_kw = power_w / 1000.0
                    total_power_w += power_w

                    # Update device
                    device.energy_usage_kw = round(power_kw, 4)
                    device.last_updated = now

                    # Update metadata with state info
                    metadata = dict(device.extra_data or {})
                    metadata["sim_state"] = tracker.current_state
                    metadata["sim_power_w"] = round(power_w, 1)
                    metadata = self._update_device_telemetry(device_type, metadata, hour, power_state)
                    device.extra_data = metadata

                    # Record energy
                    voltage = 220.0 + random.gauss(0, 2)
                    current_a = power_w / voltage if voltage > 0 else 0
                    cost_per_kwh = 0.12
                    interval_hours = (1.0 * self._speed) / 3600.0
                    cost = power_kw * interval_hours * cost_per_kwh

                    energy_record = EnergyHistory(
                        device_id=device.id,
                        power_kw=round(power_kw, 4),
                        voltage=round(voltage, 1),
                        current_amps=round(current_a, 3),
                        cost_usd=round(cost, 6),
                    )
                    db.add(energy_record)

                    # Handle state changes
                    if state_change.get("changed"):
                        event = DeviceEvent(
                            device_id=device.id,
                            event_type="state_change",
                            severity=EventSeverity.INFO,
                            message=f"{device.name}: {state_change['old_state']} → {state_change['new_state']}",
                            metadata={
                                "old_state": state_change["old_state"],
                                "new_state": state_change["new_state"],
                                "power_w": round(power_w, 1),
                            },
                        )
                        db.add(event)
                        self._total_events += 1

                        await redis_client.publish_event({
                            "device_id": device_id,
                            "device_name": device.name,
                            "event_type": "state_change",
                            "severity": "info",
                            "message": f"{device.name}: {state_change['old_state']} → {state_change['new_state']}",
                            "timestamp": now.isoformat(),
                        })

                    # Publish telemetry
                    await redis_client.publish_device_update(device_id, {
                        "action": "telemetry",
                        "device_id": device_id,
                        "power_w": round(power_w, 1),
                        "power_kw": round(power_kw, 4),
                        "power_state": power_state.value,
                        "sim_state": tracker.current_state,
                        "metadata": metadata,
                        "timestamp": now.isoformat(),
                    })

                    # Random events (1% chance per tick)
                    if random.random() < 0.01:
                        await self._generate_event(db, device, device_type, now)

                # Update metrics
                self._metrics["total_power_w"] = round(total_power_w, 1)
                self._metrics["peak_power_w"] = max(
                    self._metrics["peak_power_w"], total_power_w
                )
                self._metrics["connected_devices"] = len(devices)
                self._metrics["total_energy_kwh"] = round(
                    self._metrics.get("total_energy_kwh", 0) + (total_power_w / 1000.0) * (self._speed / 3600.0), 4
                )
                self._metrics["electricity_cost_usd"] = round(
                    self._metrics["total_energy_kwh"] * 0.12, 4
                )

                # Publish aggregated metrics
                await redis_client.publish("system:metrics", self._metrics)

                self._tick_count += 1
                await db.commit()

            except Exception as e:
                await db.rollback()
                logger.error("Live tick error: %s", str(e))

    async def _replay_tick(self) -> None:
        """Execute one historical replay tick."""
        if not self._playback_time or not self._playback_end:
            self.stop_replay()
            return

        async with async_session_factory() as db:
            try:
                # Fetch historical data at the current playback time
                window_start = self._playback_time
                window_end = self._playback_time + timedelta(seconds=10 * self._speed)

                # Get historical energy records
                from sqlalchemy import and_

                energy_result = await db.execute(
                    select(EnergyHistory)
                    .where(
                        and_(
                            EnergyHistory.timestamp >= window_start,
                            EnergyHistory.timestamp < window_end,
                        )
                    )
                    .order_by(EnergyHistory.timestamp)
                    .limit(100)
                )
                records = energy_result.scalars().all()

                # Get historical events
                event_result = await db.execute(
                    select(DeviceEvent)
                    .where(
                        and_(
                            DeviceEvent.timestamp >= window_start,
                            DeviceEvent.timestamp < window_end,
                        )
                    )
                    .order_by(DeviceEvent.timestamp)
                    .limit(50)
                )
                events = event_result.scalars().all()

                # Broadcast historical data
                for record in records:
                    await redis_client.publish_device_update(str(record.device_id), {
                        "action": "replay_telemetry",
                        "device_id": str(record.device_id),
                        "power_kw": record.power_kw,
                        "voltage": record.voltage,
                        "current_amps": record.current_amps,
                        "timestamp": record.timestamp.isoformat(),
                        "replay": True,
                    })

                for event in events:
                    await redis_client.publish_event({
                        "device_id": str(event.device_id),
                        "event_type": event.event_type,
                        "severity": event.severity.value if hasattr(event.severity, "value") else event.severity,
                        "message": event.message,
                        "timestamp": event.timestamp.isoformat(),
                        "replay": True,
                    })

                # Publish replay position
                total_duration = (self._playback_end - self._playback_time).total_seconds()
                await redis_client.publish("system:replay", {
                    "position": self._playback_time.isoformat(),
                    "end": self._playback_end.isoformat(),
                    "progress": min(100, max(0, 100 - (total_duration / max(1, (self._playback_end - self._playback_time).total_seconds()) * 100))),
                    "speed": self._speed,
                })

                # Advance playback time
                self._playback_time += timedelta(seconds=10 * self._speed)

                if self._playback_time >= self._playback_end:
                    self.stop_replay()
                    await redis_client.publish("system:replay", {
                        "status": "complete",
                    })

            except Exception as e:
                logger.error("Replay tick error: %s", str(e))

    def _update_device_telemetry(
        self, device_type: DeviceType, metadata: dict, hour: int, power_state: PowerState,
    ) -> dict:
        """Update device-specific telemetry values."""
        if power_state == PowerState.OFF:
            return metadata

        if device_type == DeviceType.HVAC:
            outdoor_temp = 25 + 10 * math.sin((hour - 14) * math.pi / 12)  # Peak at 2 PM
            target = metadata.get("target_temperature", 22.0)
            current = metadata.get("temperature", 24.0)
            mode = metadata.get("mode", "cooling")

            if mode == "cooling":
                current += (outdoor_temp - current) * 0.01 - 0.05
            elif mode == "heating":
                current += 0.08 - (current - outdoor_temp) * 0.01

            current += random.gauss(0, 0.05)
            metadata["temperature"] = round(max(16, min(35, current)), 1)
            metadata["outdoor_temperature"] = round(outdoor_temp, 1)

            fan_speeds = ["low", "medium", "high", "auto"]
            if abs(current - target) > 3:
                metadata["fan_speed"] = "high"
            elif abs(current - target) > 1:
                metadata["fan_speed"] = "medium"
            else:
                metadata["fan_speed"] = "low"

        elif device_type == DeviceType.REFRIGERATOR:
            temp = metadata.get("temperature", 4.0)
            sim_state = metadata.get("sim_state", "idle")
            if sim_state in ("compressor_on", "cooling"):
                temp -= 0.1 + random.gauss(0, 0.02)
            else:
                temp += 0.03 + random.gauss(0, 0.01)
            metadata["temperature"] = round(max(0.5, min(10, temp)), 1)
            metadata["door_state"] = "closed"
            metadata["cooling_status"] = "active" if sim_state in ("compressor_on", "cooling") else "standby"

        elif device_type == DeviceType.ROUTER:
            # Simulate realistic network traffic
            base_down = 80 + 20 * math.sin(hour * math.pi / 12)
            metadata["download_speed"] = round(base_down + random.gauss(0, 10), 1)
            metadata["upload_speed"] = round(base_down * 0.4 + random.gauss(0, 5), 1)
            metadata["connected_clients"] = random.randint(3, 15)
            metadata["signal_quality"] = round(85 + random.gauss(0, 5), 0)
            metadata["packet_loss"] = round(max(0, random.gauss(0.5, 0.3)), 2)
            metadata["internet_status"] = "connected"

        elif device_type == DeviceType.WATER_HEATER:
            target = metadata.get("target_temperature", 50.0)
            current = metadata.get("temperature", 40.0)
            sim_state = metadata.get("sim_state", "idle")
            if sim_state == "heating":
                current += 0.3 + random.gauss(0, 0.05)
            else:
                current -= 0.05 + random.gauss(0, 0.01)
            metadata["temperature"] = round(max(20, min(80, current)), 1)

        elif device_type == DeviceType.SMART_LIGHT:
            brightness = metadata.get("brightness", 100)
            if hour >= 22 or hour < 6:
                brightness = max(10, brightness - random.randint(0, 2))
            elif hour >= 18:
                brightness = min(100, brightness + random.randint(0, 3))
            metadata["brightness"] = brightness

        elif device_type == DeviceType.CAMERA:
            metadata["recording"] = True
            metadata["motion_detected"] = random.random() < 0.03
            metadata["night_vision"] = hour < 6 or hour >= 20

        elif device_type == DeviceType.SMART_TV:
            metadata["volume"] = max(0, min(100, metadata.get("volume", 30) + random.randint(-1, 1)))

        elif device_type == DeviceType.WASHING_MACHINE:
            sim_state = metadata.get("sim_state", "idle")
            if sim_state not in ("idle", "complete"):
                remaining = metadata.get("remaining_time", 0)
                metadata["remaining_time"] = max(0, remaining - 1)
                metadata["spin_speed"] = 1200 if sim_state == "spin" else 0
                metadata["wash_mode"] = "normal"

        elif device_type == DeviceType.NEBULIZER:
            intensity = metadata.get("intensity", 50)
            metadata["intensity"] = intensity
            metadata["mist_level"] = round(intensity * 0.8 + random.gauss(0, 3), 0)

        return metadata

    async def _generate_event(
        self, db: AsyncSession, device: Device, device_type: DeviceType, now: datetime,
    ) -> None:
        """Generate contextually appropriate device events."""
        events_map = {
            DeviceType.HVAC: [
                ("filter_check", EventSeverity.WARNING, "HVAC filter maintenance recommended"),
                ("temperature_reached", EventSeverity.INFO, f"{device.name}: target temperature reached"),
                ("efficiency_drop", EventSeverity.WARNING, f"{device.name}: efficiency dropped below 80%"),
            ],
            DeviceType.REFRIGERATOR: [
                ("temperature_warning", EventSeverity.WARNING, f"{device.name}: internal temperature rising"),
                ("door_ajar", EventSeverity.WARNING, f"{device.name}: door left ajar"),
                ("compressor_cycle", EventSeverity.INFO, f"{device.name}: compressor cycle completed"),
            ],
            DeviceType.DOOR_LOCK: [
                ("auto_locked", EventSeverity.INFO, f"{device.name}: auto-locked after timeout"),
                ("tamper_alert", EventSeverity.CRITICAL, f"{device.name}: tamper attempt detected"),
            ],
            DeviceType.GARAGE_DOOR: [
                ("open_timeout", EventSeverity.WARNING, f"{device.name}: open longer than 30 minutes"),
            ],
            DeviceType.ROUTER: [
                ("bandwidth_spike", EventSeverity.WARNING, f"{device.name}: unusual bandwidth usage detected"),
                ("new_connection", EventSeverity.INFO, f"{device.name}: new device connected"),
                ("speed_degradation", EventSeverity.WARNING, f"{device.name}: internet speed below threshold"),
            ],
            DeviceType.CAMERA: [
                ("motion_detected", EventSeverity.INFO, f"{device.name}: motion detected"),
                ("recording_started", EventSeverity.INFO, f"{device.name}: recording started"),
            ],
            DeviceType.WATER_HEATER: [
                ("overheating", EventSeverity.WARNING, f"{device.name}: water temperature exceeding safe limit"),
            ],
        }

        templates = events_map.get(device_type, [
            ("heartbeat", EventSeverity.INFO, f"{device.name}: status OK"),
        ])

        template = random.choice(templates)
        event = DeviceEvent(
            device_id=device.id,
            event_type=template[0],
            severity=template[1],
            message=template[2],
            metadata={"automated": True, "sim_tick": self._tick_count},
        )
        db.add(event)
        self._total_events += 1

        await redis_client.publish_event({
            "device_id": str(device.id),
            "device_name": device.name,
            "event_type": template[0],
            "severity": template[1].value,
            "message": template[2],
            "timestamp": now.isoformat(),
        })

        # Generate alert for warning+ severity
        if template[1] in (EventSeverity.WARNING, EventSeverity.ERROR, EventSeverity.CRITICAL):
            alert_map = {
                "open_timeout": AlertType.DOOR_LEFT_OPEN,
                "door_ajar": AlertType.DOOR_LEFT_OPEN,
                "temperature_warning": AlertType.TEMPERATURE_HIGH,
                "overheating": AlertType.TEMPERATURE_HIGH,
                "speed_degradation": AlertType.INTERNET_DISCONNECTED,
                "tamper_alert": AlertType.SECURITY_BREACH,
                "bandwidth_spike": AlertType.ENERGY_SPIKE,
            }
            alert = Alert(
                device_id=device.id,
                type=alert_map.get(template[0], AlertType.DEVICE_OFFLINE),
                severity=template[1],
                message=template[2],
            )
            db.add(alert)

            await redis_client.publish_alert({
                "device_id": str(device.id),
                "device_name": device.name,
                "type": alert_map.get(template[0], AlertType.DEVICE_OFFLINE).value,
                "severity": template[1].value,
                "message": template[2],
                "timestamp": now.isoformat(),
            })


# Singleton — replaces the basic simulator
device_simulator = SimulationEngine()
