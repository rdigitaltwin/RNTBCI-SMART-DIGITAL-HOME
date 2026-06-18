"""RNTBCI Smart Home Digital Twin - Data Analysis Pipeline.

Monitoring → Data Acquisition → Processing → Analysis → Optimization →
Simulation Step → Reward Calculation → Actions.
"""

import logging
import math
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import async_session_factory
from backend.models import Device, DeviceEvent, DeviceType, EnergyHistory, PowerState
from backend.redis.client import redis_client

logger = logging.getLogger(__name__)


class DataCollector:
    """Collects and buffers device telemetry data."""

    def __init__(self, buffer_size: int = 1000) -> None:
        self._buffer: list[dict] = []
        self._buffer_size = buffer_size

    def collect(self, data: dict) -> None:
        self._buffer.append({**data, "collected_at": datetime.now(timezone.utc).isoformat()})
        if len(self._buffer) > self._buffer_size:
            self._buffer = self._buffer[-self._buffer_size:]

    @property
    def buffer(self) -> list[dict]:
        return list(self._buffer)

    def flush(self) -> list[dict]:
        data = list(self._buffer)
        self._buffer.clear()
        return data


class StateProcessor:
    """Processes raw device states into normalized features."""

    def process(self, devices: list[dict]) -> dict[str, Any]:
        if not devices:
            return {"total_power_w": 0, "device_count": 0}

        powers = [d.get("power_w", 0) for d in devices]
        return {
            "total_power_w": sum(powers),
            "average_power_w": statistics.mean(powers) if powers else 0,
            "max_power_w": max(powers) if powers else 0,
            "min_power_w": min(powers) if powers else 0,
            "std_power_w": statistics.stdev(powers) if len(powers) > 1 else 0,
            "device_count": len(devices),
            "active_count": sum(1 for p in powers if p > 0),
            "idle_count": sum(1 for p in powers if p == 0),
        }


class AnalyticsEngine:
    """Runs analytics on processed device data."""

    def __init__(self) -> None:
        self._history: list[dict] = []
        self._anomaly_threshold: float = 2.0  # standard deviations

    def analyze(self, processed: dict) -> dict[str, Any]:
        self._history.append({**processed, "timestamp": datetime.now(timezone.utc).isoformat()})
        if len(self._history) > 3600:  # Keep 1 hour at 1/sec
            self._history = self._history[-3600:]

        result = {**processed}

        # Trend analysis
        if len(self._history) >= 10:
            recent = [h["total_power_w"] for h in self._history[-10:]]
            older = [h["total_power_w"] for h in self._history[-20:-10]] if len(self._history) >= 20 else recent

            result["trend"] = "increasing" if statistics.mean(recent) > statistics.mean(older) * 1.05 else \
                             "decreasing" if statistics.mean(recent) < statistics.mean(older) * 0.95 else "stable"

            # Anomaly detection
            if len(self._history) >= 60:
                all_powers = [h["total_power_w"] for h in self._history[-60:]]
                mean_p = statistics.mean(all_powers)
                std_p = statistics.stdev(all_powers) if len(all_powers) > 1 else 0
                current = processed["total_power_w"]

                if std_p > 0 and abs(current - mean_p) > self._anomaly_threshold * std_p:
                    result["anomaly"] = True
                    result["anomaly_score"] = round(abs(current - mean_p) / std_p, 2)
                else:
                    result["anomaly"] = False
        else:
            result["trend"] = "insufficient_data"
            result["anomaly"] = False

        return result


class OptimizationEngine:
    """Generates optimization recommendations."""

    def optimize(self, analysis: dict) -> list[dict]:
        recommendations = []

        if analysis.get("total_power_w", 0) > 6000:
            recommendations.append({
                "type": "load_reduction",
                "priority": "high",
                "message": "Total power exceeds 6kW threshold. Consider reducing non-essential loads.",
                "potential_savings_w": analysis["total_power_w"] - 5000,
            })

        if analysis.get("anomaly"):
            recommendations.append({
                "type": "anomaly_alert",
                "priority": "medium",
                "message": f"Anomalous power usage detected (score: {analysis.get('anomaly_score', 0)})",
            })

        if analysis.get("trend") == "increasing":
            recommendations.append({
                "type": "trend_alert",
                "priority": "low",
                "message": "Power consumption trending upward. Monitor for efficiency degradation.",
            })

        if analysis.get("idle_count", 0) > analysis.get("device_count", 1) * 0.7:
            recommendations.append({
                "type": "efficiency",
                "priority": "low",
                "message": "Many devices idle. Consider powering off unused devices.",
            })

        return recommendations


class RewardEngine:
    """Calculates reward signals for optimization decisions."""

    def __init__(self) -> None:
        self._baseline_power_w: float = 3000
        self._target_cost_daily: float = 5.0

    def calculate(self, analysis: dict, cost_today: float) -> dict[str, float]:
        power = analysis.get("total_power_w", 0)

        # Power efficiency reward (-1 to 1)
        power_ratio = power / self._baseline_power_w if self._baseline_power_w > 0 else 1
        power_reward = max(-1, min(1, 1 - power_ratio))

        # Cost reward
        hour = datetime.now(timezone.utc).hour
        expected_cost = self._target_cost_daily * (hour / 24)
        cost_ratio = cost_today / expected_cost if expected_cost > 0 else 1
        cost_reward = max(-1, min(1, 1 - cost_ratio))

        # Comfort reward (devices operational)
        active_ratio = analysis.get("active_count", 0) / max(analysis.get("device_count", 1), 1)
        comfort_reward = active_ratio * 0.5  # Moderate weight

        # Combined reward
        total_reward = 0.4 * power_reward + 0.4 * cost_reward + 0.2 * comfort_reward

        return {
            "power_reward": round(power_reward, 3),
            "cost_reward": round(cost_reward, 3),
            "comfort_reward": round(comfort_reward, 3),
            "total_reward": round(total_reward, 3),
        }


class DecisionEngine:
    """Makes automated decisions based on analysis and rewards."""

    def decide(self, analysis: dict, rewards: dict, recommendations: list[dict]) -> list[dict]:
        actions = []

        # Auto-optimize if reward is negative
        if rewards.get("total_reward", 0) < -0.3:
            high_priority_recs = [r for r in recommendations if r["priority"] == "high"]
            for rec in high_priority_recs:
                actions.append({
                    "action": "auto_optimize",
                    "reason": rec["message"],
                    "confidence": min(0.9, abs(rewards["total_reward"])),
                })

        # Auto-respond to anomalies
        if analysis.get("anomaly"):
            actions.append({
                "action": "investigate_anomaly",
                "reason": f"Power anomaly detected (score: {analysis.get('anomaly_score', 0)})",
                "confidence": 0.7,
            })

        return actions


class DataPipeline:
    """Complete data analysis pipeline.

    Flow: Monitoring → Acquisition → Processing → Analysis →
          Optimization → Reward → Decision → Actions
    """

    def __init__(self) -> None:
        self.collector = DataCollector()
        self.processor = StateProcessor()
        self.analytics = AnalyticsEngine()
        self.optimizer = OptimizationEngine()
        self.reward_engine = RewardEngine()
        self.decision_engine = DecisionEngine()
        self._last_result: dict = {}

    @property
    def last_result(self) -> dict:
        return self._last_result

    async def run_cycle(self) -> dict[str, Any]:
        """Run one complete pipeline cycle."""
        async with async_session_factory() as db:
            try:
                # Step 1: Data Acquisition
                result = await db.execute(select(Device))
                devices = result.scalars().all()

                device_data = []
                for d in devices:
                    power_state = d.power_state if isinstance(d.power_state, PowerState) else PowerState(d.power_state)
                    power_w = d.energy_usage_kw * 1000 if power_state != PowerState.OFF else 0
                    device_data.append({
                        "device_id": str(d.id),
                        "device_name": d.name,
                        "device_type": d.type.value if hasattr(d.type, "value") else d.type,
                        "power_w": power_w,
                        "power_state": power_state.value,
                    })

                # Step 2: Processing
                processed = self.processor.process(device_data)

                # Step 3: Analysis
                analysis = self.analytics.analyze(processed)

                # Step 4: Optimization
                recommendations = self.optimizer.optimize(analysis)

                # Step 5: Reward Calculation
                from backend.services.hems import energy_manager
                rewards = self.reward_engine.calculate(analysis, energy_manager._total_cost_today)

                # Step 6: Decision
                actions = self.decision_engine.decide(analysis, rewards, recommendations)

                # Compile result
                pipeline_result = {
                    "devices": device_data,
                    "processed": processed,
                    "analysis": analysis,
                    "recommendations": recommendations,
                    "rewards": rewards,
                    "actions": actions,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

                self._last_result = pipeline_result

                # Publish
                await redis_client.publish("system:pipeline", pipeline_result)

                return pipeline_result

            except Exception as e:
                logger.error("Pipeline cycle error: %s", str(e))
                return {"error": str(e)}


# Singleton
data_pipeline = DataPipeline()
