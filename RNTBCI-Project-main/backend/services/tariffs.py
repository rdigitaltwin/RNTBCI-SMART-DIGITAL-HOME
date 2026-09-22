"""RNTBCI Smart Home Digital Twin - Dynamic Tariff Service.

Manages time-of-use (TOU) and dynamic pricing structures.
"""

from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class TariffService:
    def __init__(self):
        # Default TOU structure (USD per kWh)
        self._rates = {
            "off_peak": 0.08,    # 10 PM - 6 AM
            "mid_peak": 0.12,    # 6 AM - 2 PM, 6 PM - 10 PM
            "on_peak": 0.18,     # 2 PM - 6 PM
        }

    def get_current_period(self) -> str:
        """Determine current electricity tariff period."""
        hour = datetime.now(timezone.utc).hour
        if 22 <= hour or hour < 6:
            return "off_peak"
        elif 14 <= hour < 18:
            return "on_peak"
        return "mid_peak"

    def get_current_rate(self) -> float:
        """Get the current price per kWh."""
        return self._rates[self.get_current_period()]

    def get_average_rate(self) -> float:
        """Get average rate for estimations."""
        return sum(self._rates.values()) / len(self._rates)

    def fetch_dynamic_pricing(self):
        """Placeholder for external API integration (e.g. Octopus Energy, Tibber)."""
        pass

tariff_service = TariffService()
