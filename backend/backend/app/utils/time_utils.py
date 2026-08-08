import time
from datetime import datetime, timezone


def now_ts() -> int:
    """Current unix timestamp (seconds)."""
    return int(time.time())


def today_str() -> str:
    """Local date as YYYY-MM-DD."""
    return datetime.now().astimezone().strftime("%Y-%m-%d")


def ts_to_date(ts: int) -> str:
    """Convert a unix timestamp to YYYY-MM-DD (local time)."""
    return datetime.fromtimestamp(ts).strftime("%Y-%m-%d")


def validate_date(value: str) -> str:
    """Validate a YYYY-MM-DD string; falls back to today."""
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return value
    except Exception:
        return today_str()
