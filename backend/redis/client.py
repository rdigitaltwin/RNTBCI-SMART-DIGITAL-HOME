"""RNTBCI Smart Home Digital Twin - Redis Client.

Handles Redis connections, PubSub, and token blacklist management.
"""

from __future__ import annotations
import json
import logging
from datetime import timedelta

import redis.asyncio as aioredis

from backend.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class RedisClient:
    """Async Redis client wrapper for the platform."""

    def __init__(self) -> None:
        self._redis: aioredis.Redis | None = None
        self._pubsub: aioredis.client.PubSub | None = None

    async def connect(self) -> None:
        """Connect to Redis."""
        self._redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
        try:
            await self._redis.ping()
            logger.info("Redis connected successfully")
        except Exception as e:
            logger.warning("Redis connection failed: %s. Operating without Redis.", str(e))
            self._redis = None

    async def disconnect(self) -> None:
        """Disconnect from Redis."""
        if self._pubsub:
            await self._pubsub.close()
        if self._redis:
            await self._redis.close()
            logger.info("Redis disconnected")

    @property
    def is_connected(self) -> bool:
        """Check if Redis is connected."""
        return self._redis is not None

    # =========================================================================
    # TOKEN BLACKLIST (for JWT logout)
    # =========================================================================

    async def blacklist_token(self, jti: str, expires_in: int) -> None:
        """Add a JWT token ID to the blacklist.

        Args:
            jti: JWT token identifier (from 'jti' claim).
            expires_in: Seconds until the token would naturally expire.
        """
        if not self._redis:
            return
        await self._redis.setex(
            f"blacklist:{jti}",
            timedelta(seconds=expires_in),
            "1",
        )

    async def is_token_blacklisted(self, jti: str) -> bool:
        """Check if a JWT token has been blacklisted."""
        if not self._redis:
            return False
        result = await self._redis.get(f"blacklist:{jti}")
        return result is not None

    # =========================================================================
    # PUBSUB
    # =========================================================================

    async def publish(self, channel: str, data: dict) -> None:
        """Publish a message to a Redis PubSub channel."""
        if not self._redis:
            return
        message = json.dumps(data, default=str)
        await self._redis.publish(channel, message)

    async def subscribe(self, *channels: str) -> aioredis.client.PubSub:
        """Subscribe to Redis PubSub channels."""
        if not self._redis:
            raise ConnectionError("Redis not connected")
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(*channels)
        return pubsub

    # =========================================================================
    # CACHING
    # =========================================================================

    async def set_cache(self, key: str, value: dict, ttl: int = 300) -> None:
        """Set a cached value with TTL."""
        if not self._redis:
            return
        await self._redis.setex(key, ttl, json.dumps(value, default=str))

    async def get_cache(self, key: str) -> dict | None:
        """Get a cached value."""
        if not self._redis:
            return None
        data = await self._redis.get(key)
        if data:
            return json.loads(data)
        return None

    async def delete_cache(self, key: str) -> None:
        """Delete a cached value."""
        if not self._redis:
            return
        await self._redis.delete(key)

    # =========================================================================
    # DEVICE STATE
    # =========================================================================

    async def set_device_state(self, device_id: str, state: dict) -> None:
        """Cache current device state in Redis."""
        await self.set_cache(f"device_state:{device_id}", state, ttl=60)

    async def get_device_state(self, device_id: str) -> dict | None:
        """Get cached device state."""
        return await self.get_cache(f"device_state:{device_id}")

    async def publish_device_update(self, device_id: str, data: dict) -> None:
        """Publish a device state update via PubSub."""
        await self.publish(f"device:{device_id}:state", data)
        await self.publish("device:updates", {**data, "device_id": device_id})

    async def publish_event(self, event_data: dict) -> None:
        """Publish a device event via PubSub."""
        await self.publish("events:stream", event_data)

    async def publish_alert(self, alert_data: dict) -> None:
        """Publish an alert via PubSub."""
        await self.publish("system:alerts", alert_data)


# Singleton instance
redis_client = RedisClient()
