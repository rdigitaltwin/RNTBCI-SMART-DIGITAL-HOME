"""RNTBCI Smart Home Digital Twin - Home Energy Management System (HEMS).

Energy optimization, load balancing, peak management, cost prediction,
and consumption forecasting.
"""

import logging
import math
import random
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import async_session_factory
from backend.models import Device, DeviceType, EnergyHistory, PowerState
from backend.redis.client import redis_client

logger = logging.getLogger(__name__)

# Electricity tariff structure (USD per kWh)
TARIFF = {
    "off_peak": 0.08,    # 10 PM - 6 AM
    "mid_peak": 0.12,    # 6 AM - 2 PM, 6 PM - 10 PM
    "on_peak": 0.18,     # 2 PM - 6 PM
}

# Device priority for load shedding (lower = shed first)
DEVICE_PRIORITY = {
    DeviceType.SMART_LIGHT: 3,
    DeviceType.SMART_TV: 2,
    DeviceType.NEBULIZER: 2,
    DeviceType.SMART_PLUG: 3,
    DeviceType.WASHING_MACHINE: 4,
    DeviceType.DISHWASHER: 4,
    DeviceType.WATER_HEATER: 5,
    DeviceType.HVAC: 7,
    DeviceType.REFRIGERATOR: 9,
    DeviceType.CAMERA: 8,
    DeviceType.ROUTER: 10,
    DeviceType.DOOR_LOCK: 10,
    DeviceType.GARAGE_DOOR: 6,
    DeviceType.SMART_SWITCH: 5,
}

# Maximum recommended power budget (watts)
MAX_POWER_BUDGET_W = 8000
PEAK_THRESHOLD_W = 6500


class EnergyManager:
    """Central energy management with optimization and prediction."""

    def __init__(self) -> None:
        self._power_budget_w: float = MAX_POWER_BUDGET_W
        self._current_total_w: float = 0
        self._peak_today_w: float = 0
        self._total_cost_today: float = 0
        self._optimization_active: bool = False
        self._predictions: dict[str, float] = {}

    @property
    def status(self) -> dict[str, Any]:
        return {
            "power_budget_w": self._power_budget_w,
            "current_total_w": round(self._current_total_w, 1),
            "peak_today_w": round(self._peak_today_w, 1),
            "total_cost_today_usd": round(self._total_cost_today, 4),
            "optimization_active": self._optimization_active,
            "current_tariff": self._get_current_tariff(),
            "tariff_rate_usd": TARIFF[self._get_current_tariff()],
            "budget_utilization_pct": round(
                (self._current_total_w / self._power_budget_w) * 100, 1
            ) if self._power_budget_w > 0 else 0,
            "load_status": self._get_load_status(),
            "predictions": self._predictions,
        }

    def set_power_budget(self, budget_w: float) -> None:
        """Set the maximum power budget in watts."""
        self._power_budget_w = max(1000, budget_w)

    def _get_current_tariff(self) -> str:
        """Determine current electricity tariff period."""
        hour = datetime.now(timezone.utc).hour
        if 22 <= hour or hour < 6:
            return "off_peak"
        elif 14 <= hour < 18:
            return "on_peak"
        return "mid_peak"

    def _get_load_status(self) -> str:
        """Get current load status."""
        ratio = self._current_total_w / self._power_budget_w if self._power_budget_w > 0 else 0
        if ratio < 0.6:
            return "normal"
        elif ratio < 0.8:
            return "elevated"
        elif ratio < 0.95:
            return "high"
        return "critical"

    async def analyze(self) -> dict[str, Any]:
        """Run full energy analysis cycle."""
        async with async_session_factory() as db:
            try:
                # Current power draw
                result = await db.execute(
                    select(
                        func.sum(Device.energy_usage_kw),
                        func.count(Device.id),
                    ).where(Device.power_state == PowerState.ON)
                )
                row = result.one()
                total_kw = float(row[0] or 0)
                active_devices = int(row[1] or 0)

                self._current_total_w = total_kw * 1000
                self._peak_today_w = max(self._peak_today_w, self._current_total_w)

                # Calculate cost
                tariff = self._get_current_tariff()
                rate = TARIFF[tariff]
                interval_hours = 10 / 3600  # 10 second interval
                self._total_cost_today += total_kw * interval_hours * rate

                # Get power allocation by device
                device_result = await db.execute(
                    select(Device).where(Device.power_state == PowerState.ON)
                )
                devices = device_result.scalars().all()

                allocations = []
                for d in devices:
                    dtype = d.type if isinstance(d.type, DeviceType) else DeviceType(d.type)
                    priority = DEVICE_PRIORITY.get(dtype, 5)
                    allocations.append({
                        "device_id": str(d.id),
                        "device_name": d.name,
                        "device_type": dtype.value,
                        "power_kw": d.energy_usage_kw,
                        "power_w": round(d.energy_usage_kw * 1000, 1),
                        "priority": priority,
                    })

                allocations.sort(key=lambda x: x["priority"])

                # Run predictions
                self._predictions = await self._predict_consumption(db)

                # Check for peak load management
                recommendations = []
                if self._current_total_w > PEAK_THRESHOLD_W:
                    recommendations = self._generate_load_shed_recommendations(allocations)

                analysis = {
                    **self.status,
                    "active_devices": active_devices,
                    "allocations": allocations,
                    "recommendations": recommendations,
                    "predictions": self._predictions,
                }

                # Publish to real-time
                await redis_client.publish("system:hems", analysis)

                return analysis

            except Exception as e:
                logger.error("HEMS analysis error: %s", str(e))
                return self.status

    async def _predict_consumption(self, db: AsyncSession) -> dict[str, float]:
        """Predict consumption for next hours based on historical patterns."""
        now = datetime.now(timezone.utc)
        predictions = {}

        for offset_h in [1, 2, 4, 8, 24]:
            target_hour = (now.hour + offset_h) % 24
            # Simple prediction based on time-of-day pattern
            time_factor = 0.5 + 0.5 * math.sin((target_hour - 6) * math.pi / 12)
            base_prediction = self._current_total_w * time_factor
            noise = random.gauss(0, base_prediction * 0.1)
            predictions[f"next_{offset_h}h_w"] = round(max(0, base_prediction + noise), 1)

        # Cost prediction for rest of day
        remaining_hours = 24 - now.hour
        avg_rate = sum(TARIFF.values()) / len(TARIFF)
        predicted_daily_cost = self._total_cost_today + (
            (self._current_total_w / 1000) * remaining_hours * avg_rate * 0.7
        )
        predictions["predicted_daily_cost_usd"] = round(predicted_daily_cost, 2)

        return predictions

    def _generate_load_shed_recommendations(self, allocations: list[dict]) -> list[dict]:
        """Generate recommendations for load shedding to stay within budget."""
        excess_w = self._current_total_w - PEAK_THRESHOLD_W
        recommendations = []

        for alloc in allocations:
            if excess_w <= 0:
                break
            if alloc["priority"] <= 5:  # Only shed low-priority devices
                recommendations.append({
                    "device_id": alloc["device_id"],
                    "device_name": alloc["device_name"],
                    "action": "reduce_power" if alloc["priority"] > 3 else "power_off",
                    "savings_w": alloc["power_w"],
                    "reason": f"Peak load management (current: {round(self._current_total_w)}W, threshold: {PEAK_THRESHOLD_W}W)",
                })
                excess_w -= alloc["power_w"]

        return recommendations

    async def optimize(self) -> dict[str, Any]:
        """Run energy optimization pass."""
        self._optimization_active = True
        analysis = await self.analyze()

        # Auto-apply recommendations if in optimization mode
        if analysis.get("recommendations"):
            applied = 0
            async with async_session_factory() as db:
                for rec in analysis["recommendations"]:
                    try:
                        from uuid import UUID
                        device_result = await db.execute(
                            select(Device).where(Device.id == UUID(rec["device_id"]))
                        )
                        device = device_result.scalar_one_or_none()
                        if device and rec["action"] == "power_off":
                            device.power_state = PowerState.STANDBY
                            device.last_updated = datetime.now(timezone.utc)
                            applied += 1
                    except Exception:
                        pass
                await db.commit()

            analysis["optimizations_applied"] = applied

        return analysis


# Singleton
energy_manager = EnergyManager()
