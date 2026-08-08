from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.utils.time_utils import today_str
from app.services.quotes_data import daily_quote

router = APIRouter()


@router.get("/quotes/today")
def quote_today(user=Depends(get_current_user)):
    """A stable, meaningful daily quote (the same all day, per user)."""
    return daily_quote(today_str())
