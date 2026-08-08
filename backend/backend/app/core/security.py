import time
import json
import base64
try:
    import jwt  # PyJWT
except Exception:
    jwt = None
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .config import JWT_SECRET, JWT_ALGO, JWT_EXPIRES_MINUTES

bearer = HTTPBearer(auto_error=False)

# In-memory logout blacklist. Tokens here are rejected until they expire.
REVOKED_TOKENS: set[str] = set()


def create_access_token(user_id: str, expires_in: int | None = None) -> str:
    if expires_in is None:
        expires_in = JWT_EXPIRES_MINUTES * 60
    payload = {"sub": user_id, "exp": int(time.time()) + expires_in}
    if jwt:
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)
    raw = json.dumps(payload).encode()
    return base64.urlsafe_b64encode(raw).decode()


def revoke_token(token: str) -> None:
    REVOKED_TOKENS.add(token)


def decode_token(token: str) -> dict:
    if token in REVOKED_TOKENS:
        raise HTTPException(status_code=401, detail="Token revoked")
    if jwt:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    else:
        data = json.loads(base64.urlsafe_b64decode(token.encode()).decode())
    return data


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if not creds or not creds.scheme.lower() == "bearer":
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        data = decode_token(creds.credentials)
        return {"user_id": data.get("sub")}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
