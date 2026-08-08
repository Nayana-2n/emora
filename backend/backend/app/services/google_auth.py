import secrets
import time
import urllib.parse

import requests

from app.core.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI

_OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_URL = "https://oauth2.googleapis.com/token"
_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
SCOPES = "openid email profile"

# state -> (redirect_url, expires_at). Short-lived; used to prevent CSRF on the
# OAuth callback. Restarting the backend simply invalidates in-flight logins.
_pending_states: dict[str, tuple[str, float]] = {}


def is_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)


def build_auth_url(redirect_to: str) -> str:
    """Build the Google OAuth consent URL the browser should be sent to."""
    state = secrets.token_urlsafe(16)
    _pending_states[state] = (redirect_to, time.time() + 600)
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "state": state,
        "prompt": "select_account",
    }
    return _OAUTH_AUTH_URL + "?" + urllib.parse.urlencode(params)


def exchange_code(code: str, state: str) -> tuple[str, str, str]:
    """Exchange the authorization code for a Google identity.

    Returns (verified_email, display_name, redirect_url).
    Raises ValueError on any invalid/expired step.
    """
    pending = _pending_states.pop(state, None)
    if pending is None:
        raise ValueError("This Google sign-in link has expired. Please try again.")
    redirect_url, _ = pending

    try:
        resp = requests.post(
            _TOKEN_URL,
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=20,
        )
    except requests.RequestException:
        raise ValueError("Unable to connect to Google. Please try again.")
    if resp.status_code != 200:
        raise ValueError("Google Sign-In failed. Please try again.")

    tokens = resp.json()
    try:
        user_resp = requests.get(
            _USERINFO_URL,
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
            timeout=20,
        )
        user_info = user_resp.json()
    except (requests.RequestException, KeyError):
        raise ValueError("Google Sign-In failed. Please try again.")
    if user_resp.status_code != 200:
        raise ValueError("Google Sign-In failed. Please try again.")

    email = (user_info.get("email") or "").strip().lower()
    if not email or not user_info.get("email_verified"):
        raise ValueError("This Google account has no verified email address.")
    return email, user_info.get("name") or "", redirect_url
