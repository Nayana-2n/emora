import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional

from app.core.security import create_access_token, revoke_token, get_current_user, bearer
from app.core.firestore_db import save_doc, get_doc, query_docs
from app.core.config import APP_ID
from app.utils.password_utils import hash_password, verify_password
from app.utils.time_utils import now_ts
from app.models.schemas import UserCreate, LoginRequest, ProfileUpdate
from app.services import google_auth

router = APIRouter()

# Users live at artifacts/{APP_ID}/users/{uid} (same tree as their sessions/features).
_USERS_ROOT = ["artifacts", APP_ID, "users"]


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


def _user_path(uid: str) -> list[str]:
    return _USERS_ROOT + [uid]


def _public_user(user_id: str, doc: dict) -> dict:
    return {
        "user_id": user_id,
        "email": doc.get("email"),
        "display_name": doc.get("display_name") or "",
        "provider": doc.get("provider") or "email",
        "created_at": doc.get("created_at"),
    }


DEMO_EMAIL = "judge@demo.com"
DEMO_PASSWORD = "demo1234"


def seed_demo_account() -> None:
    """Ensure the hackathon demo account exists.

    Render's free tier has no persistent disk, so the SQLite DB is reset on
    every deploy. Recreating the demo account at startup guarantees judges can
    always log in with the demo button regardless of how many times the
    backend redeploys.
    """
    email = DEMO_EMAIL.strip().lower()
    if query_docs(_USERS_ROOT, "email", email):
        return
    user_id = uuid.uuid4().hex
    save_doc(_user_path(user_id), {
        "email": email,
        "password_hash": hash_password(DEMO_PASSWORD),
        "provider": "email",
        "display_name": "Demo Judge",
        "created_at": now_ts(),
    })
    print(f"[seed] Demo account ready: {email}")


@router.post("/signup")
def signup(body: UserCreate):
    identity_docs = query_docs(_USERS_ROOT, "email", body.email)
    if identity_docs:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    display_name = (body.display_name or "").strip()[:50]
    if not display_name:
        display_name = (body.email.split("@")[0] or "").strip()[:50]

    user_id = uuid.uuid4().hex
    save_doc(_user_path(user_id), {
        "email": body.email,
        "password_hash": hash_password(body.password),
        "provider": "email",
        "display_name": display_name,
        "created_at": now_ts(),
    })

    token = create_access_token(user_id)
    return {"access_token": token, "token_type": "bearer", "user": _public_user(user_id, {"email": body.email, "display_name": display_name})}


@router.post("/login")
def login(body: LoginRequest):
    email = (body.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Please enter your email address")
    matches = query_docs(_USERS_ROOT, "email", email)
    if not matches:
        raise HTTPException(status_code=401, detail="Account not found. Please check your email.")
    user = matches[0]
    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="This account uses Google Sign-In. Please use Continue with Google.")
    if not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    user_id = user["id"]
    token = create_access_token(user_id)
    return {"access_token": token, "token_type": "bearer", "user": _public_user(user_id, user)}


@router.post("/logout")
def logout(creds=Depends(bearer)):
    if creds and creds.scheme.lower() == "bearer":
        revoke_token(creds.credentials)
    return {"status": "success"}


@router.get("/me")
def me(user=Depends(get_current_user)):
    doc = get_doc(_user_path(user["user_id"]))
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return _public_user(user["user_id"], doc)


@router.put("/profile")
def update_profile(body: ProfileUpdate, user=Depends(get_current_user)):
    doc = get_doc(_user_path(user["user_id"]))
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    display_name = (body.display_name or "").strip()[:50]
    if not display_name:
        raise HTTPException(status_code=400, detail="Display name cannot be empty")
    save_doc(_user_path(user["user_id"]), {"display_name": display_name})
    updated = get_doc(_user_path(user["user_id"]))
    return _public_user(user["user_id"], updated)


@router.post("/change-password")
def change_password(body: ChangePasswordRequest, user=Depends(get_current_user)):
    doc = get_doc(_user_path(user["user_id"]))
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    if not doc.get("password_hash"):
        raise HTTPException(status_code=400, detail="This account uses Google Sign-In and has no password to change")
    if not verify_password(body.current_password, doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    save_doc(_user_path(user["user_id"]), {"password_hash": hash_password(body.new_password)})
    return {"status": "success"}


# ---------------------------------------------------------------------------
# Google OAuth (real authorization-code flow)
# ---------------------------------------------------------------------------
@router.get("/auth/google/login")
def google_login(redirect: Optional[str] = None):
    """Returns the Google consent URL for the browser to navigate to."""
    if not google_auth.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Google Sign-In is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the backend .env file.",
        )
    target = redirect or "http://localhost:6010/auth/callback"
    return {"url": google_auth.build_auth_url(target)}


@router.get("/auth/google/callback")
def google_callback(code: str = "", state: str = "", error: Optional[str] = None):
    """OAuth callback: exchange code, find-or-create the user, redirect to the
    frontend with a JWT token in the query string."""
    if error:
        raise HTTPException(status_code=400, detail="Google Sign-In failed. Please try again.")
    try:
        email, name, redirect_url = google_auth.exchange_code(code, state)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    matches = query_docs(_USERS_ROOT, "email", email)
    if matches:
        user_id = matches[0]["id"]
        # Account linking: if the account was created with email/password, keep
        # all of the user's existing data — never create a duplicate account.
        save_doc(_user_path(user_id), {"provider": "google", "display_name": name})
    else:
        user_id = uuid.uuid4().hex
        save_doc(_user_path(user_id), {
            "email": email,
            "password_hash": None,
            "provider": "google",
            "display_name": name,
            "created_at": now_ts(),
        })

    token = create_access_token(user_id)
    sep = "&" if "?" in redirect_url else "?"
    return RedirectResponse(url=f"{redirect_url}{sep}token={token}")
