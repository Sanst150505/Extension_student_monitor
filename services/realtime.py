"""Realtime websocket connection management for student telemetry."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class RealtimeHub:
    def __init__(self) -> None:
        self.teacher_connections: dict[str, set[WebSocket]] = defaultdict(set)
        self.latest_by_meet_link: dict[str, dict[str, Any]] = {}

    def _key(self, meet_link: str | None) -> str:
        value = (meet_link or "unassigned").strip()
        return value or "unassigned"

    async def connect_teacher(self, websocket: WebSocket, meet_link: str | None) -> str:
        key = self._key(meet_link)
        await websocket.accept()
        self.teacher_connections[key].add(websocket)
        return key

    def disconnect_teacher(self, websocket: WebSocket, meet_link: str | None) -> None:
        key = self._key(meet_link)
        sockets = self.teacher_connections.get(key)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self.teacher_connections.pop(key, None)

    async def broadcast_teacher(self, meet_link: str | None, payload: dict[str, Any]) -> None:
        key = self._key(meet_link)
        self.latest_by_meet_link[key] = payload

        sockets = list(self.teacher_connections.get(key, set()))
        if not sockets:
            return

        alive_sockets: set[WebSocket] = set()
        for socket in sockets:
            try:
                await socket.send_json(payload)
                alive_sockets.add(socket)
            except Exception:
                continue

        if alive_sockets:
            self.teacher_connections[key] = alive_sockets
        else:
            self.teacher_connections.pop(key, None)

    def get_latest(self, meet_link: str | None) -> dict[str, Any] | None:
        return self.latest_by_meet_link.get(self._key(meet_link))


realtime_hub = RealtimeHub()