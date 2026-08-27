"""
The AI layer: an agent loop over Gemini with three grounding sources.

How it works, in plain terms:
  1. The question, plus a short guide to the platform, goes to Gemini
     along with a list of tools it is allowed to call: our own database
     functions (tools.py), our resource library search (also in
     tools.py, backed by embeddings.py), and Gemini's built in Google
     Search grounding.
  2. Gemini decides, per question, whether it needs to call one or more
     of those tools before it can answer, none of them, or several in
     sequence.
  3. If it calls one of our own functions, we run it right here, with
     the asking user's role enforced exactly like it would be if they
     had hit the equivalent REST endpoint directly, and hand the result
     back to Gemini as a function response.
  4. Gemini keeps going, tool call after tool call if it needs to, until
     it has enough to write a final answer, which is what gets returned.

This replaces the old approach of keyword-counting the last 30 referrals
or 20 shifts and pasting them into one prompt. Now the model asks for
exactly the data it needs, and what it gets back is a real, permission
checked query result, not a guess about which rows might be relevant.

If GEMINI_API_KEY is not set the functions return a friendly offline
answer, so the demo never crashes without a key.
"""
import logging

import requests
from django.conf import settings

from . import tools

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent"

# How many rounds of "call a tool, read the result, decide what's next"
# one question is allowed before we give up and tell the user to
# rephrase. Five is generous, most questions resolve in zero or one.
MAX_TOOL_ROUNDS = 5

# Kept up to date with the actual navigation and workflow, since this is
# what stops the assistant from confidently describing a screen that
# doesn't exist for the asking role (for example, hospital partners have
# no Messages page: they connect with a person from right inside this
# same assistant chat instead).
GUIDE_SUMMARY = """CareLink navigation guide:
Hospital partners submit referrals under My Referrals and click New referral, then track status there. They do not have a separate Messages page. To reach a person, they ask this assistant (in this same chat window) to connect them with a customer service representative; a "Talk to customer service" option also appears in the chat after a couple of questions, and clicking it pairs them with an available agent right here, no navigation needed.
Customer service reviews the Referral queue, builds the Schedule, and handles Emergencies.
Field staff see My Schedule, confirm shifts, clock in within 15 minutes and 100 meters of the client's address (clocking in farther away requires typing a reason, which is logged and sent to their manager), clock out only in the last 7 minutes of the shift with no exceptions, request a reschedule or cancellation with a reason chosen from a set list, and log Documentation.
Clients see their visits on Home and Calendar, manage Family access, browse Resources, and can press Emergency request. Requesting a reschedule or cancellation on a visit also uses a reason list.
Managers approve or decline shift change requests under Approvals; customer service and admins can also decide a request if it has been waiting a while.
Admin, manager, customer service, field staff, and clients can chat under Messages with the people their role is allowed to contact, and tune alerts under Notification settings."""


def _offline_message() -> str:
    return ("The AI assistant is not connected yet. Add a GEMINI_API_KEY to the backend "
            "environment to turn it on. Until then, try the Resources page for care guides.")


def _call_gemini_raw(system_text: str, contents: list) -> dict:
    payload = {
        "system_instruction": {"parts": [{"text": system_text}]},
        "contents": contents,
        "tools": [
            {"functionDeclarations": tools.FUNCTION_DECLARATIONS},
            {"googleSearch": {}},
        ],
        # Required to combine a built-in tool (googleSearch) with our own
        # custom functions in the same request. Without this flag Gemini
        # rejects the request outright (a 400, "tool use with function
        # calling is unsupported"), which is what was happening here,
        # every single chat request includes both tool types, so every
        # request was failing before it ever reached a model response.
        "toolConfig": {"includeServerSideToolInvocations": True},
    }
    response = requests.post(
        f"{GEMINI_URL}?key={settings.GEMINI_API_KEY}",
        json=payload,
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def _history_to_contents(history) -> list:
    """
    Turns the chat bubble's [{mine, body}, ...] history into Gemini's
    [{role, parts}, ...] shape. mine True is the user's own turn, mine
    False is a previous answer from the assistant. Capped to the last 8
    turns, enough for a question to refer back to "that" or "the one you
    just mentioned" without letting the prompt grow without bound.
    """
    contents = []
    for turn in (history or [])[-8:]:
        text = (turn.get("body") or "").strip()
        if not text:
            continue
        role = "user" if turn.get("mine") else "model"
        contents.append({"role": role, "parts": [{"text": text}]})
    return contents


def _run_agent(system_text: str, question: str, user, history=None) -> str:
    if not settings.GEMINI_API_KEY:
        return _offline_message()

    contents = _history_to_contents(history)
    contents.append({"role": "user", "parts": [{"text": question}]})

    for _ in range(MAX_TOOL_ROUNDS):
        try:
            data = _call_gemini_raw(system_text, contents)
        except requests.HTTPError as exc:
            # Logged with the response body, not just the status code,
            # since Gemini's error detail (in exc.response.text) is
            # usually the only way to tell "bad request" from "no quota"
            # from "wrong model name" apart. Check Render's logs for this
            # line if the AI ever goes quiet again.
            body = exc.response.text if exc.response is not None else ""
            logger.error("Gemini request failed: %s | body: %s", exc, body[:2000])
            return "The AI service could not be reached right now. Please try again in a moment."
        except Exception as exc:
            logger.error("Gemini request failed: %s", exc)
            return "The AI service could not be reached right now. Please try again in a moment."

        candidates = data.get("candidates") or []
        if not candidates:
            return "I could not come up with an answer to that. Try rephrasing the question."

        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        function_calls = [p["functionCall"] for p in parts if "functionCall" in p]

        if not function_calls:
            text_parts = [p.get("text", "") for p in parts if "text" in p]
            answer = "\n".join(t for t in text_parts if t).strip()
            return answer or "I could not come up with an answer to that."

        # The model asked for one or more of our tools. Run each, feed
        # the results back, and let it take another turn.
        contents.append({"role": "model", "parts": parts})
        response_parts = []
        for call in function_calls:
            name = call.get("name")
            args = call.get("args") or {}
            call_id = call.get("id")
            func = tools.TOOL_FUNCTIONS.get(name)
            if func is None:
                result = {"error": f"Unknown tool {name}"}
            else:
                try:
                    result = func(user, **args)
                except Exception as exc:
                    result = {"error": str(exc)}
            function_response = {"name": name, "response": result}
            if call_id:
                # Required whenever toolConfig.includeServerSideToolInvocations
                # is on: the response id must match the call's id so Gemini
                # can line the two up, this isn't optional bookkeeping.
                function_response["id"] = call_id
            response_parts.append({"functionResponse": function_response})
        contents.append({"role": "user", "parts": response_parts})

    return "That question needed more lookups than I could do in one go. Try asking it in a more specific way."


def assistant_answer(user, question: str, history=None) -> str:
    """The floating AI chat bubble: how-to help, grounded in the guide, live data, resources, and the web."""
    system_text = (
        "You are the CareLink assistant, a friendly guide inside a healthcare coordination platform. "
        f"The user's role is {user.role}. Answer their question using the guide below, plus your tools. "
        "Keep answers short, concrete, and step by step when explaining where to click. Use the database "
        "tools for any question about the platform's actual data (referrals, shifts, emergencies, "
        "approvals), use the resource search tool for care guides and policies, and use web search only "
        "for general questions the platform's own data and guides would not cover. If a tool returns an "
        "error because the user's role cannot access it, say so plainly rather than guessing an answer.\n\n"
        f"GUIDE:\n{GUIDE_SUMMARY}"
    )
    return _run_agent(system_text, question, user, history=history)


def search_answer(user, question: str, history=None) -> str:
    """Role scoped AI search: the same agent loop, tuned for direct data questions."""
    system_text = (
        f"You are CareLink's search assistant. The user's role is {user.role}. Answer strictly using the "
        "database tools, the resource search tool, or web search, in that order of preference. Never guess "
        "at data you have not actually retrieved with a tool. If nothing you retrieve answers the question, "
        "say so rather than making something up."
    )
    return _run_agent(system_text, question, user, history=history)
