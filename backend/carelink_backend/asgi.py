"""ASGI entry point. Serves HTTP through Django and WebSockets through Channels."""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "carelink_backend.settings")
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from messaging.middleware import JWTAuthMiddleware  # noqa: E402
import messaging.routing  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(URLRouter(messaging.routing.websocket_urlpatterns)),
    }
)
