"""
Outlook and efax referral intake. PLACEHOLDER MODULE.

The plan, once your Microsoft 365 admin approves an app registration with
Mail.Read permission on the intake mailbox:

  1. poll_inbox() authenticates to Microsoft Graph with the client
     credentials in settings (MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID,
     MS_GRAPH_CLIENT_SECRET) and lists unread messages in
     OUTLOOK_INTAKE_MAILBOX.
  2. Each message runs through the active OutlookIntakeRule rows to decide
     whether it is a referral and what urgency to assign.
  3. extract_referral_fields() sends the subject and body to the AI layer
     to pull out client name, diagnosis, contact details, and care needs.
  4. A Referral row is created with source set to "outlook" so the customer
     service queue shows where it came from.

Nothing below runs against Microsoft yet. The functions exist so the rest
of the platform can be wired and demonstrated today.
"""
from django.conf import settings


def graph_is_configured() -> bool:
    return bool(settings.MS_GRAPH_TENANT_ID and settings.MS_GRAPH_CLIENT_ID and settings.MS_GRAPH_CLIENT_SECRET)


def poll_inbox():
    """Stub. Returns a status the admin panel can display."""
    if not graph_is_configured():
        return {"status": "not_configured",
                "detail": "Microsoft Graph credentials are not set. Ask your Microsoft 365 admin to approve an app registration, then fill MS_GRAPH_* in the backend environment."}
    return {"status": "configured",
            "detail": "Credentials present. Implement the Graph polling call here once tenant consent is confirmed."}


def extract_referral_fields(subject: str, body: str) -> dict:
    """Stub for the AI extraction step. Will call the Gemini layer in rag.py."""
    return {"client_name": "", "notes": f"Subject: {subject}\n\n{body[:500]}"}
