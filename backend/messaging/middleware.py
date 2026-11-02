"""Authenticate WebSocket connections with the same JWT the API uses.
The frontend passes it as ?token=<access token> on the socket URL."""
from urllib.parse import parse_qs

from accounts.models import User
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def get_user_from_token(token):
    try:
        payload = AccessToken(token)
        return User.objects.get(id=payload["user_id"])
    except Exception:  # noqa: BLE001
        return AnonymousUser()


class JWTAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        token = (query.get("token") or [""])[0]
        scope["user"] = await get_user_from_token(token) if token else AnonymousUser()
        return await self.inner(scope, receive, send)
