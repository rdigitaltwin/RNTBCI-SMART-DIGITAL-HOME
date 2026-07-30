"""RNTBCI Smart Home Digital Twin - Advanced Simulation Engine.

Enterprise-grade device simulation with realistic load profiles,
state machines, scenario management, and historical replay.
Runs at 1-second intervals with physically accurate power curves.

Key features:
- Device power phase state machine: OFF → STARTING (30s) → RUNNING → STOPPING → OFF
- Per-device operating modes with mode-specific kW and kVAR values
- Reactive power (kVAR) based on realistic power factors
- Continuous recording to home_power_history and device_power_history
- Noise injection for realistic fluctuations
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
    DevicePowerHistory,
    DevicePowerPhase,
    DeviceState,
    DeviceStatus,
    DeviceType,
    EnergyHistory,
    EventSeverity,
    HomePowerHistory,
    PowerState,
)
from backend.redis.client import redis_client
from backend.services.ml_inference import predict_power_consumption

logger = logging.getLogger(__name__)
settings = get_settings()


# =============================================================================
# DEVICE MODE DEFINITIONS WITH kW AND kVAR
# =============================================================================

# Each mode: {"kw": float, "kvar": float, "pf": float, "noise_pct": float}
# noise_pct = percentage of kw used as std deviation for Gaussian noise

DEVICE_MODE_PROFILES: dict[str, dict[str, dict[str, float]]] = {
    "base_load": {
        "active": {"kw": 0.20, "kvar": 0.066, "pf": 0.95, "noise_pct": 0.05},
    },
    "smart_light": {
        "off": {"kw": 0.0, "kvar": 0.0, "pf": 1.0, "noise_pct": 0.0},
        "dim": {"kw": 0.005, "kvar": 0.002, "pf": 0.92, "noise_pct": 0.10},
        "normal": {"kw": 0.012, "kvar": 0.004, "pf": 0.95, "noise_pct": 0.08},
        "bright": {"kw": 0.020, "kvar": 0.007, "pf": 0.94, "noise_pct": 0.08},
    },
    "refrigerator": {
        "idle": {"kw": 0.05, "kvar": 0.037, "pf": 0.80, "noise_pct": 0.10},
        "cooling": {"kw": 0.15, "kvar": 0.112, "pf": 0.80, "noise_pct": 0.08},
        "compressor": {"kw": 0.30, "kvar": 0.225, "pf": 0.80, "noise_pct": 0.06},
        "defrost": {"kw": 0.25, "kvar": 0.188, "pf": 0.80, "noise_pct": 0.08},
    },
    "hvac": {
        "off": {"kw": 0.0, "kvar": 0.0, "pf": 1.0, "noise_pct": 0.0},
        "fan": {"kw": 0.15, "kvar": 0.075, "pf": 0.89, "noise_pct": 0.10},
        "eco": {"kw": 1.00, "kvar": 0.484, "pf": 0.90, "noise_pct": 0.08},
        "cool": {"kw": 2.50, "kvar": 1.210, "pf": 0.90, "noise_pct": 0.06},
        "heat": {"kw": 3.00, "kvar": 1.452, "pf": 0.90, "noise_pct": 0.06},
        "boost": {"kw": 4.00, "kvar": 1.936, "pf": 0.90, "noise_pct": 0.05},
    },
    "washing_machine": {
        "idle": {"kw": 0.0, "kvar": 0.0, "pf": 1.0, "noise_pct": 0.0},
        "wash": {"kw": 0.50, "kvar": 0.265, "pf": 0.88, "noise_pct": 0.08},
        "rinse": {"kw": 0.20, "kvar": 0.106, "pf": 0.88, "noise_pct": 0.10},
        "spin": {"kw": 0.80, "kvar": 0.424, "pf": 0.88, "noise_pct": 0.06},
    },
    "dishwasher": {
        "idle": {"kw": 0.0, "kvar": 0.0, "pf": 1.0, "noise_pct": 0.0},
        "wash": {"kw": 0.80, "kvar": 0.387, "pf": 0.90, "noise_pct": 0.06},
        "dry": {"kw": 1.20, "kvar": 0.581, "pf": 0.90, "noise_pct": 0.06},
    },
    "cooking": {
        "idle": {"kw": 0.0, "kvar": 0.0, "pf": 1.0, "noise_pct": 0.0},
        "low": {"kw": 0.50, "kvar": 0.164, "pf": 0.95, "noise_pct": 0.08},
        "medium": {"kw": 1.50, "kvar": 0.493, "pf": 0.95, "noise_pct": 0.06},
        "high": {"kw": 3.00, "kvar": 0.986, "pf": 0.95, "noise_pct": 0.05},
    },
    # Generic profiles for other devices (single-mode when ON)
    "smart_switch": {
        "off": {"kw": 0.0, "kvar": 0.0, "pf": 1.0, "noise_pct": 0.0},
        "on": {"kw": 0.0015, "kvar": 0.0005, "pf": 0.95, "noise_pct": 0.10},
    },
    "smart_plug": {
        "off": {"kw": 0.0, "kvar": 0.0, "pf": 1.0, "noise_pct": 0.0},
        "on": {"kw": 0.80, "kvar": 0.30, "pf": 0.94, "noise_pct": 0.10},
    },
    "door_lock": {
        "off": {"kw": 0.0, "kvar": 0.0, "pf": 1.0, "noise_pct": 0.0},
        "locked": {"kw": 0.002, "kvar": 0.0005, "pf": 0.97, "noise_pct": 0.15},
    },
    "garage_door": {
        "off": {"kw": 0.0, "kvar": 0.0, "pf": 1.0, "noise_pct": 0.0},
        "standby": {"kw": 0.003, "kvar": 0.001, "pf": 0.95, "noise_pct": 0.10},
    },
    "water_heater": {
        "off": {"kw": 0.0, "kvar": 0.0, "pf": 1.0, "noise_pct": 0.0},
        "heating": {"kw": 4.50, "kvar": 0.50, "pf": 0.99, "noise_pct": 0.04},
        "maintaining": {"kw": 0.80, "kvar": 0.10, "pf": 0.99, "noise_pct": 0.08},
    },
    "nebulizer": {
        "off": {"kw": 0.0, "kvar": 0.0, "pf": 1.0, "noise_pct": 0.0},
        "low": {"kw": 0.025, "kvar": 0.008, "pf": 0.95, "noise_pct": 0.10},
        "medium": {"kw": 0.040, "kvar": 0.013, "pf": 0.95, "noise_pct": 0.10},
        "high": {"kw": 0.055, "kvar": 0.018, "pf": 0.95, "noise_pct": 0.10},
    },
    "router": {
        "off": {"kw": 0.0, "kvar": 0.0, "pf": 1.0, "noise_pct": 0.0},
        "active": {"kw": 0.012, "kvar": 0.004, "pf": 0.95, "noise_pct": 0.12},
    },
    "camera": {
        "off": {"kw": 0.0, "kvar": 0.0, "pf": 1.0, "noise_pct": 0.0},
        "recording": {"kw": 0.015, "kvar": 0.005, "pf": 0.95, "noise_pct": 0.10},
        "night_vision": {"kw": 0.018, "kvar": 0.006, "pf": 0.95, "noise_pct": 0.10},
    },
    "smart_tv": {
        "off": {"kw": 0.0, "kvar": 0.0, "pf": 1.0, "noise_pct": 0.0},
        "on": {"kw": 0.120, "kvar": 0.040, "pf": 0.95, "noise_pct": 0.08},
        "standby": {"kw": 0.001, "kvar": 0.0003, "pf": 0.95, "noise_pct": 0.15},
    },
}

# Default mode when device is first turned ON
DEFAULT_ON_MODE: dict[str, str] = {
    "base_load": "active",
    "smart_light": "normal",
    "refrigerator": "idle",
    "hvac": "cool",
    "washing_machine": "wash",
    "dishwasher": "wash",
    "cooking": "medium",
    "smart_switch": "on",
    "smart_plug": "on",
    "door_lock": "locked",
    "garage_door": "standby",
    "water_heater": "heating",
    "nebulizer": "medium",
    "router": "active",
    "camera": "recording",
    "smart_tv": "on",
}

# Auto-cycling devices: mode sequence and duration ranges (seconds)
DEVICE_CYCLES: dict[str, list[tuple[str, tuple[int, int]]]] = {
    "refrigerator": [
        ("idle", (300, 600)),
        ("cooling", (120, 300)),
        ("compressor", (30, 60)),
        ("cooling", (120, 240)),
        ("defrost", (60, 120)),
    ],
    "washing_machine": [
        ("wash", (600, 1200)),
        ("rinse", (300, 600)),
        ("spin", (300, 600)),
    ],
    "dishwasher": [
        ("wash", (1200, 1800)),
        ("dry", (600, 900)),
    ],
}

# HVAC warm-up power multiplier curve (seconds → multiplier)
STARTING_DURATION_S = 30
STOPPING_DURATION_S = 10
HISTORY_RECORD_INTERVAL_S = 15  # Record to history tables every 15 seconds


# =============================================================================
# DEVICE STATE TRACKER (per device)
# =============================================================================


class DeviceStateTracker:
    """Tracks power phase, operating mode, and cycle state for a single device."""

    def __init__(self, device_id: str, device_type_str: str) -> None:
        self.device_id = device_id
        self.device_type_str = device_type_str

        # Power phase state machine
        self.power_phase: str = DevicePowerPhase.OFF.value
        self.phase_timer: float = 0.0  # seconds spent in current phase

        # Operating mode
        self.operating_mode: str = "off"

        # Cycle state (for auto-cycling devices like fridge)
        self.cycle_index: int = 0
        self.cycle_timer: float = 0.0
        self.cycle_duration: float = 0.0
        self.running_cycle: bool = False

        # Metadata
        self.metadata: dict[str, Any] = {}
        self.accumulated_kwh: float = 0.0

    def get_mode_profile(self) -> dict[str, float]:
        """Get the kW/kVAR profile for current operating mode."""
        profiles = DEVICE_MODE_PROFILES.get(self.device_type_str, {})
        return profiles.get(self.operating_mode, {"kw": 0.0, "kvar": 0.0, "pf": 1.0, "noise_pct": 0.0})

    def get_power_kw_kvar(self) -> tuple[float, float, float]:
        """Calculate current kW, kVAR, and power factor using ML Model predictions.
        
        Replaced legacy Gaussian noise and hardcoded profiles with AI-driven inference.
        """
        if self.power_phase == DevicePowerPhase.OFF.value:
            return 0.0, 0.0, 1.0

        if self.power_phase == DevicePowerPhase.STARTING.value:
            return 0.0, 0.0, 1.0
            
        now = datetime.now(timezone.utc)
        hour = now.hour
        season_encoded = 1 # Example: Summer
        is_weekend = 1 if now.weekday() >= 5 else 0
        
        # Simple simulated outdoor temp based on hour (can be pulled from a weather API)
        outdoor_temp = 25 + 10 * math.sin((hour - 14) * math.pi / 12)
        
        # Get AI predicted power consumption for this appliance
        base_kw = predict_power_consumption(
            outdoor_temp=outdoor_temp,
            season_encoded=season_encoded,
            hour=hour,
            is_weekend=is_weekend,
            prev_energy=0.0, # Could be fetched from self.metadata
            appliance_type=self.device_type_str,
            household_size=3
        )
        
        # Determine reactive power (kVAR) using a static PF estimation for the appliance
        # Since our dataset mainly has kWh, we will assign an average pf
        pf = 0.90
        base_kvar = base_kw * math.tan(math.acos(pf)) if base_kw > 0 else 0.0

        if self.power_phase == DevicePowerPhase.STOPPING.value:
            # Decay: power reduces linearly over STOPPING_DURATION_S
            decay = max(0.0, 1.0 - (self.phase_timer / STOPPING_DURATION_S))
            base_kw *= decay
            base_kvar *= decay

        return round(base_kw, 3), round(base_kvar, 3), pf

    def set_power_on(self, mode: str | None = None) -> None:
        """Transition instantly to STARTING phase."""
        if self.power_phase in (DevicePowerPhase.RUNNING.value, DevicePowerPhase.STARTING.value):
            return  # Already on or starting
        self.power_phase = DevicePowerPhase.STARTING.value
        self.phase_timer = 0.0
        self.operating_mode = mode or DEFAULT_ON_MODE.get(self.device_type_str, "on")
        # Start auto-cycle if applicable
        if self.device_type_str in DEVICE_CYCLES:
            self._start_cycle()

    def set_power_off(self) -> None:
        """Transition instantly to OFF phase."""
        if self.power_phase == DevicePowerPhase.OFF.value:
            return  # Already off
        self.power_phase = DevicePowerPhase.OFF.value
        self.phase_timer = 0.0
        self.operating_mode = "off"
        self.running_cycle = False

    def set_mode(self, mode: str) -> None:
        """Change operating mode while device is running."""
        profiles = DEVICE_MODE_PROFILES.get(self.device_type_str, {})
        if mode in profiles:
            self.operating_mode = mode
            # Reset cycle if device has auto-cycling
            if self.device_type_str in DEVICE_CYCLES:
                self.running_cycle = False

    def tick(self, elapsed_s: float = 1.0) -> dict[str, Any]:
        """Advance the state machine by elapsed_s seconds.

        Returns dict with state change info.
        """
        result: dict[str, Any] = {"changed": False, "phase_changed": False}

        self.phase_timer += elapsed_s

        # Handle phase transitions
        if self.power_phase == DevicePowerPhase.STARTING.value:
            if self.phase_timer >= STARTING_DURATION_S:
                old_phase = self.power_phase
                self.power_phase = DevicePowerPhase.RUNNING.value
                self.phase_timer = 0.0
                result["phase_changed"] = True
                result["old_phase"] = old_phase
                result["new_phase"] = self.power_phase
                result["changed"] = True

        elif self.power_phase == DevicePowerPhase.STOPPING.value:
            if self.phase_timer >= STOPPING_DURATION_S:
                old_phase = self.power_phase
                self.power_phase = DevicePowerPhase.OFF.value
                self.phase_timer = 0.0
                self.operating_mode = "off"
                self.running_cycle = False
                result["phase_changed"] = True
                result["old_phase"] = old_phase
                result["new_phase"] = self.power_phase
                result["changed"] = True

        elif self.power_phase == DevicePowerPhase.RUNNING.value:
            # Handle auto-cycling (e.g., fridge)
            if self.running_cycle:
                cycle_result = self._tick_cycle(elapsed_s)
                if cycle_result.get("changed"):
                    result.update(cycle_result)

        return result

    def _start_cycle(self) -> None:
        """Start auto-cycling for devices that cycle through modes."""
        cycle = DEVICE_CYCLES.get(self.device_type_str)
        if not cycle:
            return
        self.running_cycle = True
        self.cycle_index = 0
        mode, duration_range = cycle[0]
        self.operating_mode = mode
        self.cycle_timer = 0.0
        self.cycle_duration = random.uniform(duration_range[0], duration_range[1])

    def _tick_cycle(self, elapsed_s: float) -> dict[str, Any]:
        """Advance auto-cycle timer."""
        cycle = DEVICE_CYCLES.get(self.device_type_str)
        if not cycle:
            return {"changed": False}

        self.cycle_timer += elapsed_s
        if self.cycle_timer >= self.cycle_duration:
            old_mode = self.operating_mode
            self.cycle_index = (self.cycle_index + 1) % len(cycle)
            mode, duration_range = cycle[self.cycle_index]
            self.operating_mode = mode
            self.cycle_timer = 0.0
            self.cycle_duration = random.uniform(duration_range[0], duration_range[1])
            return {
                "changed": True,
                "old_mode": old_mode,
                "new_mode": mode,
                "cycle_wrap": self.cycle_index == 0,
            }
        return {"changed": False}


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
        self._history_accumulator: float = 0.0  # seconds since last history write

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

    def get_tracker(self, device_id: str) -> DeviceStateTracker | None:
        """Get the state tracker for a device (used by API endpoints)."""
        return self._trackers.get(device_id)

    def ensure_tracker(self, device_id: str, device_type_str: str) -> DeviceStateTracker:
        """Get or create a tracker for a device."""
        if device_id not in self._trackers:
            self._trackers[device_id] = DeviceStateTracker(device_id, device_type_str)
        return self._trackers[device_id]

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
            tracker.set_power_off()
            tracker.power_phase = DevicePowerPhase.OFF.value
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
                total_power_kw = 0.0
                total_power_kvar = 0.0
                self._history_accumulator += self._speed

                # Should we write to history tables this tick?
                write_history = self._history_accumulator >= HISTORY_RECORD_INTERVAL_S

                device_power_records: list[DevicePowerHistory] = []
                wide_kwargs: dict[str, float] = {}

                for device in devices:
                    device_type = device.type if isinstance(device.type, DeviceType) else DeviceType(device.type)
                    power_state = device.power_state if isinstance(device.power_state, PowerState) else PowerState(device.power_state)
                    device_id = str(device.id)
                    device_type_str = device_type.value

                    # Initialize tracker if needed
                    if device_id not in self._trackers:
                        tracker = DeviceStateTracker(device_id, device_type_str)
                        self._trackers[device_id] = tracker
                        # If device is already ON in DB, sync tracker
                        if power_state == PowerState.ON:
                            tracker.power_phase = DevicePowerPhase.RUNNING.value
                            tracker.operating_mode = DEFAULT_ON_MODE.get(device_type_str, "on")
                            if device_type_str in DEVICE_CYCLES:
                                tracker._start_cycle()
                        # Base load is always running
                        if device_type == DeviceType.BASE_LOAD:
                            tracker.power_phase = DevicePowerPhase.RUNNING.value
                            tracker.operating_mode = "active"

                    tracker = self._trackers[device_id]

                    # Sync power state from DB → tracker if out of sync
                    if power_state == PowerState.OFF and tracker.power_phase not in (
                        DevicePowerPhase.OFF.value, DevicePowerPhase.STOPPING.value
                    ):
                        tracker.set_power_off()
                    elif power_state == PowerState.ON and tracker.power_phase == DevicePowerPhase.OFF.value:
                        tracker.set_power_on()

                    # Base load always stays running
                    if device_type == DeviceType.BASE_LOAD:
                        tracker.power_phase = DevicePowerPhase.RUNNING.value
                        tracker.operating_mode = "active"

                    # Advance state machine
                    state_change = tracker.tick(self._speed)

                    # Calculate power
                    kw, kvar, pf = tracker.get_power_kw_kvar()
                    total_power_kw += kw
                    total_power_kvar += kvar

                    interval_hours = (1.0 * self._speed) / 3600.0
                    if kw > 0:
                        tracker.accumulated_kwh += (kw * interval_hours)
                        
                    if write_history or state_change.get("changed"):
                        # Update device DB record
                        device.energy_usage_kw = round(kw, 4)
                        device.last_updated = now
    
                        if power_state == PowerState.ON and device.turned_on_at is None:
                            device.turned_on_at = now
                        elif power_state == PowerState.OFF:
                            device.turned_on_at = None
    
                        # Update metadata with state info
                        metadata = dict(device.extra_data or {})
                        metadata["sim_state"] = tracker.operating_mode
                        metadata["sim_phase"] = tracker.power_phase
                        metadata["sim_power_kw"] = round(kw, 4)
                        metadata["sim_power_kvar"] = round(kvar, 4)
                        metadata["sim_power_factor"] = round(pf, 3)
                        metadata = self._update_device_telemetry(device_type, metadata, hour, power_state)
                        device.extra_data = metadata
    
                        # Record to EnergyHistory
                        if tracker.accumulated_kwh > 0:
                            device.total_energy_kwh = (device.total_energy_kwh or 0.0) + tracker.accumulated_kwh
                            
                            voltage = 230.0 + random.gauss(0, 2)
                            current_a = (kw * 1000) / voltage if voltage > 0 else 0
                            cost_per_kwh = 0.12
                            cost = tracker.accumulated_kwh * cost_per_kwh
    
                            energy_record = EnergyHistory(
                                device_id=device.id,
                                power_kw=round(kw, 4),
                                voltage=round(voltage, 1),
                                current_amps=round(current_a, 3),
                                cost_usd=round(cost, 6),
                            )
                            db.add(energy_record)
                            tracker.accumulated_kwh = 0.0

                    # Record to DevicePowerHistory (simplified table, every ~15s)
                    if write_history:
                        device_power_records.append(DevicePowerHistory(
                            device_id=device.id,
                            timestamp=now,
                            total_power_consumption_kw=round(kw, 6),
                        ))

                        # Populate wide_kwargs for HomePowerHistory
                        import re
                        normalized_name = device.name.lower().replace('"', '').replace('-', '')
                        normalized_name = re.sub(r'\s+', '_', normalized_name.strip())
                        normalized_name = re.sub(r'_+', '_', normalized_name)
                        wide_kwargs[f"{normalized_name}_kw"] = round(kw, 6)
                        wide_kwargs[f"{normalized_name}_kvar"] = round(kvar, 6)

                    # Handle state changes
                    if state_change.get("changed"):
                        msg_parts = []
                        if state_change.get("phase_changed"):
                            msg_parts.append(
                                f"phase: {state_change.get('old_phase')} → {state_change.get('new_phase')}"
                            )
                        if state_change.get("old_mode"):
                            msg_parts.append(
                                f"mode: {state_change.get('old_mode')} → {state_change.get('new_mode')}"
                            )

                        event = DeviceEvent(
                            device_id=device.id,
                            event_type="state_change",
                            severity=EventSeverity.INFO,
                            message=f"{device.name}: {', '.join(msg_parts) if msg_parts else 'state updated'}",
                            metadata={
                                "phase": tracker.power_phase,
                                "mode": tracker.operating_mode,
                                "power_kw": round(kw, 4),
                            },
                        )
                        db.add(event)
                        self._total_events += 1

                        await redis_client.publish_event({
                            "device_id": device_id,
                            "device_name": device.name,
                            "event_type": "state_change",
                            "severity": "info",
                            "message": event.message,
                            "timestamp": now.isoformat(),
                        })

                    # Publish telemetry
                    await redis_client.publish_device_update(device_id, {
                        "action": "telemetry",
                        "device_id": device_id,
                        "power_kw": round(kw, 4),
                        "power_kvar": round(kvar, 4),
                        "power_factor": round(pf, 3),
                        "power_state": power_state.value,
                        "sim_phase": tracker.power_phase,
                        "sim_mode": tracker.operating_mode,
                        "metadata": metadata,
                        "timestamp": now.isoformat(),
                    })

                    # Random events (disabled)
                    # if random.random() < 0.005:
                    #     await self._generate_event(db, device, device_type, now)

                # Record to HomePowerHistory (every ~15s)
                if write_history:
                    # Create dict with only columns that actually exist on the model
                    valid_columns = [c.key for c in HomePowerHistory.__table__.columns]
                    filtered_kwargs = {k: v for k, v in wide_kwargs.items() if k in valid_columns}
                    
                    home_record = HomePowerHistory(
                        timestamp=now,
                        total_home_power_consumption_kw=round(total_power_kw, 4),
                        **filtered_kwargs
                    )
                    db.add(home_record)
                    db.add_all(device_power_records)
                    self._history_accumulator = 0.0

                # Update metrics
                total_power_w = total_power_kw * 1000
                self._metrics["total_power_w"] = round(total_power_w, 1)
                self._metrics["peak_power_w"] = max(
                    self._metrics["peak_power_w"], total_power_w
                )
                self._metrics["connected_devices"] = len(devices)
                self._metrics["total_energy_kwh"] = round(
                    self._metrics.get("total_energy_kwh", 0) + (total_power_kw) * (self._speed / 3600.0), 4
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

            if abs(current - target) > 3:
                metadata["fan_speed"] = "high"
            elif abs(current - target) > 1:
                metadata["fan_speed"] = "medium"
            else:
                metadata["fan_speed"] = "low"

        elif device_type == DeviceType.REFRIGERATOR:
            temp = metadata.get("temperature", 4.0)
            sim_state = metadata.get("sim_state", "idle")
            if sim_state in ("compressor", "cooling"):
                temp -= 0.1 + random.gauss(0, 0.02)
            else:
                temp += 0.03 + random.gauss(0, 0.01)
            metadata["temperature"] = round(max(0.5, min(10, temp)), 1)
            metadata["door_state"] = "closed"
            metadata["cooling_status"] = "active" if sim_state in ("compressor", "cooling") else "standby"

        elif device_type == DeviceType.ROUTER:
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
            if sim_state not in ("idle", "off"):
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
