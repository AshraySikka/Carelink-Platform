"""AI endpoints plus the Procura mapping and Outlook rule admin panels."""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsAdmin
from . import outlook, procura, rag
from .models import OutlookIntakeRule, ProcuraFieldMapping


@api_view(["POST"])
def ai_chat_view(request):
    """The floating assistant bubble. Grounded in the guide and role scoped data."""
    question = (request.data.get("question") or "").strip()
    if not question:
        return Response({"detail": "Ask a question first."}, status=400)
    return Response({"answer": rag.assistant_answer(request.user, question)})


@api_view(["POST"])
def ai_search_view(request):
    """Role scoped AI search over the platform's data."""
    question = (request.data.get("question") or "").strip()
    if not question:
        return Response({"detail": "Ask a question first."}, status=400)
    return Response({"answer": rag.search_answer(request.user, question)})


@api_view(["GET", "POST"])
@permission_classes([IsAdmin])
def procura_mappings_view(request):
    if request.method == "POST":
        mapping = ProcuraFieldMapping.objects.create(
            procura_field=request.data.get("procura_field", "").strip(),
            carelink_field=request.data.get("carelink_field", "").strip(),
            notes=request.data.get("notes", ""),
        )
        return Response({"id": mapping.id}, status=201)
    return Response([
        {"id": m.id, "procura_field": m.procura_field, "carelink_field": m.carelink_field, "notes": m.notes}
        for m in ProcuraFieldMapping.objects.order_by("procura_field")
    ])


@api_view(["DELETE"])
@permission_classes([IsAdmin])
def procura_mapping_detail_view(request, mapping_id):
    ProcuraFieldMapping.objects.filter(id=mapping_id).delete()
    return Response(status=204)


@api_view(["POST"])
@permission_classes([IsAdmin])
def procura_sync_view(request):
    """Runs the placeholder sync so the demo shows the intended flow."""
    return Response(procura.sync_from_procura())


@api_view(["GET", "POST"])
@permission_classes([IsAdmin])
def outlook_rules_view(request):
    if request.method == "POST":
        rule = OutlookIntakeRule.objects.create(
            name=request.data.get("name", "").strip(),
            subject_contains=request.data.get("subject_contains", ""),
            sender_contains=request.data.get("sender_contains", ""),
            set_urgency=request.data.get("set_urgency", "normal"),
        )
        return Response({"id": rule.id}, status=201)
    return Response([
        {"id": r.id, "name": r.name, "subject_contains": r.subject_contains,
         "sender_contains": r.sender_contains, "set_urgency": r.set_urgency, "active": r.active}
        for r in OutlookIntakeRule.objects.order_by("name")
    ])


@api_view(["DELETE"])
@permission_classes([IsAdmin])
def outlook_rule_detail_view(request, rule_id):
    OutlookIntakeRule.objects.filter(id=rule_id).delete()
    return Response(status=204)


@api_view(["GET"])
@permission_classes([IsAdmin])
def outlook_status_view(request):
    """Shows whether Microsoft Graph is configured yet."""
    return Response(outlook.poll_inbox())
