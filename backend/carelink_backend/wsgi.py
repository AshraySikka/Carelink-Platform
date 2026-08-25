"""WSGI entry point. Not used on Render because WebSockets need ASGI, kept for completeness."""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "carelink_backend.settings")
application = get_wsgi_application()
