"""Notification feed and per category preference settings."""
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import NOTIFICATION_CATEGORIES, Notification, NotificationPreference
from .utils import ensure_default_preferences


@api_view(["GET"])
def list_view(request):
    qs = Notification.objects.filter(user=request.user)[:50]
    return Response([
        {"id": n.id, "category": n.category, "title": n.title, "body": n.body,
         "link": n.link, "read": n.read, "created_at": n.created_at}
        for n in qs
    ])


@api_view(["POST"])
def mark_read_view(request):
    """Mark specific ids read, or everything when ids is omitted."""
    ids = request.data.get("ids")
    qs = Notification.objects.filter(user=request.user)
    if ids:
        qs = qs.filter(id__in=ids)
    qs.update(read=True)
    return Response({"ok": True})


@api_view(["GET", "PATCH"])
def preferences_view(request):
    """Read or update the caller's notification settings panel."""
    ensure_default_preferences(request.user)
    if request.method == "PATCH":
        # Body shape: {"messages": true, "referrals": false, ...}
        for category, _ in NOTIFICATION_CATEGORIES:
            if category in request.data:
                NotificationPreference.objects.filter(user=request.user, category=category).update(
                    enabled=bool(request.data[category])
                )
    prefs = NotificationPreference.objects.filter(user=request.user)
    labels = dict(NOTIFICATION_CATEGORIES)
    return Response([
        {"category": p.category, "label": labels.get(p.category, p.category), "enabled": p.enabled}
        for p in prefs
    ])
