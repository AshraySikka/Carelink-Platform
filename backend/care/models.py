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
    # A manager approved the staff member's change, but customer service has
    # not yet actually applied a new time to the shift. Kept distinct from
    # SCHEDULED so nobody mistakes it for a plain, unremarkable shift.
    APPROVED_PENDING_CHANGE = "approved_pending_change", "Approved, Pending Change"
    CANCELLED = "cancelled", "Cancelled"


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
    # Required whenever geofence_override is True: why the staff member
    # clocked in from farther than the 100m limit. Logged, sent to their
    # manager, and shown in the "Clock-in location overrides" report.
    geofence_override_reason = models.TextField(blank=True)
    geofence_override_distance_meters = models.PositiveIntegerField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class ChangeRequestStatus(models.TextChoices):
    PENDING = "pending", "Pending manager approval"
    APPROVED = "approved", "Approved"
    DECLINED = "declined", "Declined"


class ChangeRequestType(models.TextChoices):
    RESCHEDULE = "reschedule", "Reschedule"
    CANCEL = "cancel", "Cancel"


class ChangeReasonCode(models.TextChoices):
    ILLNESS = "illness", "I'm sick and can't safely provide care"
    TRANSPORTATION = "transportation", "Transportation problem (car trouble, no ride, etc.)"
    PERSONAL_EMERGENCY = "personal_emergency", "Personal emergency"
    FAMILY_EMERGENCY = "family_emergency", "Family emergency"
    SCHEDULING_CONFLICT = "scheduling_conflict", "Double booked or scheduling conflict"
    WEATHER = "weather", "Weather or unsafe travel conditions"
    CLIENT_NO_LONGER_NEEDS_VISIT = "client_no_longer_needs_visit", "Client no longer needs this visit"
    CLIENT_SAFETY_CONCERN = "client_safety_concern", "Safety concern at the client's location"
    CLIENT_MEDICAL_EMERGENCY = "client_medical_emergency", "Client is having a medical emergency right now"
    OTHER = "other", "Other"


# Selecting one of these should never produce a queued change request. It
# needs customer service alerted right now, not a manager decision later.
BLOCKED_REASON_CODES = {
    ChangeReasonCode.CLIENT_SAFETY_CONCERN,
    ChangeReasonCode.CLIENT_MEDICAL_EMERGENCY,
}


class ShiftChangeRequest(models.Model):
    """
    The approval workflow for field staff shift changes.

    Flow:
      1. Field staff files a request. Their manager gets a notification.
      2. Manager approves: Customer Service gets notified to reschedule.
         Manager declines: the field staff member gets notified.

    Customer service and admins can also decide a request directly (not
    just the assigned manager), so an unanswered request is never stuck
    waiting on one specific person. See escalate_change_requests for the
    scheduled job that pings everyone again as the shift gets close.
    """
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name="change_requests")
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="my_change_requests")
    manager = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="approvals_queue")
    request_type = models.CharField(max_length=20, choices=ChangeRequestType.choices, default=ChangeRequestType.RESCHEDULE)
    reason_code = models.CharField(max_length=40, choices=ChangeReasonCode.choices, default=ChangeReasonCode.OTHER)
    reason = models.TextField()
    requested_start_time = models.DateTimeField(null=True, blank=True)
    requested_end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=ChangeRequestStatus.choices, default=ChangeRequestStatus.PENDING)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="decided_change_requests")
    decision_note = models.TextField(blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    # Set once an unanswered request has been escalated to CS/admin, so the
    # scheduled job doesn't notify the same request every time it runs.
    escalated_at = models.DateTimeField(null=True, blank=True)
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
    """Care guide shown in the resource library, also the AI assistant's knowledge base.
    audience is a list of roles allowed to see it, same convention as
    NewsPost.audience: an empty list means everyone can see it. This is
    what keeps, for example, a client from seeing an internal company
    policy, or field staff from seeing content meant for clients."""
    title = models.CharField(max_length=300)
    category = models.CharField(max_length=100)
    summary = models.TextField(blank=True)
    content = models.TextField()
    published = models.BooleanField(default=True)
    audience = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class NewsPost(models.Model):
    """Dashboard announcements. audience is a list of roles, empty means everyone."""
    title = models.CharField(max_length=300)
    body = models.TextField()
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    published = models.BooleanField(default=True)
    audience = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class PlatformSetting(models.Model):
    """
    A single row of platform wide configuration, admin editable.

    news_post_cap limits how many published news posts can target the same
    role at once (a post with an empty audience counts toward every role).
    Kept as a model instead of a settings.py constant so admins can change
    it from the News posts screen without a redeploy.
    """
    news_post_cap = models.PositiveSmallIntegerField(default=3)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class ClinicalDocument(models.Model):
    """A visit note or file uploaded by field staff after a shift."""
    shift = models.ForeignKey(Shift, null=True, blank=True, on_delete=models.CASCADE, related_name="clinical_documents")
    field_staff = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="clinical_entries")
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="clinical_records")
    notes = models.TextField(blank=True)
    file = models.FileField(upload_to="clinical/", null=True, blank=True)
    file_name = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
