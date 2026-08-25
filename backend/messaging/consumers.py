"""
One WebSocket per signed in user. The socket joins the group user_<id> and
receives both chat messages and notifications pushed by the backend.
"""
import json

from channels.generic.websocket import AsyncWebsocketConsumer


class UserStreamConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if user is None or user.is_anonymous:
            await self.close()
            return
        self.group_name = f"user_{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def push(self, event):
        await self.send(text_data=json.dumps(event["payload"]))
