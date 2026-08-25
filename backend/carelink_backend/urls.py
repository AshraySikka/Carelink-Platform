"""Root URL configuration. Every API route lives under /api/."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("care.urls")),
    path("api/messaging/", include("messaging.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/integrations/", include("integrations.urls")),
]

# Serve uploaded referral and clinical documents in development.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
