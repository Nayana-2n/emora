import os
from dotenv import load_dotenv

load_dotenv(override=True)

# Backend root = directory containing the "app" package (…/backend/backend).
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

APP_ID = os.getenv("APP_ID", "hackathon-app")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
JWT_ALGO = os.getenv("JWT_ALGO", "HS256")
# Default token lifetime: 7 days so closing the browser does not log users out.
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "10080"))

# Storage backend: "firestore" | "sqlite" | "memory".
# - firestore: real Google Firestore (requires credentials; preferred for production).
# - sqlite:    persistent local file database (default when Firestore is not configured).
# - memory:    in-memory only — development/testing fallback, data is LOST on restart.
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "").strip().lower()

# Persistent local data directory (used by the sqlite backend).
DATA_DIR = os.getenv("DATA_DIR", os.path.join(_BACKEND_ROOT, "data"))
os.makedirs(DATA_DIR, exist_ok=True)

FIRESTORE_PROJECT_ID = os.getenv("FIRESTORE_PROJECT_ID")

# Google OAuth (Google Sign-In).
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI", "http://localhost:9000/api/auth/google/callback"
)

_FS_CACHE = None
_FS_RESOLVED = False


def _firestore_creds_present() -> bool:
    if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        return True
    adc_path = os.path.join(
        os.path.expanduser("~"),
        ".config", "gcloud", "application_default_credentials.json",
    )
    return os.path.isfile(adc_path)


def get_firestore():
    global _FS_CACHE, _FS_RESOLVED
    if not _FS_RESOLVED:
        try:
            from google.cloud import firestore
            if _firestore_creds_present():
                if FIRESTORE_PROJECT_ID:
                    _FS_CACHE = firestore.Client(project=FIRESTORE_PROJECT_ID)
                else:
                    _FS_CACHE = firestore.Client()
            else:
                _FS_CACHE = None
        except Exception:
            _FS_CACHE = None
        _FS_RESOLVED = True
    return _FS_CACHE
