"""Root URL configuration. Every API route lives under /api/."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(request):
    """Plain 200 for Render's health check. Touches no database on purpose."""
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("health/", health),
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("care.urls")),
    path("api/messaging/", include("messaging.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/integrations/", include("integrations.urls")),
    path("api/reports/", include("reports.urls")),
]

# Serve uploaded referral and clinical documents in development.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
