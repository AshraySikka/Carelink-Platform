"""
Care domain endpoints. Every list is scoped to what the caller's role is
allowed to see, mirroring the row level security the original Supabase
version enforced in the database.
"""
import math

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import Roles, User
from accounts.permissions import IsAdmin, IsAdminOrCS, IsSchedulingStaff
from notifications.utils import notify, notify_role
from .models import (
    ChangeRequestStatus, ClinicalDocument, EmergencyRequest, FamilyMember,
    NewsPost, PlatformSetting, Program, Referral, ReferralDocument,
    ReferralStatus, Resource, Shift, ShiftChangeRequest, ShiftStatus,
)
from .serializers import (
    ClinicalDocumentSerializer, EmergencySerializer, FamilyMemberSerializer,
    NewsPostSerializer, ProgramSerializer, ReferralSerializer, ResourceSerializer,
    ShiftChangeRequestSerializer, ShiftSerializer,
)


# ---------------- Programs ----------------

@api_view(["GET", "POST"])
def programs_view(request):
    """List programs (any signed in staff role), create one (admin only)."""
    if request.method == "POST":
        if request.user.role != Roles.ADMIN:
            return Response({"detail": "Only admins can create programs."}, status=403)
        serializer = ProgramSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(ProgramSerializer(Program.objects.order_by("name"), many=True).data)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAdmin])
def program_detail_view(request, program_id):
    try:
        program = Program.objects.get(id=program_id)
    except Program.DoesNotExist:
        return Response({"detail": "Program not found."}, status=404)
    if request.method == "DELETE":
        program.delete()
        return Response(status=204)
    serializer = ProgramSerializer(program, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


# ---------------- Referrals ----------------

def _referral_queryset_for(user):
    qs = Referral.objects.select_related("hospital", "submitted_by", "assigned_staff").prefetch_related("documents")
    if user.role in (Roles.ADMIN, Roles.CUSTOMER_SERVICE, Roles.MANAGER):
        return qs
    if user.role == Roles.HOSPITAL_PARTNER:
        return qs.filter(submitted_by=user)
    return qs.none()


@api_view(["GET", "POST"])
def referrals_view(request):
    if request.method == "GET":
        return Response(ReferralSerializer(_referral_queryset_for(request.user).order_by("-created_at"), many=True).data)

    # Only hospital partners with an org affiliation can submit referrals.
    if request.user.role != Roles.HOSPITAL_PARTNER or not request.user.hospital_id:
        return Response({"detail": "Only hospital partners with an organization can submit referrals."}, status=403)
    serializer = ReferralSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    referral = serializer.save(hospital=request.user.hospital, submitted_by=request.user, source="portal")
    # New referral notification goes to the customer service team.
    notify_role(Roles.CUSTOMER_SERVICE, "referrals", "New referral received",
                f"{referral.client_name} was referred by {request.user.hospital.name}.", link="/cs/queue")
    return Response(ReferralSerializer(referral).data, status=201)


@api_view(["PATCH"])
def referral_detail_view(request, referral_id):
    try:
        referral = _referral_queryset_for(request.user).get(id=referral_id)
    except Referral.DoesNotExist:
        return Response({"detail": "Referral not found."}, status=404)

    # Hospital partners may only edit their own referral while it is still new.
    if request.user.role == Roles.HOSPITAL_PARTNER and referral.status != ReferralStatus.NEW:
        return Response({"detail": "This referral is read only once accepted."}, status=403)

    old_status = referral.status
    serializer = ReferralSerializer(referral, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    referral = serializer.save()
    if referral.status != old_status:
        notify(referral.submitted_by, "referrals", "Referral status updated",
               f"{referral.client_name} is now {referral.get_status_display()}.", link="/hospital")
    return Response(ReferralSerializer(referral).data)


@api_view(["POST"])
def referral_documents_view(request, referral_id):
    """Attach an uploaded file to a referral."""
    try:
        referral = _referral_queryset_for(request.user).get(id=referral_id)
    except Referral.DoesNotExist:
        return Response({"detail": "Referral not found."}, status=404)
    file = request.FILES.get("file")
    if not file:
        return Response({"detail": "No file provided."}, status=400)
    if file.size > 10 * 1024 * 1024:
        return Response({"detail": "Files must be 10MB or smaller."}, status=400)
    doc = ReferralDocument.objects.create(referral=referral, uploaded_by=request.user, file=file, file_name=file.name)
    return Response({"id": doc.id, "file_name": doc.file_name, "file": doc.file.url}, status=201)



# ---------------- Shifts ----------------

def _shift_queryset_for(user):
    qs = Shift.objects.select_related("field_staff", "client")
    if user.role in (Roles.ADMIN, Roles.CUSTOMER_SERVICE, Roles.MANAGER):
        return qs
    if user.role == Roles.FIELD_STAFF:
        return qs.filter(field_staff=user)
    if user.role == Roles.CLIENT:
        return qs.filter(client=user)
    if user.role == Roles.FAMILY:
        client_ids = FamilyMember.objects.filter(family_user=user).values_list("client_id", flat=True)
        return qs.filter(client_id__in=client_ids)
    return qs.none()


@api_view(["GET", "POST"])
def shifts_view(request):
    if request.method == "GET":
        return Response(ShiftSerializer(_shift_queryset_for(request.user).order_by("start_time"), many=True).data)
    if request.user.role not in (Roles.ADMIN, Roles.CUSTOMER_SERVICE, Roles.MANAGER):
        return Response({"detail": "Only scheduling staff can create shifts."}, status=403)
    serializer = ShiftSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    shift = serializer.save()
    notify(shift.field_staff, "schedule", "New shift assigned",
           f"Visit with {shift.client.full_name} on {shift.start_time:%b %d, %I:%M %p}.", link="/field")
    notify(shift.client, "schedule", "New visit scheduled",
           f"{shift.field_staff.full_name} will visit on {shift.start_time:%b %d, %I:%M %p}.", link="/care")
    return Response(ShiftSerializer(shift).data, status=201)


@api_view(["PATCH", "DELETE"])
def shift_detail_view(request, shift_id):
    try:
        shift = _shift_queryset_for(request.user).get(id=shift_id)
    except Shift.DoesNotExist:
        return Response({"detail": "Shift not found."}, status=404)
    if request.method == "DELETE":
        if request.user.role not in (Roles.ADMIN, Roles.CUSTOMER_SERVICE):
            return Response({"detail": "Only scheduling staff can delete shifts."}, status=403)
        shift.delete()
        return Response(status=204)
    serializer = ShiftSerializer(shift, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    return Response(ShiftSerializer(serializer.save()).data)


def _haversine_meters(lat1, lng1, lat2, lng2):
    """Distance between two coordinates in meters, used by the clock in geofence."""
    radius = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


@api_view(["POST"])
def shift_clock_in_view(request, shift_id):
    """Clock in, gated to 15 minutes before the start and 100m of the client address."""
    try:
        shift = Shift.objects.select_related("client").get(id=shift_id, field_staff=request.user)
    except Shift.DoesNotExist:
        return Response({"detail": "Shift not found."}, status=404)
    if shift.clock_in_at:
        return Response({"detail": "Already clocked in."}, status=400)
    now = timezone.now()
    if now < shift.start_time - timezone.timedelta(minutes=15):
        return Response({"detail": "You can only clock in within 15 minutes of the scheduled start."}, status=400)

    override = False
    lat, lng = request.data.get("latitude"), request.data.get("longitude")
    client = shift.client
    if lat is not None and lng is not None and client.latitude is not None and client.longitude is not None:
        distance = _haversine_meters(float(lat), float(lng), client.latitude, client.longitude)
        if distance > 100:
            if not request.data.get("override"):
                return Response(
                    {"detail": f"You are {round(distance)}m from the client address (limit 100m). Confirm override to clock in anyway.", "needs_override": True},
                    status=400,
                )
            override = True

    shift.clock_in_at = now
    shift.status = ShiftStatus.IN_PROGRESS
    shift.geofence_override = override
    shift.save()
    return Response(ShiftSerializer(shift).data)


@api_view(["POST"])
def shift_clock_out_view(request, shift_id):
    try:
        shift = Shift.objects.get(id=shift_id, field_staff=request.user)
    except Shift.DoesNotExist:
        return Response({"detail": "Shift not found."}, status=404)
    shift.clock_out_at = timezone.now()
    shift.status = ShiftStatus.COMPLETED
    shift.save()
    return Response(ShiftSerializer(shift).data)


@api_view(["POST"])
def shift_on_my_way_view(request, shift_id):
    try:
        shift = Shift.objects.select_related("client").get(id=shift_id, field_staff=request.user)
    except Shift.DoesNotExist:
        return Response({"detail": "Shift not found."}, status=404)
    shift.on_my_way_at = timezone.now()
    shift.save()
    notify(shift.client, "schedule", "Your caregiver is on the way",
           f"{request.user.full_name} is heading to your visit now.", link="/care")
    return Response(ShiftSerializer(shift).data)


# ---------------- Shift change approval workflow ----------------

@api_view(["GET", "POST"])
def change_requests_view(request):
    """
    GET: the requests the caller should see.
      Managers see their own approval queue. Field staff see their requests.
      Admin and CS see everything.
    POST: field staff file a new request. Their manager is notified.
    """
    user = request.user
    if request.method == "GET":
        qs = ShiftChangeRequest.objects.select_related("shift", "requested_by", "shift__client", "shift__field_staff")
        if user.role == Roles.MANAGER:
            qs = qs.filter(manager=user)
        elif user.role == Roles.FIELD_STAFF:
            qs = qs.filter(requested_by=user)
        elif user.role == Roles.CLIENT:
            qs = qs.filter(requested_by=user)
        elif user.role not in (Roles.ADMIN, Roles.CUSTOMER_SERVICE):
            qs = qs.none()
        return Response(ShiftChangeRequestSerializer(qs.order_by("-created_at"), many=True).data)

    # Filing a request. Field staff go through manager approval. Clients can
    # also request changes, those route straight to customer service.
    serializer = ShiftChangeRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    shift = serializer.validated_data["shift"]

    if user.role == Roles.FIELD_STAFF:
        if shift.field_staff_id != user.id:
            return Response({"detail": "You can only request changes to your own shifts."}, status=403)
        if not user.manager_id:
            return Response({"detail": "You do not have a manager assigned yet. Ask your administrator to set one."}, status=400)
        change = serializer.save(requested_by=user, manager=user.manager)
        shift.status = ShiftStatus.CHANGE_REQUESTED
        shift.change_request_note = change.reason
        shift.requested_start_time = change.requested_start_time
        shift.requested_end_time = change.requested_end_time
        shift.save()
        notify(user.manager, "approvals", "Shift change needs your approval",
               f"{user.full_name} requested a change to their {shift.start_time:%b %d} shift: {change.reason}", link="/approvals")
        return Response(ShiftChangeRequestSerializer(change).data, status=201)

    if user.role == Roles.CLIENT:
        if shift.client_id != user.id:
            return Response({"detail": "You can only request changes to your own visits."}, status=403)
        change = serializer.save(requested_by=user, manager=None, status=ChangeRequestStatus.APPROVED)
        shift.status = ShiftStatus.CHANGE_REQUESTED
        shift.change_request_note = change.reason
        shift.requested_start_time = change.requested_start_time
        shift.requested_end_time = change.requested_end_time
        shift.save()
        notify_role(Roles.CUSTOMER_SERVICE, "schedule", "Client requested a visit change",
                    f"{user.full_name}: {change.reason}", link="/cs/schedule")
        return Response(ShiftChangeRequestSerializer(change).data, status=201)

    return Response({"detail": "Only field staff and clients file change requests."}, status=403)


@api_view(["POST"])
def change_request_decide_view(request, request_id):
    """Manager approves or declines. Notifications fan out per the workflow."""
    try:
        change = ShiftChangeRequest.objects.select_related("shift", "requested_by").get(id=request_id)
    except ShiftChangeRequest.DoesNotExist:
        return Response({"detail": "Request not found."}, status=404)
    user = request.user
    if user.role not in (Roles.ADMIN,) and change.manager_id != user.id:
        return Response({"detail": "Only the assigned manager can decide this request."}, status=403)
    if change.status != ChangeRequestStatus.PENDING:
        return Response({"detail": "This request has already been decided."}, status=400)

    decision = request.data.get("decision")
    if decision not in ("approved", "declined"):
        return Response({"detail": "Decision must be approved or declined."}, status=400)

    change.status = decision
    change.decided_by = user
    change.decision_note = request.data.get("note", "")
    change.decided_at = timezone.now()
    change.save()

    shift = change.shift
    if decision == "approved":
        # Approved: customer service gets notified so they can reschedule.
        notify_role(Roles.CUSTOMER_SERVICE, "approvals", "Approved shift change to action",
                    f"{change.requested_by.full_name}'s change for {shift.start_time:%b %d} was approved by {user.full_name}. Please update the schedule.",
                    link="/cs/schedule")
        notify(change.requested_by, "approvals", "Your shift change was approved",
               "Customer service will update the schedule shortly.", link="/field")
    else:
        # Declined: the field staff member is notified and the shift reverts.
        shift.status = ShiftStatus.SCHEDULED
        shift.change_request_note = ""
        shift.save()
        notify(change.requested_by, "approvals", "Your shift change was declined",
               change.decision_note or "Your manager declined this request. Talk to them for details.", link="/field")
    return Response(ShiftChangeRequestSerializer(change).data)


# ---------------- Emergencies ----------------

@api_view(["GET", "POST"])
def emergencies_view(request):
    user = request.user
    if request.method == "POST":
        description = (request.data.get("description") or "").strip()
        if not description:
            return Response({"detail": "Description is required."}, status=400)
        if user.role == Roles.CLIENT:
            emergency = EmergencyRequest.objects.create(client=user, source="client", description=description)
        else:
            emergency = EmergencyRequest.objects.create(reporter=user, source="staff", description=description,
                                                        client_id=request.data.get("client") or None)
        notify_role(Roles.CUSTOMER_SERVICE, "emergencies", "Emergency request",
                    description[:140], link="/cs/emergencies")
        return Response(EmergencySerializer(emergency).data, status=201)

    qs = EmergencyRequest.objects.select_related("client", "reporter").order_by("-created_at")
    if user.role in (Roles.ADMIN, Roles.CUSTOMER_SERVICE, Roles.MANAGER):
        pass
    elif user.role == Roles.CLIENT:
        qs = qs.filter(client=user)
    elif user.role == Roles.FIELD_STAFF:
        qs = qs.filter(reporter=user)
    elif user.role == Roles.FAMILY:
        client_ids = FamilyMember.objects.filter(family_user=user).values_list("client_id", flat=True)
        qs = qs.filter(client_id__in=client_ids)
    else:
        qs = qs.none()
    return Response(EmergencySerializer(qs, many=True).data)


@api_view(["PATCH"])
@permission_classes([IsAdminOrCS])
def emergency_detail_view(request, emergency_id):
    try:
        emergency = EmergencyRequest.objects.get(id=emergency_id)
    except EmergencyRequest.DoesNotExist:
        return Response({"detail": "Not found."}, status=404)
    if "status" in request.data:
        emergency.status = request.data["status"]
    if "resolution_notes" in request.data:
        emergency.resolution_notes = request.data["resolution_notes"]
    emergency.save()
    return Response(EmergencySerializer(emergency).data)


# ---------------- Family ----------------

@api_view(["GET", "POST"])
def family_view(request):
    user = request.user
    if request.method == "POST":
        if user.role != Roles.CLIENT:
            return Response({"detail": "Only clients manage family access."}, status=403)
        serializer = FamilyMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = serializer.save(client=user)
        # Auto link if a family account with this email already exists.
        existing = User.objects.filter(email__iexact=member.family_email, role=Roles.FAMILY).first()
        if existing:
            member.family_user = existing
            member.save()
        return Response(FamilyMemberSerializer(member).data, status=201)
    if user.role == Roles.CLIENT:
        qs = FamilyMember.objects.filter(client=user)
    elif user.role == Roles.FAMILY:
        qs = FamilyMember.objects.filter(family_user=user)
    else:
        qs = FamilyMember.objects.none()
    return Response(FamilyMemberSerializer(qs, many=True).data)


@api_view(["DELETE"])
def family_detail_view(request, member_id):
    try:
        member = FamilyMember.objects.get(id=member_id, client=request.user)
    except FamilyMember.DoesNotExist:
        return Response({"detail": "Not found."}, status=404)
    member.delete()
    return Response(status=204)


# ---------------- Resources and news ----------------

@api_view(["GET", "POST"])
def resources_view(request):
    if request.method == "POST":
        if request.user.role != Roles.ADMIN:
            return Response({"detail": "Only admins manage resources."}, status=403)
        serializer = ResourceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(ResourceSerializer(Resource.objects.filter(published=True).order_by("category", "title"), many=True).data)



def _roles_at_cap(candidate_audience, exclude_id=None):
    """Return the list of roles that are already at the news post cap and
    would be pushed over it by publishing candidate_audience. An empty
    audience (everyone) is checked against every role."""
    setting = PlatformSetting.load()
    cap = setting.news_post_cap
    target_roles = list(Roles.values) if not candidate_audience else candidate_audience

    published = NewsPost.objects.filter(published=True)
    if exclude_id is not None:
        published = published.exclude(id=exclude_id)
    published = list(published)

    over = []
    for role in target_roles:
        count = sum(1 for p in published if not p.audience or role in p.audience)
        if count >= cap:
            over.append(role)
    return over


@api_view(["GET", "POST"])
def news_view(request):
    user = request.user
    if request.method == "POST":
        if user.role != Roles.ADMIN:
            return Response({"detail": "Only admins publish news."}, status=403)
        serializer = NewsPostSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        audience = serializer.validated_data.get("audience") or []
        if serializer.validated_data.get("published", True):
            over = _roles_at_cap(audience)
            if over:
                cap = PlatformSetting.load().news_post_cap
                return Response(
                    {"detail": f"These roles are already at the {cap} post limit, unpublish an older post first: {', '.join(over)}."},
                    status=400,
                )
        serializer.save(author=user)
        return Response(serializer.data, status=201)
    posts = NewsPost.objects.filter(published=True).order_by("-created_at")
    visible = [p for p in posts if not p.audience or user.role in p.audience]
    return Response(NewsPostSerializer(visible, many=True).data)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAdmin])
def news_detail_view(request, post_id):
    try:
        post = NewsPost.objects.get(id=post_id)
    except NewsPost.DoesNotExist:
        return Response({"detail": "Not found."}, status=404)
    if request.method == "DELETE":
        post.delete()
        return Response(status=204)
    serializer = NewsPostSerializer(post, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    will_publish = serializer.validated_data.get("published", post.published)
    audience = serializer.validated_data.get("audience", post.audience)
    if will_publish and (not post.published or audience != post.audience):
        over = _roles_at_cap(audience, exclude_id=post.id)
        if over:
            cap = PlatformSetting.load().news_post_cap
            return Response(
                {"detail": f"These roles are already at the {cap} post limit, unpublish an older post first: {', '.join(over)}."},
                status=400,
            )
    serializer.save()
    return Response(serializer.data)


@api_view(["GET", "PATCH"])
@permission_classes([IsAdmin])
def news_settings_view(request):
    """Admin: read or update the news post cap, clamped between 1 and 5."""
    setting = PlatformSetting.load()
    if request.method == "PATCH":
        try:
            cap = int(request.data.get("news_post_cap"))
        except (TypeError, ValueError):
            return Response({"detail": "news_post_cap must be a number."}, status=400)
        setting.news_post_cap = max(1, min(5, cap))
        setting.save()
    return Response({"news_post_cap": setting.news_post_cap})


# ---------------- Clinical documentation ----------------

@api_view(["GET", "POST"])
def clinical_docs_view(request):
    user = request.user
    if request.method == "POST":
        if user.role != Roles.FIELD_STAFF:
            return Response({"detail": "Only field staff log clinical entries."}, status=403)
        shift_id = request.data.get("shift")
        try:
            shift = Shift.objects.get(id=shift_id, field_staff=user)
        except Shift.DoesNotExist:
            return Response({"detail": "Pick one of your own shifts."}, status=400)
        file = request.FILES.get("file")
        doc = ClinicalDocument.objects.create(
            shift=shift, field_staff=user, client=shift.client,
            notes=request.data.get("notes", ""), file=file, file_name=file.name if file else "",
        )
        return Response(ClinicalDocumentSerializer(doc).data, status=201)
    if user.role == Roles.FIELD_STAFF:
        qs = ClinicalDocument.objects.filter(field_staff=user)
    elif user.role in (Roles.ADMIN, Roles.CUSTOMER_SERVICE, Roles.MANAGER):
        qs = ClinicalDocument.objects.all()
    else:
        qs = ClinicalDocument.objects.none()
    return Response(ClinicalDocumentSerializer(qs.order_by("-created_at"), many=True).data)



@api_view(["POST"])
@permission_classes([IsAdmin])
def programs_bulk_view(request):
    """
    Admin: upload a spreadsheet to create programs in bulk.

    Expected columns, header row required: name, description (description
    is optional). Existing programs are matched by name and have their
    description updated rather than duplicated.
    """
    file = request.FILES.get("file")
    if not file:
        return Response({"detail": "Upload an .xlsx file with a file field named file."}, status=400)

    try:
        from openpyxl import load_workbook
    except ImportError:
        return Response({"detail": "openpyxl is not installed on the server."}, status=500)

    try:
        workbook = load_workbook(file, read_only=True, data_only=True)
        sheet = workbook.active
        rows = list(sheet.iter_rows(values_only=True))
    except Exception:
        return Response({"detail": "Could not read that file. Make sure it is a valid .xlsx spreadsheet."}, status=400)

    if not rows:
        return Response({"detail": "The spreadsheet is empty."}, status=400)

    header = [str(c).strip().lower() if c else "" for c in rows[0]]
    if "name" not in header:
        return Response({"detail": "Header row must include: name (description is optional)."}, status=400)
    col = {name: header.index(name) for name in header if name}

    created, updated, errors = [], [], []
    for row_number, row in enumerate(rows[1:], start=2):
        if not row or not any(row):
            continue
        name = str(row[col["name"]] or "").strip() if col.get("name") is not None else ""
        description = str(row[col["description"]] or "").strip() if "description" in col and col["description"] is not None and len(row) > col["description"] else ""
        if not name:
            errors.append({"row": row_number, "reason": "Missing program name."})
            continue
        program, was_created = Program.objects.get_or_create(name=name, defaults={"description": description})
        if was_created:
            created.append({"row": row_number, "name": name})
        else:
            if description:
                program.description = description
                program.save(update_fields=["description"])
            updated.append({"row": row_number, "name": name})

    return Response({"created": created, "updated": updated, "errors": errors})