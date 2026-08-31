"""RNTBCI Smart Home Digital Twin - WebSocket Manager.

Handles WebSocket connections, authentication, subscriptions, and message broadcasting.
"""

from __future__ import annotations
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import WebSocket, WebSocketDisconnect
from jose import JWTError

from backend.auth.jwt_handler import decode_token
from backend.redis.client import redis_client

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and message broadcasting."""

    def __init__(self) -> None:
        # Map of connection_id -> WebSocket
        self._connections: dict[str, WebSocket] = {}
        # Map of connection_id -> user_id
        self._user_connections: dict[str, str] = {}
        # Map of channel -> set of connection_ids
        self._subscriptions: dict[str, set[str]] = {}
        # Set of processed event IDs for deduplication
        self._processed_events: set[str] = set()
        self._max_processed_events = 10000
        # Background tasks
        self._heartbeat_task: asyncio.Task | None = None
        self._redis_listener_task: asyncio.Task | None = None

    @property
    def active_connections(self) -> int:
        """Return count of active connections."""
        return len(self._connections)

    async def start(self) -> None:
        """Start background tasks for heartbeat and Redis listening."""
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        if redis_client.is_connected:
            self._redis_listener_task = asyncio.create_task(self._redis_listener())
        logger.info("WebSocket manager started")

    async def stop(self) -> None:
        """Stop background tasks and close all connections."""
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
        if self._redis_listener_task:
            self._redis_listener_task.cancel()

        for conn_id in list(self._connections.keys()):
            await self.disconnect(conn_id)

        logger.info("WebSocket manager stopped")

    async def connect(self, websocket: WebSocket, token: str | None = None) -> str | None:
        """Accept a WebSocket connection and optionally authenticate.

        Returns:
            Connection ID if successful, None if auth fails.
        """
        await websocket.accept()
        conn_id = str(uuid.uuid4())

        # Authenticate if token provided
        user_id = None
        if token:
            try:
                payload = decode_token(token)
                if payload.get("type") == "access":
                    user_id = payload.get("sub")
            except JWTError:
                await websocket.send_json({
                    "type": "error",
                    "payload": {"message": "Invalid authentication token"},
                })
                await websocket.close(code=4001, reason="Authentication failed")
                return None

        self._connections[conn_id] = websocket
        if user_id:
            self._user_connections[conn_id] = user_id

        # Auto-subscribe to global channels
        await self._subscribe(conn_id, "device:updates")
        await self._subscribe(conn_id, "events:stream")
        await self._subscribe(conn_id, "system:alerts")
        await self._subscribe(conn_id, "system:metrics")
        await self._subscribe(conn_id, "system:hems")
        await self._subscribe(conn_id, "system:pipeline")
        await self._subscribe(conn_id, "system:replay")

        # Send welcome message
        await self._send(conn_id, {
            "type": "connected",
            "payload": {
                "connection_id": conn_id,
                "authenticated": user_id is not None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        })

        logger.info("WebSocket connected: %s (authenticated: %s)", conn_id, user_id is not None)
        return conn_id

    async def disconnect(self, conn_id: str) -> None:
        """Close and clean up a WebSocket connection."""
        # Remove from subscriptions
        for channel in list(self._subscriptions.keys()):
            self._subscriptions[channel].discard(conn_id)
            if not self._subscriptions[channel]:
                del self._subscriptions[channel]

        # Remove connection
        self._user_connections.pop(conn_id, None)
        websocket = self._connections.pop(conn_id, None)

        if websocket:
            try:
                await websocket.close()
            except Exception:
                pass

        logger.info("WebSocket disconnected: %s", conn_id)

    async def handle_message(self, conn_id: str, data: str) -> None:
        """Handle an incoming WebSocket message.

        Supported message types:
        - subscribe: Subscribe to a channel
        - unsubscribe: Unsubscribe from a channel
        - ping: Heartbeat response
        - device_control: Forward control command
        """
        try:
            message = json.loads(data)
        except json.JSONDecodeError:
            await self._send(conn_id, {
                "type": "error",
                "payload": {"message": "Invalid JSON"},
            })
            return

        msg_type = message.get("type")

        if msg_type == "subscribe":
            channel = message.get("payload", {}).get("channel")
            if channel:
                await self._subscribe(conn_id, channel)
                await self._send(conn_id, {
                    "type": "subscribed",
                    "payload": {"channel": channel},
                })

        elif msg_type == "unsubscribe":
            channel = message.get("payload", {}).get("channel")
            if channel:
                self._subscriptions.get(channel, set()).discard(conn_id)
                await self._send(conn_id, {
                    "type": "unsubscribed",
                    "payload": {"channel": channel},
                })

        elif msg_type == "pong":
            pass  # Heartbeat acknowledged

        elif msg_type == "device_control":
            # Forward to Redis for processing
            await redis_client.publish("device:commands", message.get("payload", {}))

    async def broadcast(self, channel: str, data: dict) -> None:
        """Broadcast a message to all subscribers of a channel.

        Includes event deduplication by event_id.
        """
        event_id = data.get("event_id", str(uuid.uuid4()))

        # Deduplication
        if event_id in self._processed_events:
            return
        self._processed_events.add(event_id)

        # Trim processed events set
        if len(self._processed_events) > self._max_processed_events:
            # Remove oldest half
            to_remove = list(self._processed_events)[:self._max_processed_events // 2]
            for item in to_remove:
                self._processed_events.discard(item)

        subscribers = self._subscriptions.get(channel, set())
        message = {
            "type": "update",
            "channel": channel,
            "payload": data,
            "event_id": event_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        disconnected = []
        for conn_id in subscribers:
            try:
                await self._send(conn_id, message)
            except Exception:
                disconnected.append(conn_id)

        # Clean up disconnected clients
        for conn_id in disconnected:
            await self.disconnect(conn_id)

    async def _send(self, conn_id: str, data: dict) -> None:
        """Send a message to a specific connection."""
        websocket = self._connections.get(conn_id)
        if websocket:
            await websocket.send_json(data)

    async def _subscribe(self, conn_id: str, channel: str) -> None:
        """Subscribe a connection to a channel."""
        if channel not in self._subscriptions:
            self._subscriptions[channel] = set()
        self._subscriptions[channel].add(conn_id)

    async def _heartbeat_loop(self) -> None:
        """Send heartbeat pings every 30 seconds."""
        while True:
            try:
                await asyncio.sleep(30)
                disconnected = []
                for conn_id, websocket in list(self._connections.items()):
                    try:
                        await websocket.send_json({"type": "ping"})
                    except Exception:
                        disconnected.append(conn_id)

                for conn_id in disconnected:
                    await self.disconnect(conn_id)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Heartbeat error: %s", str(e))

    async def _redis_listener(self) -> None:
        """Listen to Redis PubSub and broadcast to WebSocket clients."""
        try:
            pubsub = await redis_client.subscribe(
                "device:updates",
                "events:stream",
                "system:alerts",
                "system:metrics",
                "system:hems",
                "system:pipeline",
                "system:replay",
            )

            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        channel = message["channel"]
                        await self.broadcast(channel, data)
                    except (json.JSONDecodeError, Exception) as e:
                        logger.error("Redis listener error: %s", str(e))

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("Redis listener fatal error: %s", str(e))


# Singleton instance
ws_manager = ConnectionManager()
