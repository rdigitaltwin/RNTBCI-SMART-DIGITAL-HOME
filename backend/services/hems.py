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
from backend.models import Device, DeviceType, EnergyHistory, HouseConfig, PowerState
from backend.redis.client import redis_client
from backend.services.ml_inference import predict_forecast_consumption, generate_recommendation
from backend.services.tariffs import tariff_service

logger = logging.getLogger(__name__)

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

class EnergyManager:
    """Central energy management with optimization and prediction."""

    def __init__(self) -> None:
        self._power_budget_kw: float = 8.0
        self._peak_threshold_kw: float = 6.5
        self._current_total_kw: float = 0.0
        self._peak_today_kw: float = 0.0
        self._total_cost_today: float = 0.0
        self._optimization_active: bool = False
        self._predictions: dict[str, float] = {}

    @property
    def status(self) -> dict[str, Any]:
        return {
            "power_budget_kw": self._power_budget_kw,
            "current_total_kw": round(self._current_total_kw, 2),
            "peak_today_kw": round(self._peak_today_kw, 2),
            "total_cost_today_usd": round(self._total_cost_today, 4),
            "optimization_active": self._optimization_active,
            "current_tariff": tariff_service.get_current_period(),
            "tariff_rate_usd": tariff_service.get_current_rate(),
            "budget_utilization_pct": round(
                (self._current_total_kw / self._power_budget_kw) * 100, 1
            ) if self._power_budget_kw > 0 else 0,
            "load_status": self._get_load_status(),
            "predictions": self._predictions,
        }

    def set_power_budget(self, budget_kw: float) -> None:
        """Set the maximum power budget in kW."""
        self._power_budget_kw = max(1.0, budget_kw)

    def _get_load_status(self) -> str:
        """Get current load status."""
        ratio = self._current_total_kw / self._power_budget_kw if self._power_budget_kw > 0 else 0
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
                # Sync power budget from HouseConfig
                house_config_result = await db.execute(select(HouseConfig).limit(1))
                house_config = house_config_result.scalar_one_or_none()
                if house_config:
                    self._power_budget_kw = house_config.max_load_kw
                    self._peak_threshold_kw = self._power_budget_kw * 0.8  # Target 80% as peak threshold

                # Current power draw
                result = await db.execute(
                    select(
                        func.sum(Device.energy_usage_kw),
                        func.count(Device.id),
                    ).where(Device.power_state == PowerState.ON)
                )
                row = result.one()
                total_kw = float(row[0] or 0.0)
                active_devices = int(row[1] or 0)

                self._current_total_kw = total_kw
                self._peak_today_kw = max(self._peak_today_kw, self._current_total_kw)

                # Calculate cost
                rate = tariff_service.get_current_rate()
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
                        "priority": priority,
                    })

                allocations.sort(key=lambda x: x["priority"])

                # Run predictions
                self._predictions = await self._predict_consumption(db)

                # Check for peak load management
                recommendations = []
                if self._current_total_kw > self._peak_threshold_kw:
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
            # Use ML forecasting model
            prediction_kw = predict_forecast_consumption(self._current_total_kw, offset_h)
            predictions[f"next_{offset_h}h_kw"] = round(prediction_kw, 2)

        # Cost prediction for rest of day
        remaining_hours = 24 - now.hour
        avg_rate = tariff_service.get_average_rate()
        predicted_daily_cost = self._total_cost_today + (
            self._current_total_kw * remaining_hours * avg_rate * 0.7
        )
        predictions["predicted_daily_cost_usd"] = round(predicted_daily_cost, 2)

        return predictions

    def _generate_load_shed_recommendations(self, allocations: list[dict]) -> list[dict]:
        """Generate recommendations for load shedding using AI/SHAP."""
        excess_kw = self._current_total_kw - self._peak_threshold_kw
        recommendations = []
        
        now = datetime.now(timezone.utc)
        hour = now.hour
        is_weekend = 1 if now.weekday() >= 5 else 0
        outdoor_temp = 25 + 10 * math.sin((hour - 14) * math.pi / 12)
        season_encoded = 1

        for alloc in allocations:
            if excess_kw <= 0:
                break
                
            # Ask the ML model for SHAP-based reasons and recommendations
            ai_recs = generate_recommendation(
                outdoor_temp=outdoor_temp,
                season_encoded=season_encoded,
                hour=hour,
                is_weekend=is_weekend,
                prev_energy=alloc["power_kw"],
                appliance_type=alloc["device_type"],
                household_size=3
            )
            
            for ai_rec in ai_recs:
                if excess_kw <= 0:
                    break
                # Enhance the AI recommendation with specific action context
                ai_rec["device_id"] = alloc["device_id"]
                ai_rec["device_name"] = alloc["device_name"]
                ai_rec["action"] = "power_off"
                recommendations.append(ai_rec)
                savings_w = ai_rec.get("potential_savings_w", 0)
                ai_rec["potential_savings_kw"] = round(savings_w / 1000.0, 3)
                excess_kw -= ai_rec["potential_savings_kw"]

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
