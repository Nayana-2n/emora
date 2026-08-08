def normalize_score(value: float) -> int:
    try:
        v = 0.0 if value is None else float(value)
    except Exception:
        v = 0.0
    if v < 0.0:
        v = 0.0
    if v > 1.0:
        v = 1.0
    return int(round(v * 100))
