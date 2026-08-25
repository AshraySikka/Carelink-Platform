"""
Invite and password reset tokens.

Uses Django's cryptographic signer so no extra table is needed. The token
carries the user id and expires after INVITE_MAX_AGE_SECONDS.
"""
from django.core import signing

INVITE_SALT = "carelink.invite"
INVITE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7  # one week


def make_invite_token(user_id: int) -> str:
    return signing.dumps({"uid": user_id}, salt=INVITE_SALT)


def read_invite_token(token: str) -> int | None:
    """Return the user id if the token is valid and fresh, otherwise None."""
    try:
        data = signing.loads(token, salt=INVITE_SALT, max_age=INVITE_MAX_AGE_SECONDS)
        return int(data["uid"])
    except (signing.BadSignature, signing.SignatureExpired, KeyError, ValueError):
        return None
