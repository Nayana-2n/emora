"""Nearby mental-health professional search.

Proxies the Google Places API to find real, nearby psychologists /
psychiatrists / counseling centers for a given location. Requires a
GOOGLE_PLACES_API_KEY in the environment.

We NEVER fabricate provider listings: when no key is configured the endpoint
returns an explicit "not configured" state so the frontend can show an honest
empty state alongside crisis resources.
"""

import json
import os
import urllib.parse
import urllib.request

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.core.security import get_current_user

router = APIRouter()

QUERY_TYPES = {
    "psychologist": "psychologist",
    "psychiatrist": "psychiatrist",
    "counselor": "counselor",
    "counseling": "counseling center",
}


def _nearby_search(lat: float, lng: float, query: str, api_key: str) -> list[dict]:
    base = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        "query": query,
        "location": f"{lat},{lng}",
        "radius": "10000",
        "key": api_key,
    }
    url = base + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    results = []
    for r in data.get("results", []):
        results.append({
            "name": r.get("name"),
            "address": r.get("formatted_address"),
            "rating": r.get("rating"),
            "open_now": (r.get("opening_hours") or {}).get("open_now"),
            "place_id": r.get("place_id"),
        })
    return results


@router.get("/professionals/search")
def search_professionals(
    query: str = "psychologist",
    lat: float | None = None,
    lng: float | None = None,
    user=Depends(get_current_user),
):
    """Search for real nearby professionals by keyword + coordinates."""
    key = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()
    if not key:
        return JSONResponse(
            status_code=501,
            content={
                "configured": False,
                "detail": "Provider search is not configured on this server. Crisis resources are shown instead.",
            },
        )
    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Location is required (lat and lng).")
    query_key = QUERY_TYPES.get(query.strip().lower(), "psychologist")
    try:
        results = _nearby_search(lat, lng, query_key, key)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Provider search failed: {e}")
    return {"configured": True, "query": query_key, "count": len(results), "results": results}
