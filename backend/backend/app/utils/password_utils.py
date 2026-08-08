import hashlib
import hmac
import os
import base64

try:
    import bcrypt
    _BCRYPT = True
except Exception:
    _BCRYPT = False

_ITERATIONS = 120_000


def hash_password(password: str) -> str:
    """Hash a password with bcrypt (falls back to PBKDF2-HMAC-SHA256)."""
    if _BCRYPT:
        raw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        return f"bcrypt${raw.decode('ascii')}"
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS)
    salt_b64 = base64.urlsafe_b64encode(salt).decode()
    dk_b64 = base64.urlsafe_b64encode(dk).decode()
    return f"pbkdf2_sha256${_ITERATIONS}${salt_b64}${dk_b64}"


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a stored hash. Constant-time comparison."""
    if not hashed:
        return False
    try:
        if hashed.startswith("bcrypt$"):
            if not _BCRYPT:
                return False
            return bcrypt.checkpw(password.encode("utf-8"), hashed.split("$", 1)[1].encode("ascii"))
        algo, iterations, salt_b64, dk_b64 = hashed.split("$")
        salt = base64.urlsafe_b64decode(salt_b64.encode())
        expected = base64.urlsafe_b64decode(dk_b64.encode())
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False
