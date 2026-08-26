"""
Report definitions: each entry knows how to build its own column headers
and rows from the database, and who is allowed to run it.

Adding a new report later means adding one function here and one entry in
REPORTS, nothing else needs to change.
"""
from datetime import datetime

from django.db.models import Count, Q

from accounts.models import Roles, User
from care.models import ChangeRequestStatus, EmergencyRequest, Referral, Shift
from messaging.models import Message


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _apply_date_range(qs, field, start, end):
    if start:
        qs = qs.filter(**{f"{field}__date__gte": start})
    if end:
        qs = qs.filter(**{f"{field}__date__lte": end})
    return qs


# ---------------- Change requests, full log ----------------

def change_requests_log(user, params):
    from care.models import ShiftChangeRequest
    qs = ShiftChangeRequest.objects.select_related("requested_by", "manager", "decided_by", "shift", "shift__client")
    if user.role == Roles.MANAGER:
        qs = qs.filter(manager=user)
    start, end = _parse_date(params.get("start")), _parse_date(params.get("end"))
    qs = _apply_date_range(qs, "created_at", start, end)
    if params.get("staff"):
        qs = qs.filter(requested_by_id=params["staff"])
    if params.get("status"):
        qs = qs.filter(status=params["status"])

    columns = ["Requested by", "Type", "Manager", "Client", "Shift start", "Same day", "Reason", "Status", "Decided by", "Decision note", "Requested at", "Decided at"]
    rows = []
    for c in qs.order_by("-created_at"):
        same_day = "Yes" if c.shift and c.shift.start_time.date() == c.created_at.date() else "No"
        rows.append([
            c.requested_by.full_name, c.get_request_type_display(), c.manager.full_name if c.manager else "-",
            c.shift.client.full_name if c.shift else "-",
            c.shift.start_time.strftime("%Y-%m-%d %H:%M") if c.shift else "-",
            same_day,
            c.reason, c.status, c.decided_by.full_name if c.decided_by else "-",
            c.decision_note or "-", c.created_at.strftime("%Y-%m-%d %H:%M"),
            c.decided_at.strftime("%Y-%m-%d %H:%M") if c.decided_at else "-",
        ])
    return columns, rows


# ---------------- Change requests, summarized per staff ----------------

def change_requests_by_staff(user, params):
    from care.models import ShiftChangeRequest
    qs = ShiftChangeRequest.objects.all()
    if user.role == Roles.MANAGER:
        qs = qs.filter(manager=user)
    start, end = _parse_date(params.get("start")), _parse_date(params.get("end"))
    qs = _apply_date_range(qs, "created_at", start, end)

    grouped = (
        qs.values("requested_by__id", "requested_by__full_name")
        .annotate(
            total=Count("id"),
            pending=Count("id", filter=Q(status=ChangeRequestStatus.PENDING)),
            approved=Count("id", filter=Q(status=ChangeRequestStatus.APPROVED)),
            declined=Count("id", filter=Q(status=ChangeRequestStatus.DECLINED)),
        )
        .order_by("-total")
    )
    columns = ["Field staff", "Total requests", "Pending", "Approved", "Declined"]
    rows = [[g["requested_by__full_name"], g["total"], g["pending"], g["approved"], g["declined"]] for g in grouped]
    return columns, rows


# ---------------- Referrals, full log (admin only) ----------------

def referrals_log(user, params):
    qs = Referral.objects.select_related("hospital", "submitted_by", "assigned_staff")
    start, end = _parse_date(params.get("start")), _parse_date(params.get("end"))
    qs = _apply_date_range(qs, "created_at", start, end)
    if params.get("status"):
        qs = qs.filter(status=params["status"])

    columns = ["Client", "Hospital", "Urgency", "Status", "Assigned staff", "Submitted by", "Concerns", "Submitted at"]
    rows = []
    for r in qs.order_by("-created_at"):
        rows.append([
            r.client_name, r.hospital.name, r.urgency, r.status,
            r.assigned_staff.full_name if r.assigned_staff else "-",
            r.submitted_by.full_name, r.concerns_flag or "-",
            r.created_at.strftime("%Y-%m-%d %H:%M"),
        ])
    return columns, rows


# ---------------- Shifts, summarized per staff ----------------

def shifts_by_staff(user, params):
    qs = Shift.objects.all()
    if user.role == Roles.MANAGER:
        qs = qs.filter(field_staff__manager=user)
    start, end = _parse_date(params.get("start")), _parse_date(params.get("end"))
    qs = _apply_date_range(qs, "start_time", start, end)

    grouped = (
        qs.values("field_staff__id", "field_staff__full_name")
        .annotate(
            total=Count("id"),
            completed=Count("id", filter=Q(status="completed")),
            scheduled=Count("id", filter=Q(status="scheduled")),
            change_requested=Count("id", filter=Q(status="change_requested")),
        )
        .order_by("-total")
    )
    columns = ["Field staff", "Total shifts", "Completed", "Scheduled", "Change requested"]
    rows = [[g["field_staff__full_name"], g["total"], g["completed"], g["scheduled"], g["change_requested"]] for g in grouped]
    return columns, rows


# ---------------- Clock-in location overrides ----------------

def geofence_overrides_log(user, params):
    """
    Every clock-in that happened outside the 100m radius, with the reason
    the field staff member gave. Lets an admin or manager spot patterns:
    the same person overriding every shift, or the same excuse every time.
    """
    qs = Shift.objects.filter(geofence_override=True).select_related("field_staff", "client")
    if user.role == Roles.MANAGER:
        qs = qs.filter(field_staff__manager=user)
    start, end = _parse_date(params.get("start")), _parse_date(params.get("end"))
    qs = _apply_date_range(qs, "clock_in_at", start, end)
    if params.get("staff"):
        qs = qs.filter(field_staff_id=params["staff"])

    columns = ["Field staff", "Client", "Shift start", "Clocked in at", "Distance (m)", "Reason given"]
    rows = []
    for s in qs.order_by("-clock_in_at"):
        rows.append([
            s.field_staff.full_name, s.client.full_name,
            s.start_time.strftime("%Y-%m-%d %H:%M"),
            s.clock_in_at.strftime("%Y-%m-%d %H:%M") if s.clock_in_at else "-",
            s.geofence_override_distance_meters if s.geofence_override_distance_meters is not None else "-",
            s.geofence_override_reason or "-",
        ])
    return columns, rows


# ---------------- Emergencies, full log (admin only) ----------------

def emergencies_log(user, params):
    qs = EmergencyRequest.objects.select_related("client", "reporter")
    start, end = _parse_date(params.get("start")), _parse_date(params.get("end"))
    qs = _apply_date_range(qs, "created_at", start, end)
    if params.get("status"):
        qs = qs.filter(status=params["status"])

    columns = ["Source", "Client", "Reporter", "Description", "Status", "Created at"]
    rows = []
    for e in qs.order_by("-created_at"):
        rows.append([
            e.source, e.client.full_name if e.client else "-", e.reporter.full_name if e.reporter else "-",
            e.description, e.status, e.created_at.strftime("%Y-%m-%d %H:%M"),
        ])
    return columns, rows


# ---------------- Messages sent per staff (admin only) ----------------

def messages_by_user(user, params):
    qs = Message.objects.all()
    start, end = _parse_date(params.get("start")), _parse_date(params.get("end"))
    qs = _apply_date_range(qs, "created_at", start, end)
    grouped = qs.values("sender__id", "sender__full_name", "sender__role").annotate(total=Count("id")).order_by("-total")
    columns = ["Sender", "Role", "Messages sent"]
    rows = [[g["sender__full_name"], g["sender__role"], g["total"]] for g in grouped]
    return columns, rows


# name, label, builder function, allowed roles, whether it accepts a staff filter
REPORTS = {
    "change_requests_log": {"label": "Shift change requests, full log", "fn": change_requests_log, "roles": [Roles.ADMIN, Roles.MANAGER], "staff_filter": True, "status_options": ["pending", "approved", "declined"]},
    "change_requests_by_staff": {"label": "Shift change requests per staff", "fn": change_requests_by_staff, "roles": [Roles.ADMIN, Roles.MANAGER], "staff_filter": False, "status_options": []},
    "shifts_by_staff": {"label": "Shifts per staff", "fn": shifts_by_staff, "roles": [Roles.ADMIN, Roles.MANAGER], "staff_filter": False, "status_options": []},
    "geofence_overrides_log": {"label": "Clock-in location overrides", "fn": geofence_overrides_log, "roles": [Roles.ADMIN, Roles.MANAGER], "staff_filter": True, "status_options": []},
    "referrals_log": {"label": "Referrals, full log", "fn": referrals_log, "roles": [Roles.ADMIN], "staff_filter": False, "status_options": ["new", "accepted", "in_progress", "on_hold", "completed", "declined"]},
    "emergencies_log": {"label": "Emergency requests, full log", "fn": emergencies_log, "roles": [Roles.ADMIN], "staff_filter": False, "status_options": ["new", "acknowledged", "resolved"]},
    "messages_by_user": {"label": "Messages sent per user", "fn": messages_by_user, "roles": [Roles.ADMIN], "staff_filter": False, "status_options": []},
}


def staff_options_for(user):
    """Who can appear in the staff filter dropdown, scoped like everything else."""
    if user.role == Roles.MANAGER:
        return User.objects.filter(manager=user)
    return User.objects.filter(role__in=[Roles.FIELD_STAFF, Roles.MANAGER])
