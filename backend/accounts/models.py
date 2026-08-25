"""
User accounts and roles.

Roles carried over from the original CareLink platform, plus the new
"manager" role that owns shift change approvals. A manager can oversee
many field staff. Each field staff member points at one manager through
the manager field.
"""
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models


class Roles(models.TextChoices):
    ADMIN = "admin", "Admin"
    MANAGER = "manager", "Manager"
    HOSPITAL_PARTNER = "hospital_partner", "Hospital Partner"
    CUSTOMER_SERVICE = "customer_service", "Customer Service"
    FIELD_STAFF = "field_staff", "Field Staff"
    CLIENT = "client", "Client"
    FAMILY = "family", "Family"


class InviteStatus(models.TextChoices):
    INVITED = "invited", "Invited"
    ACTIVE = "active", "Active"
    DEACTIVATED = "deactivated", "Deactivated"


class Hospital(models.Model):
    """A partner organization that submits referrals."""
    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    """Email based user manager. There are no usernames in CareLink."""

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email), **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, **extra):
        extra.setdefault("role", Roles.ADMIN)
        extra.setdefault("invite_status", InviteStatus.ACTIVE)
        user = self.create_user(email, password, **extra)
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    """CareLink account. One row per person across every role."""

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    role = models.CharField(max_length=30, choices=Roles.choices, default=Roles.CLIENT)
    hospital = models.ForeignKey(Hospital, null=True, blank=True, on_delete=models.SET_NULL, related_name="members")
    invite_status = models.CharField(max_length=20, choices=InviteStatus.choices, default=InviteStatus.INVITED)
    invited_by = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="invitees")

    # The manager who approves this person's shift change requests.
    # One manager can have many staff, so this is a plain foreign key.
    manager = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="direct_reports", limit_choices_to={"role": Roles.MANAGER},
    )

    # Programs this employee works in. Used for sorting and filtering staff.
    programs = models.ManyToManyField("care.Program", blank=True, related_name="staff")

    # Location fields used by the clock in geofence and scheduling proximity.
    address = models.CharField(max_length=500, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)

    # Field staff availability, stored as a small JSON schedule per weekday.
    availability_schedule = models.JSONField(null=True, blank=True)
    availability_notes = models.TextField(blank=True)
    min_weekly_hours = models.IntegerField(null=True, blank=True)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return f"{self.full_name or self.email} ({self.role})"


class PasswordResetOTP(models.Model):
    """A one time 6 digit code emailed to a user resetting their password.
    Expires 10 minutes after creation and can only be used once."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reset_codes")
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
