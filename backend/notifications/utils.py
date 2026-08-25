"""
The single entry point every feature uses to notify people.

notify() checks the recipient's preferences first, stores the notification,
and pushes it over the recipient's WebSocket so bells update live.
"""
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import NOTIFICATION_CATEGORIES, Notification, NotificationPreference


def ensure_default_preferences(user):
    """Create an enabled preference row for every category a user is missing."""
    existing = set(user.notification_preferences.values_list("category", flat=True))
    NotificationPreference.objects.bulk_create(
        [NotificationPreference(user=user, category=cat) for cat, _ in NOTIFICATION_CATEGORIES if cat not in existing]
    )


def _push(user_id, payload):
    """Send a payload to the user's live WebSocket group. Safe to fail quietly."""
    try:
        layer = get_channel_layer()
        async_to_sync(layer.group_send)(f"user_{user_id}", {"type": "push", "payload": payload})
    except Exception:
        pass


def notify(user, category, title, body="", link=""):
    """Notify one user, honoring their per category preference."""
    if user is None:
        return
    pref = NotificationPreference.objects.filter(user=user, category=category).first()
    if pref is not None and not pref.enabled:
        return
    notification = Notification.objects.create(user=user, category=category, title=title, body=body, link=link)
    _push(user.id, {
        "kind": "notification",
        "id": notification.id,
        "category": category,
        "title": title,
        "body": body,
        "link": link,
        "created_at": notification.created_at.isoformat(),
    })


def notify_role(role, category, title, body="", link=""):
    """Notify every active user holding a role."""
    from accounts.models import User
    for user in User.objects.filter(role=role, invite_status="active"):
        notify(user, category, title, body, link)
