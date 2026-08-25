"""Integration configuration models: Procura field mapping and Outlook intake rules."""
from django.db import models


class ProcuraFieldMapping(models.Model):
    """
    Placeholder admin panel data for the Procura (AlayaCare) integration.

    Admins map a Procura field name to the matching CareLink field so that,
    once the real Procura access method is confirmed with the vendor, the
    sync job can translate incoming records automatically. Until then this
    table is configuration only and sync_from_procura() below is a stub.
    """
    procura_field = models.CharField(max_length=200)
    carelink_field = models.CharField(max_length=200)
    notes = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("procura_field", "carelink_field")]


class OutlookIntakeRule(models.Model):
    """
    A sorting rule for the future Outlook referral intake.

    Example: subject contains "referral" and sender contains "@riverside.org"
    routes the email into the referral queue with high urgency. Rules are
    stored now so the pipeline is ready the moment Microsoft Graph access
    is granted by the tenant admin.
    """
    name = models.CharField(max_length=200)
    subject_contains = models.CharField(max_length=300, blank=True)
    sender_contains = models.CharField(max_length=300, blank=True)
    set_urgency = models.CharField(max_length=20, default="normal")
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
