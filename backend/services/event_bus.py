"""
Event Bus for real-time WebSocket state synchronization.
Maintains active connections, broadcasts structured events, and supports safe async delivery.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import asyncio
from fastapi import WebSocket


class EventBus:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def broadcast(self, event_type: str, data: Optional[Dict[str, Any]] = None):
        """
        Broadcast structured event to all active WebSocket clients.
        Payload format:
        {
            "event_type": "TASK_UPDATED",
            "data": {...},
            "timestamp": "2026-09-23T12:00:00Z"
        }
        """
        payload = {
            "event_type": event_type,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        async with self._lock:
            dead_connections = []
            for connection in self.active_connections:
                try:
                    await connection.send_json(payload)
                except Exception:
                    dead_connections.append(connection)

            for dead in dead_connections:
                if dead in self.active_connections:
                    self.active_connections.remove(dead)

    def broadcast_sync(self, event_type: str, data: Optional[Dict[str, Any]] = None):
        """
        Synchronous wrapper to broadcast events from sync route handlers or background worker threads.
        """
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.broadcast(event_type, data))
        except RuntimeError:
            # If no running event loop in thread, run in new loop
            try:
                asyncio.run(self.broadcast(event_type, data))
            except Exception:
                pass


event_bus = EventBus()
