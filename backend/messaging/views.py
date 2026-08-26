"""Conversation and message endpoints. Realtime delivery lives in consumers.py."""
import random

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Max
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from accounts.models import Roles, User
from notifications.utils import notify
from .models import Conversation, ConversationParticipant, Message
from .rules import can_message, eligible_contacts


@api_view(["GET"])
def contacts_view(request):
    """The new chat picker: only people the caller may message, searchable."""
    qs = eligible_contacts(request.user).exclude(invite_status="deactivated")
    q = request.query_params.get("q", "").strip()
    if q:
        qs = qs.filter(full_name__icontains=q)
    return Response([
        {"id": u.id, "full_name": u.full_name, "role": u.role}
        for u in qs.order_by("full_name")[:50]
    ])


@api_view(["GET", "POST"])
def conversations_view(request):
    user = request.user
    if request.method == "POST":
        other_id = request.data.get("user_id")
        try:
            other = User.objects.get(id=other_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=404)
        if not can_message(user, other):
            return Response({"detail": "You are not able to message this person."}, status=403)
        # Reuse the existing direct conversation if there is one.
        existing = (
            Conversation.objects.filter(participants__user=user)
            .filter(participants__user=other)
            .first()
        )
        if existing:
            return Response({"id": existing.id, "existing": True})
        conversation = Conversation.objects.create(created_by=user)
        ConversationParticipant.objects.create(conversation=conversation, user=user)
        ConversationParticipant.objects.create(conversation=conversation, user=other)
        return Response({"id": conversation.id, "existing": False}, status=201)

    memberships = ConversationParticipant.objects.filter(user=user).select_related("conversation")
    results = []
    for membership in memberships:
        conversation = membership.conversation
        other = (
            ConversationParticipant.objects.filter(conversation=conversation)
            .exclude(user=user).select_related("user").first()
        )
        last = conversation.messages.order_by("-created_at").first()
        unread = conversation.messages.exclude(sender=user)
        if membership.last_read_at:
            unread = unread.filter(created_at__gt=membership.last_read_at)
        results.append({
            "id": conversation.id,
            "other_user": {"id": other.user.id, "full_name": other.user.full_name, "role": other.user.role} if other else None,
            "last_message": {"body": last.body[:120], "created_at": last.created_at, "mine": last.sender_id == user.id} if last else None,
            "unread_count": unread.count(),
        })
    results.sort(key=lambda r: (r["last_message"] or {}).get("created_at") or timezone.now(), reverse=True)
    return Response(results)


@api_view(["GET", "POST"])
def messages_view(request, conversation_id):
    user = request.user
    membership = ConversationParticipant.objects.filter(conversation_id=conversation_id, user=user).first()
    if membership is None:
        return Response({"detail": "Conversation not found."}, status=404)

    if request.method == "POST":
        body = (request.data.get("body") or "").strip()
        if not body:
            return Response({"detail": "Message body is required."}, status=400)
        message = Message.objects.create(conversation_id=conversation_id, sender=user, body=body)
        payload = {
            "kind": "message",
            "conversation_id": conversation_id,
            "id": message.id,
            "sender_id": user.id,
            "sender_name": user.full_name,
            "body": message.body,
            "created_at": message.created_at.isoformat(),
        }
        # Push the message live to every participant, and drop a notification
        # for the recipient so muted tabs still learn about it.
        layer = get_channel_layer()
        for participant in ConversationParticipant.objects.filter(conversation_id=conversation_id).select_related("user"):
            try:
                async_to_sync(layer.group_send)(f"user_{participant.user_id}", {"type": "push", "payload": payload})
            except Exception:
                pass
            if participant.user_id != user.id:
                notify(participant.user, "messages", f"New message from {user.full_name}", body[:140], link="/messages")
        return Response(payload, status=201)

    membership.last_read_at = timezone.now()
    membership.save(update_fields=["last_read_at"])
    messages = Message.objects.filter(conversation_id=conversation_id).select_related("sender")
    return Response([
        {"id": m.id, "sender_id": m.sender_id, "sender_name": m.sender.full_name,
         "body": m.body, "created_at": m.created_at}
        for m in messages
    ])


@api_view(["POST"])
def connect_agent_view(request):
    """
    Hospital partner support: pair the caller with a customer service agent.

    Reuses an existing conversation with any customer service agent if the
    hospital partner already has one, so asking for help twice does not
    fragment their history across a second random agent. Otherwise picks
    an active customer service agent at random and starts a conversation
    with them.
    """
    user = request.user
    if user.role != Roles.HOSPITAL_PARTNER:
        return Response({"detail": "This is for hospital partners only."}, status=403)

    existing = (
        ConversationParticipant.objects.filter(user=user)
        .filter(conversation__participants__user__role=Roles.CUSTOMER_SERVICE)
        .select_related("conversation")
        .first()
    )
    if existing:
        other = (
            ConversationParticipant.objects.filter(conversation=existing.conversation)
            .exclude(user=user).select_related("user").first()
        )
        return Response({
            "id": existing.conversation.id,
            "agent_name": other.user.full_name if other else "",
            "existing": True,
        })

    agents = list(User.objects.filter(role=Roles.CUSTOMER_SERVICE, invite_status="active"))
    if not agents:
        return Response({"detail": "No customer service agents are available right now. Please try again shortly."}, status=503)
    agent = random.choice(agents)

    conversation = Conversation.objects.create(created_by=user)
    ConversationParticipant.objects.create(conversation=conversation, user=user)
    ConversationParticipant.objects.create(conversation=conversation, user=agent)
    return Response({"id": conversation.id, "agent_name": agent.full_name, "existing": False}, status=201)
