from collections import defaultdict
from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, channel: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[channel].add(websocket)

    def disconnect(self, channel: str, websocket: WebSocket) -> None:
        self._connections[channel].discard(websocket)

    async def broadcast(self, channel: str, payload: dict) -> None:
        disconnected: list[WebSocket] = []
        for websocket in self._connections[channel]:
            try:
                await websocket.send_json(payload)
            except RuntimeError:
                disconnected.append(websocket)
        for websocket in disconnected:
            self.disconnect(channel, websocket)

    async def alert_admins(self, payload: dict) -> None:
        await self.broadcast("admins", {"type": "security_alert", "payload": payload})

    async def notify_user(self, user_id: UUID, payload: dict) -> None:
        await self.broadcast(f"user:{user_id}", payload)


manager = ConnectionManager()
