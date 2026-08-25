"""
Email delivery via SendGrid.

Used for invite emails (single and bulk), and password reset OTP codes.
Without SENDGRID_API_KEY set, emails are printed to the console instead of
sent, so the platform works end to end without a SendGrid account, and you
can copy links straight out of the terminal during local development.
"""
from django.conf import settings


def send_email(to_email: str, subject: str, html_content: str) -> dict:
    """Send one email. Returns a small status dict, never raises."""
    if not settings.SENDGRID_API_KEY:
        print(f"\n[email not sent, no SENDGRID_API_KEY set]\nTo: {to_email}\nSubject: {subject}\n{html_content}\n")
        return {"status": "console_only", "detail": "SENDGRID_API_KEY is not set, printed to console instead."}
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        message = Mail(
            from_email=settings.SENDGRID_FROM_EMAIL,
            to_emails=to_email,
            subject=subject,
            html_content=html_content,
        )
        client = SendGridAPIClient(settings.SENDGRID_API_KEY)
        response = client.send(message)
        return {"status": "sent", "detail": f"SendGrid responded {response.status_code}."}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}


def send_invite_email(to_email: str, full_name: str, invite_link: str) -> dict:
    subject = "You have been invited to CareLink"
    html = (
        f"<p>Hi {full_name or to_email},</p>"
        f"<p>You have been invited to CareLink. Click the link below to set your password and get started.</p>"
        f'<p><a href="{invite_link}">{invite_link}</a></p>'
        f"<p>This link expires in 7 days.</p>"
    )
    return send_email(to_email, subject, html)


def send_otp_email(to_email: str, code: str) -> dict:
    subject = "Your CareLink password reset code"
    html = (
        f"<p>Your CareLink password reset code is:</p>"
        f"<h2>{code}</h2>"
        f"<p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>"
    )
    return send_email(to_email, subject, html)