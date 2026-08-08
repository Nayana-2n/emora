"""Daily motivational quotes (static educational content, not user data).

Attribution reflects common published usage. Public-domain proverbs are marked.
Themes keep the daily quote meaningful rather than random.
"""

QUOTES = [
    # (quote, author, theme)
    ("Small steps every day add up to big changes.", "EMORA", "consistency"),
    ("The journey of a thousand miles begins with a single step.", "Lao Tzu", "persistence"),
    ("It does not matter how slowly you go as long as you do not stop.", "Confucius", "consistency"),
    ("Fall seven times, stand up eight.", "Japanese proverb", "persistence"),
    ("You are braver than you believe, stronger than you seem, and smarter than you think.", "A. A. Milne", "confidence"),
    ("Believe you can and you're halfway there.", "Theodore Roosevelt", "confidence"),
    ("Rest is not a reward for finishing. It is part of doing good work well.", "EMORA", "rest"),
    ("Rest when you are weary. Refresh and renew yourself, your body, your energy, your spirit.", "Ralph Marston", "rest"),
    ("Self-care is how you take your power back.", "Lalah Delia", "self-compassion"),
    ("You don't have to be great to start, but you have to start to be great.", "Zig Ziglar", "growth"),
    ("Gratitude turns what we have into enough.", "Melody Beattie", "self-compassion"),
    ("The best time to plant a tree was 20 years ago. The second best time is now.", "Chinese proverb", "growth"),
    ("Almost everything will work again if you unplug it for a few minutes, including you.", "Anne Lamott", "rest"),
    ("Well done is better than well said.", "Benjamin Franklin", "productivity"),
    ("What you do every day matters more than what you do once in a while.", "Gretchen Rubin", "consistency"),
    ("A river cuts through rock not because of its power, but because of its persistence.", "James N. Watkins", "persistence"),
    ("You don't have to see the whole staircase, just take the first step.", "Martin Luther King Jr.", "hope"),
    ("It always seems impossible until it's done.", "Nelson Mandela", "hope"),
    ("Comparison is the thief of joy.", "Theodore Roosevelt", "self-compassion"),
    ("Do what you can, with what you have, where you are.", "Theodore Roosevelt", "growth"),
    ("The only way out is through.", "Robert Frost", "persistence"),
    ("Take time to do what makes your soul happy.", "Anonymous", "self-compassion"),
    ("Focus on being productive instead of busy.", "Tim Ferriss", "productivity"),
    ("One day or day one. You decide.", "Paulo Coelho", "growth"),
]


def daily_quote(day_key: str) -> dict:
    """Deterministic daily quote from a YYYY-MM-DD key (stable all day)."""
    idx = sum(ord(c) for c in day_key) % len(QUOTES)
    quote, author, theme = QUOTES[idx]
    return {"quote": quote, "author": author, "theme": theme, "date": day_key}
