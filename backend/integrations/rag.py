"""
The AI layer: retrieval augmented generation (RAG) with Google Gemini.

How it works, in plain terms:
  1. Retrieve: pull the pieces of CareLink data the asking user is allowed
     to see (resources always, plus role scoped referrals, shifts, and so on).
  2. Augment: paste those pieces into the prompt as context.
  3. Generate: ask Gemini to answer using only that context.

Role scoping happens at retrieval time, so two users asking the same
question get answers built only from data their own role can access. This
mirrors the API permission rules, the model never sees data the user
could not open in the interface anyway.

If GEMINI_API_KEY is not set the functions return a friendly offline
answer, so the demo never crashes without a key.
"""
import json

import requests
from django.conf import settings

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


def _call_gemini(prompt: str) -> str:
    if not settings.GEMINI_API_KEY:
        return ("The AI assistant is not connected yet. Add a GEMINI_API_KEY to the backend "
                "environment to turn it on. Until then, try the Resources page for care guides.")
    try:
        response = requests.post(
            f"{GEMINI_URL}?key={settings.GEMINI_API_KEY}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        return "The AI service could not be reached right now. Please try again in a moment."


def _keyword_score(text: str, question: str) -> int:
    """Tiny relevance score: how many question words appear in the text.
    A vector database is the upgrade path, this keeps the demo dependency free."""
    words = [w.lower() for w in question.split() if len(w) > 3]
    lowered = text.lower()
    return sum(1 for w in words if w in lowered)


def retrieve_context(user, question: str) -> str:
    """Gather role scoped snippets relevant to the question."""
    from care.models import Referral, Resource, Shift

    chunks = []

    # Published care resources, filtered to this role's audience, exactly
    # like the Resources page and the admin Resources screen agree on.
    # An empty audience means everyone can see it.
    resources = Resource.objects.filter(published=True)
    visible_resources = [r for r in resources if not r.audience or user.role in r.audience]
    for resource in visible_resources:
        text = f"RESOURCE [{resource.category}] {resource.title}: {resource.summary} {resource.content}"
        chunks.append((_keyword_score(text, question), text[:1200]))

    # Role scoped operational data.
    role = user.role
    if role in ("admin", "customer_service", "manager"):
        for referral in Referral.objects.order_by("-created_at")[:30]:
            text = f"REFERRAL {referral.client_name}, urgency {referral.urgency}, status {referral.status}, notes: {referral.notes}"
            chunks.append((_keyword_score(text, question), text))
    if role == "field_staff":
        for shift in Shift.objects.filter(field_staff=user).order_by("-start_time")[:20]:
            text = f"YOUR SHIFT with {shift.client.full_name} on {shift.start_time:%b %d %I:%M %p}, status {shift.status}, location {shift.location}"
            chunks.append((_keyword_score(text, question), text))
    if role == "client":
        for shift in Shift.objects.filter(client=user).order_by("-start_time")[:20]:
            text = f"YOUR VISIT with {shift.field_staff.full_name} on {shift.start_time:%b %d %I:%M %p}, status {shift.status}"
            chunks.append((_keyword_score(text, question), text))

    chunks.sort(key=lambda c: c[0], reverse=True)
    top = [text for score, text in chunks[:8] if score > 0] or [text for _, text in chunks[:4]]
    return "\n\n".join(top)


GUIDE_SUMMARY = """CareLink navigation guide:
Hospital partners submit referrals under My Referrals and click New referral.
Customer service reviews the Referral queue, builds the Schedule, and handles Emergencies.
Field staff see My Schedule, confirm shifts, clock in within 15 minutes and 100 meters, and log Documentation.
Clients see their visits on Home and Calendar, manage Family access, browse Resources, and can press Emergency request.
Managers approve or decline shift change requests under Approvals.
Everyone can chat under Messages with the people their role is allowed to contact, and tune alerts under Notification settings."""


def assistant_answer(user, question: str) -> str:
    """The floating AI chat bubble: how-to help grounded in the navigation guide plus role data."""
    context = retrieve_context(user, question)
    prompt = (
        "You are the CareLink assistant, a friendly guide inside a healthcare coordination platform. "
        f"The user's role is {user.role}. Answer their question using the guide and context below. "
        "Keep answers short, concrete, and step by step when explaining where to click. "
        "If the answer is not in the context, say so and point them to the closest page.\n\n"
        f"GUIDE:\n{GUIDE_SUMMARY}\n\nCONTEXT:\n{context}\n\nQUESTION: {question}"
    )
    return _call_gemini(prompt)


def search_answer(user, question: str) -> str:
    """Role scoped AI search: answers grounded only in data this role can see."""
    context = retrieve_context(user, question)
    prompt = (
        f"You are CareLink's search assistant. The user's role is {user.role}. "
        "Answer the question strictly from the context below, which already contains only "
        "the data this user is permitted to see. If the context does not contain the answer, "
        "say you could not find it rather than guessing.\n\n"
        f"CONTEXT:\n{context}\n\nQUESTION: {question}"
    )
    return _call_gemini(prompt)
