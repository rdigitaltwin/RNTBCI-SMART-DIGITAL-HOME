"""RNTBCI Smart Home Digital Twin - MQTT Client.

Bridges MQTT messages with the Redis PubSub system.
"""

from __future__ import annotations
import asyncio
import json
import logging

from backend.config import get_settings
from backend.redis.client import redis_client

logger = logging.getLogger(__name__)
settings = get_settings()


class MQTTClient:
    """MQTT client that bridges device messages to Redis PubSub."""

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        """Start the MQTT client."""
        self._running = True
        self._task = asyncio.create_task(self._connect_loop())
        logger.info("MQTT client starting")

    async def stop(self) -> None:
        """Stop the MQTT client."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("MQTT client stopped")

    async def _connect_loop(self) -> None:
        """Connection loop with automatic reconnection."""
        while self._running:
            try:
                import aiomqtt

                async with aiomqtt.Client(
                    hostname=settings.mqtt_broker_host,
                    port=settings.mqtt_broker_port,
                ) as client:
                    logger.info("MQTT connected to %s:%d", settings.mqtt_broker_host, settings.mqtt_broker_port)

                    # Subscribe to device topics
                    await client.subscribe("home/devices/+/state")
                    await client.subscribe("home/devices/+/command")
                    await client.subscribe("home/system/#")

                    async for message in client.messages:
                        await self._handle_message(message)

            except ImportError:
                logger.warning("aiomqtt not available, MQTT integration disabled")
                break
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning("MQTT connection lost: %s. Reconnecting in 5s...", str(e))
                await asyncio.sleep(5)

    async def _handle_message(self, message) -> None:
        """Handle an incoming MQTT message by forwarding to Redis PubSub."""
        try:
            topic = str(message.topic)
            payload = json.loads(message.payload.decode())

            # Extract device ID from topic
            parts = topic.split("/")
            if len(parts) >= 4 and parts[0] == "home" and parts[1] == "devices":
                device_id = parts[2]
                msg_type = parts[3]

                if msg_type == "state":
                    await redis_client.publish_device_update(device_id, payload)
                elif msg_type == "command":
                    await redis_client.publish(f"device:{device_id}:command", payload)

            logger.debug("MQTT message processed: %s", topic)
        except Exception as e:
            logger.error("MQTT message handling error: %s", str(e))

    async def publish(self, topic: str, payload: dict) -> None:
        """Publish a message to an MQTT topic."""
        try:
            import aiomqtt

            async with aiomqtt.Client(
                hostname=settings.mqtt_broker_host,
                port=settings.mqtt_broker_port,
            ) as client:
                await client.publish(topic, json.dumps(payload).encode())
        except ImportError:
            logger.warning("aiomqtt not available for publishing")
        except Exception as e:
            logger.error("MQTT publish error: %s", str(e))


# Singleton
mqtt_client = MQTTClient()
