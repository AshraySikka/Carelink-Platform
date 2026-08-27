"""
Database tools the AI agent can call.

Each function takes the asking user plus whatever arguments Gemini decided
to pass, checks that user's role is allowed to run it, and returns plain
JSON safe data (a dict). Permission is checked here, in Python, not just
trusted from the model's judgment, so this follows the same rule every
other view in the app already follows: role scoping happens on the
backend, never left to the prompt to get right.

Gemini decides which of these to call, and with what arguments, based on
the "description" text below, that text is doing real work, it is the
only thing telling the model when a tool applies.
"""
from django.db.models import Q
from django.utils import timezone

from accounts.models import Roles
from care.models import EmergencyRequest, Referral, ReferralStatus, Shift, ShiftChangeRequest, Urgency

MAX_ROWS = 25
STAFF_ROLES = {Roles.ADMIN, Roles.CUSTOMER_SERVICE, Roles.MANAGER}


def _denied(user, allowed_roles):
    return user.role not in allowed_roles


def get_flagged_referrals(user, **kwargs):
    """Referrals with a concern flagged that need follow up."""
    if _denied(user, STAFF_ROLES):
        return {"error": "This question needs customer service, manager, or admin access."}
    total = Referral.objects.exclude(concerns_flag="").count()
    rows = Referral.objects.exclude(concerns_flag="").order_by("-created_at")[:MAX_ROWS]
    return {
        "total_matching": total,
        "referrals": [
            {
                "client_name": r.client_name,
                "status": r.status,
                "urgency": r.urgency,
                "concern": r.concerns_flag,
                "assigned_staff": r.assigned_staff.full_name if r.assigned_staff else None,
            }
            for r in rows
        ],
    }


def search_referrals(user, status=None, urgency=None, query=None, **kwargs):
    """Referrals filtered by status, urgency, or a text match on client name or notes."""
    if _denied(user, STAFF_ROLES):
        return {"error": "This question needs customer service, manager, or admin access."}
    qs = Referral.objects.all()
    if status:
        qs = qs.filter(status=status)
    if urgency:
        qs = qs.filter(urgency=urgency)
    if query:
        qs = qs.filter(Q(client_name__icontains=query) | Q(notes__icontains=query))
    total = qs.count()
    rows = qs.order_by("-created_at")[:MAX_ROWS]
    return {
        "total_matching": total,
        "referrals": [
            {
                "client_name": r.client_name,
                "status": r.status,
                "urgency": r.urgency,
                "concern": r.concerns_flag,
                "notes": r.notes[:200],
            }
            for r in rows
        ],
    }


def get_my_shifts(user, when="upcoming", **kwargs):
    """The asking user's own shifts. Only works for field staff or clients, each sees only their own."""
    now = timezone.now()
    if user.role == Roles.FIELD_STAFF:
        qs = Shift.objects.filter(field_staff=user)
        other_field = "client"
    elif user.role == Roles.CLIENT:
        qs = Shift.objects.filter(client=user)
        other_field = "field_staff"
    else:
        return {"error": "This question is answered from a field staff or client's own schedule."}

    if when == "past":
        qs = qs.filter(start_time__lt=now)
    else:
        qs = qs.filter(start_time__gte=now)
    total = qs.count()
    rows = qs.select_related("client", "field_staff").order_by("start_time")[:MAX_ROWS]
    return {
        "total_matching": total,
        "shifts": [
            {
                "with": getattr(s, other_field).full_name,
                "start_time": s.start_time.isoformat(),
                "end_time": s.end_time.isoformat(),
                "status": s.status,
                "location": s.location,
            }
            for s in rows
        ],
    }


def get_pending_change_requests(user, **kwargs):
    """Shift reschedule or cancellation requests still waiting on a decision."""
    if _denied(user, STAFF_ROLES):
        return {"error": "This question needs customer service, manager, or admin access."}
    qs = ShiftChangeRequest.objects.filter(status="pending")
    if user.role == Roles.MANAGER:
        qs = qs.filter(manager=user)
    total = qs.count()
    rows = qs.select_related("shift", "requested_by").order_by("created_at")[:MAX_ROWS]
    return {
        "total_matching": total,
        "requests": [
            {
                "requested_by": r.requested_by.full_name,
                "type": r.request_type,
                "reason": r.get_reason_code_display(),
                "note": r.reason,
                "shift_start": r.shift.start_time.isoformat(),
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
    }


def get_emergencies(user, status=None, **kwargs):
    """Emergency requests. Staff roles see everything, clients see only their own."""
    if user.role == Roles.CLIENT:
        qs = EmergencyRequest.objects.filter(client=user)
    elif user.role in STAFF_ROLES or user.role == Roles.FIELD_STAFF:
        qs = EmergencyRequest.objects.all()
    else:
        return {"error": "This role does not have access to emergency requests."}
    if status:
        qs = qs.filter(status=status)
    total = qs.count()
    rows = qs.select_related("client").order_by("-created_at")[:MAX_ROWS]
    return {
        "total_matching": total,
        "emergencies": [
            {
                "client": e.client.full_name if e.client else None,
                "status": e.status,
                "description": e.description[:200],
                "created_at": e.created_at.isoformat(),
            }
            for e in rows
        ],
    }


def search_resources(user, query, **kwargs):
    """Semantic search over the care resource library. The RAG half of the AI layer."""
    from . import embeddings

    matches = embeddings.semantic_search(query, user, top_k=5)
    if not matches:
        return {
            "results": [],
            "note": "No closely matching resource found. Try a database tool if this is a "
                     "data question, or answer from general knowledge if appropriate.",
        }
    return {
        "results": [
            {"resource_title": c.resource.title, "category": c.resource.category, "excerpt": c.text}
            for c in matches
        ]
    }


FUNCTION_DECLARATIONS = [
    {
        "name": "get_flagged_referrals",
        "description": (
            "Get referrals that have a concern flagged and need follow up. Use this for any "
            "question about flagged, escalated, or concerning referrals or clients."
        ),
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "search_referrals",
        "description": "Search or count referrals by status, urgency, or a text match on client name or notes.",
        "parameters": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": [c[0] for c in ReferralStatus.choices],
                    "description": "Filter by referral status.",
                },
                "urgency": {
                    "type": "string",
                    "enum": [c[0] for c in Urgency.choices],
                    "description": "Filter by urgency level.",
                },
                "query": {"type": "string", "description": "Free text to match against the client name or notes."},
            },
        },
    },
    {
        "name": "get_my_shifts",
        "description": (
            "Get the asking user's own shifts. Only works when the asking user is field staff "
            "or a client, each only ever sees their own shifts."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "when": {
                    "type": "string",
                    "enum": ["upcoming", "past"],
                    "description": "Whether to return future or past shifts. Defaults to upcoming.",
                },
            },
        },
    },
    {
        "name": "get_pending_change_requests",
        "description": "Get shift change requests (reschedules or cancellations) still waiting on a decision.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_emergencies",
        "description": "Get emergency requests, optionally filtered by status.",
        "parameters": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["new", "acknowledged", "resolved"]},
            },
        },
    },
    {
        "name": "search_resources",
        "description": (
            "Search the care resource library (care guides, policies, how-to content) for "
            "material relevant to the question. Use this before answering any general care, "
            "policy, or how-to question, before falling back to general knowledge or web search."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "What to search for."},
            },
            "required": ["query"],
        },
    },
]

TOOL_FUNCTIONS = {
    "get_flagged_referrals": get_flagged_referrals,
    "search_referrals": search_referrals,
    "get_my_shifts": get_my_shifts,
    "get_pending_change_requests": get_pending_change_requests,
    "get_emergencies": get_emergencies,
    "search_resources": search_resources,
}
