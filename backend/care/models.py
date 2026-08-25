"""
Core care coordination models: programs, referrals, shifts, shift change
approvals, emergencies, family links, resources, and news posts.
"""
from django.conf import settings
from django.db import models


class Program(models.Model):
    """A service program an employee can work in, for example Palliative Care.
    Programs power sorting and filtering across staff lists."""
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Urgency(models.TextChoices):
    LOW = "low", "Low"
    NORMAL = "normal", "Normal"
    HIGH = "high", "High"
    EMERGENCY = "emergency", "Emergency"


class ReferralStatus(models.TextChoices):
    NEW = "new", "New"
    ACCEPTED = "accepted", "Accepted"
    IN_PROGRESS = "in_progress", "In Progress"
    ON_HOLD = "on_hold", "On Hold"
    COMPLETED = "completed", "Completed"
    DECLINED = "declined", "Declined"


class Referral(models.Model):
    """A care referral submitted by a hospital partner."""
    hospital = models.ForeignKey("accounts.Hospital", on_delete=models.PROTECT, related_name="referrals")
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="submitted_referrals")
    client_name = models.CharField(max_length=200)
    client_details = models.JSONField(default=dict, blank=True)
    intake_data = models.JSONField(default=dict, blank=True)
    urgency = models.CharField(max_length=20, choices=Urgency.choices, default=Urgency.NORMAL)
    status = models.CharField(max_length=20, choices=ReferralStatus.choices, default=ReferralStatus.NEW)
    assigned_staff = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_referrals")
    concerns_flag = models.CharField(max_length=500, blank=True)
    notes = models.TextField(blank=True)
    # Source of the referral: portal for the web form, outlook for the future
    # automated email intake. Kept here so intake automation slots in cleanly.
    source = models.CharField(max_length=20, default="portal")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


def referral_doc_path(instance, filename):
    return f"referrals/{instance.referral_id}/{filename}"


class ReferralDocument(models.Model):
    referral = models.ForeignKey(Referral, on_delete=models.CASCADE, related_name="documents")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    file = models.FileField(upload_to=referral_doc_path)
    file_name = models.CharField(max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)


class ShiftStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Scheduled"
    CONFIRMED = "confirmed", "Confirmed"
    IN_PROGRESS = "in_progress", "In Progress"
    COMPLETED = "completed", "Completed"
    CHANGE_REQUESTED = "change_requested", "Change Requested"


class Shift(models.Model):
    """A scheduled visit between one field staff member and one client."""
    field_staff = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="staff_shifts")
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="client_shifts")
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    location = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=30, choices=ShiftStatus.choices, default=ShiftStatus.SCHEDULED)
    notes = models.TextField(blank=True)
    change_request_note = models.TextField(blank=True)
    requested_start_time = models.DateTimeField(null=True, blank=True)
    requested_end_time = models.DateTimeField(null=True, blank=True)
    on_my_way_at = models.DateTimeField(null=True, blank=True)
    clock_in_at = models.DateTimeField(null=True, blank=True)
    clock_out_at = models.DateTimeField(null=True, blank=True)
    geofence_override = models.BooleanField(default=False)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class ChangeRequestStatus(models.TextChoices):
    PENDING = "pending", "Pending manager approval"
    APPROVED = "approved", "Approved"
    DECLINED = "declined", "Declined"


class ShiftChangeRequest(models.Model):
    """
    The approval workflow for field staff shift changes.

    Flow:
      1. Field staff files a request. Their manager gets a notification.
      2. Manager approves: Customer Service gets notified to reschedule.
         Manager declines: the field staff member gets notified.
    """
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name="change_requests")
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="my_change_requests")
    manager = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="approvals_queue")
    reason = models.TextField()
    requested_start_time = models.DateTimeField(null=True, blank=True)
    requested_end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=ChangeRequestStatus.choices, default=ChangeRequestStatus.PENDING)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="decided_change_requests")
    decision_note = models.TextField(blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class EmergencyRequest(models.Model):
    client = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="emergencies")
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="reported_emergencies")
    source = models.CharField(max_length=20, default="client")  # client or staff
    description = models.TextField()
    status = models.CharField(max_length=30, default="new")  # new, acknowledged, resolved
    resolution_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class FamilyMember(models.Model):
    """A read only family link a client sets up for a loved one."""
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="family_links")
    family_name = models.CharField(max_length=150)
    family_email = models.EmailField()
    family_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="linked_clients")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("client", "family_email")]


class Resource(models.Model):
    """Care guide shown in the resource library, also the AI assistant's knowledge base."""
    title = models.CharField(max_length=300)
    category = models.CharField(max_length=100)
    summary = models.TextField(blank=True)
    content = models.TextField()
    published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class NewsPost(models.Model):
    """Dashboard announcements. audience is a list of roles, empty means everyone."""
    title = models.CharField(max_length=300)
    body = models.TextField()
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    published = models.BooleanField(default=True)
    audience = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class ClinicalDocument(models.Model):
    """A visit note or file uploaded by field staff after a shift."""
    shift = models.ForeignKey(Shift, null=True, blank=True, on_delete=models.CASCADE, related_name="clinical_documents")
    field_staff = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="clinical_entries")
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="clinical_records")
    notes = models.TextField(blank=True)
    file = models.FileField(upload_to="clinical/", null=True, blank=True)
    file_name = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
