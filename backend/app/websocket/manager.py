from fastapi import WebSocket
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections per user and routes messages to conversations."""

    def __init__(self):
        # user_id -> WebSocket connection
        self.active_connections: dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"User {user_id} connected. Total: {len(self.active_connections)}")

    def disconnect(self, user_id: int):
        self.active_connections.pop(user_id, None)
        logger.info(f"User {user_id} disconnected. Total: {len(self.active_connections)}")

    def is_online(self, user_id: int) -> bool:
        return user_id in self.active_connections

    async def send_personal(self, user_id: int, message: dict):
        ws = self.active_connections.get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to user {user_id}: {e}")
                self.disconnect(user_id)

    async def send_to_conversation(self, member_ids: list[int], message: dict, exclude_user_id: int | None = None):
        """Send a message to all online members of a conversation."""
        for member_id in member_ids:
            if exclude_user_id and member_id == exclude_user_id:
                continue
            await self.send_personal(member_id, message)

    async def broadcast_presence(self, user_id: int, is_online: bool, contact_ids: list[int]):
        """Notify contacts about user's online/offline status."""
        message = {
            "type": "presence.update",
            "data": {
                "user_id": user_id,
                "is_online": is_online,
            }
        }
        for contact_id in contact_ids:
            await self.send_personal(contact_id, message)


# Singleton instance
manager = ConnectionManager()
