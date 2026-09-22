"""RNTBCI Smart Home Digital Twin - Controller Hub Abstraction.

Central integration layer routing all device commands through adapters.
Supports Alexa, Google Home, HomeAssistant, HEMS, MQTT, and REST adapters.
"""

from __future__ import annotations
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

from backend.redis.client import redis_client

logger = logging.getLogger(__name__)


class DeviceAdapter(ABC):
    """Base adapter interface for all integration protocols."""

    @abstractmethod
    async def send_command(self, device_id: str, command: str, params: dict) -> dict:
        """Send a command to a device through this adapter."""
        pass

    @abstractmethod
    async def get_state(self, device_id: str) -> dict:
        """Get device state through this adapter."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Adapter name."""
        pass


class RESTAdapter(DeviceAdapter):
    """Direct REST API adapter — the primary control path."""

    @property
    def name(self) -> str:
        return "REST"

    async def send_command(self, device_id: str, command: str, params: dict) -> dict:
        """Send command via internal API."""
        await redis_client.publish(f"device:{device_id}:command", {
            "command": command,
            "params": params,
            "adapter": self.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return {"status": "sent", "adapter": self.name}

    async def get_state(self, device_id: str) -> dict:
        state = await redis_client.get_device_state(device_id)
        return state or {}


class MQTTAdapter(DeviceAdapter):
    """MQTT protocol adapter."""

    @property
    def name(self) -> str:
        return "MQTT"

    async def send_command(self, device_id: str, command: str, params: dict) -> dict:
        await redis_client.publish(f"mqtt:device:{device_id}:command", {
            "command": command,
            "params": params,
            "adapter": self.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return {"status": "sent", "adapter": self.name}

    async def get_state(self, device_id: str) -> dict:
        state = await redis_client.get_device_state(device_id)
        return state or {}


class AlexaAdapter(DeviceAdapter):
    """Amazon Alexa integration adapter (interface ready)."""

    @property
    def name(self) -> str:
        return "Alexa"

    async def send_command(self, device_id: str, command: str, params: dict) -> dict:
        # Translates to Alexa Smart Home Skill API format
        alexa_directive = {
            "directive": {
                "header": {"namespace": "Alexa.PowerController", "name": command},
                "endpoint": {"endpointId": device_id},
                "payload": params,
            },
            "adapter": self.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await redis_client.publish("adapter:alexa:commands", alexa_directive)
        return {"status": "sent", "adapter": self.name, "format": "alexa_directive"}

    async def get_state(self, device_id: str) -> dict:
        state = await redis_client.get_device_state(device_id)
        return state or {}


class GoogleHomeAdapter(DeviceAdapter):
    """Google Home integration adapter (interface ready)."""

    @property
    def name(self) -> str:
        return "GoogleHome"

    async def send_command(self, device_id: str, command: str, params: dict) -> dict:
        google_command = {
            "requestId": device_id,
            "inputs": [{"intent": "action.devices.EXECUTE", "payload": {
                "commands": [{"devices": [{"id": device_id}],
                              "execution": [{"command": f"action.devices.commands.{command}", "params": params}]}]
            }}],
            "adapter": self.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await redis_client.publish("adapter:google:commands", google_command)
        return {"status": "sent", "adapter": self.name, "format": "google_home"}

    async def get_state(self, device_id: str) -> dict:
        state = await redis_client.get_device_state(device_id)
        return state or {}


class HomeAssistantAdapter(DeviceAdapter):
    """Home Assistant integration adapter (interface ready)."""

    @property
    def name(self) -> str:
        return "HomeAssistant"

    async def send_command(self, device_id: str, command: str, params: dict) -> dict:
        ha_service_call = {
            "domain": "switch" if command in ("on", "off") else "light",
            "service": f"turn_{command}" if command in ("on", "off") else command,
            "service_data": {"entity_id": f"switch.{device_id}", **params},
            "adapter": self.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await redis_client.publish("adapter:ha:commands", ha_service_call)
        return {"status": "sent", "adapter": self.name, "format": "home_assistant"}

    async def get_state(self, device_id: str) -> dict:
        state = await redis_client.get_device_state(device_id)
        return state or {}


class HEMSAdapter(DeviceAdapter):
    """HEMS (Home Energy Management System) adapter."""

    @property
    def name(self) -> str:
        return "HEMS"

    async def send_command(self, device_id: str, command: str, params: dict) -> dict:
        hems_command = {
            "device_id": device_id,
            "command": command,
            "params": params,
            "priority": params.get("priority", "normal"),
            "energy_context": True,
            "adapter": self.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await redis_client.publish("adapter:hems:commands", hems_command)
        return {"status": "sent", "adapter": self.name, "format": "hems"}

    async def get_state(self, device_id: str) -> dict:
        state = await redis_client.get_device_state(device_id)
        return state or {}


class ControllerHub:
    """Central hub routing all device commands through appropriate adapters.

    Architecture:
        Devices → Controller Hub → Digital Twin → Dashboard → HEMS
    """

    def __init__(self) -> None:
        self._adapters: dict[str, DeviceAdapter] = {}
        self._default_adapter: str = "REST"
        self._command_log: list[dict] = []

        # Register all adapters
        self.register_adapter(RESTAdapter())
        self.register_adapter(MQTTAdapter())
        self.register_adapter(AlexaAdapter())
        self.register_adapter(GoogleHomeAdapter())
        self.register_adapter(HomeAssistantAdapter())
        self.register_adapter(HEMSAdapter())

    def register_adapter(self, adapter: DeviceAdapter) -> None:
        """Register a device adapter."""
        self._adapters[adapter.name] = adapter
        logger.info("Adapter registered: %s", adapter.name)

    @property
    def adapters(self) -> list[str]:
        """List all registered adapter names."""
        return list(self._adapters.keys())

    async def send_command(
        self,
        device_id: str,
        command: str,
        params: dict,
        adapter_name: str | None = None,
    ) -> dict:
        """Route a command through the specified adapter (or default)."""
        adapter_key = adapter_name or self._default_adapter
        adapter = self._adapters.get(adapter_key)

        if not adapter:
            raise ValueError(f"Adapter not found: {adapter_key}")

        result = await adapter.send_command(device_id, command, params)

        # Log command
        log_entry = {
            "device_id": device_id,
            "command": command,
            "adapter": adapter_key,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "result": result,
        }
        self._command_log.append(log_entry)
        if len(self._command_log) > 1000:
            self._command_log = self._command_log[-500:]

        return result

    async def get_state(self, device_id: str, adapter_name: str | None = None) -> dict:
        """Get device state through an adapter."""
        adapter_key = adapter_name or self._default_adapter
        adapter = self._adapters.get(adapter_key)
        if not adapter:
            raise ValueError(f"Adapter not found: {adapter_key}")
        return await adapter.get_state(device_id)

    @property
    def command_history(self) -> list[dict]:
        """Get recent command history."""
        return list(reversed(self._command_log[-50:]))


# Singleton
controller_hub = ControllerHub()
