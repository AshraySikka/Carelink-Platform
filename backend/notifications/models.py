"""
Platform wide notifications with per category user preferences.

Categories cover every feature area. A user can switch each category on or
off in their settings, so a customer service agent can, for example, keep
message notifications on while muting referral notifications.
"""
from django.conf import settings
from django.db import models

# One entry per feature area. Adding a feature later means adding a category
# here and it automatically shows up in every user's settings panel.
NOTIFICATION_CATEGORIES = [
    ("messages", "Messages"),
    ("referrals", "Referrals"),
    ("schedule", "Schedule changes"),
    ("approvals", "Approvals"),
    ("emergencies", "Emergencies"),
    ("news", "News and announcements"),
]


class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    category = models.CharField(max_length=30, choices=NOTIFICATION_CATEGORIES)
    title = models.CharField(max_length=300)
    body = models.TextField(blank=True)
    link = models.CharField(max_length=300, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class NotificationPreference(models.Model):
    """One row per user per category. enabled False means muted."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preferences")
    category = models.CharField(max_length=30, choices=NOTIFICATION_CATEGORIES)
    enabled = models.BooleanField(default=True)

    class Meta:
        unique_together = [("user", "category")]
