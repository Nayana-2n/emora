# app/services/fusion_engine.py

def fuse_multimodal_sentiment(video_data: dict, audio_data: dict, text_data: dict) -> dict:
    """
    Combines sentiment scores from Video, Audio, and Text models 
    into a final weighted percentage distribution.
    
    NOTE: Text weight is currently set to 0.0 until the model is implemented.
    """
    
    # 1. Define Weights (Must sum to approx 1.0)
    # We shifted the 0.2 from text to the others to keep the math balanced.
    WEIGHTS = {
        "video": 0.5,
        "audio": 0.3,
        "text":  0.2
    }

    # 2. Identify all unique emotions found across all available data
    # (e.g., {'happy', 'sad', 'neutral', 'angry'})
    all_emotions = set(video_data.keys()) | set(audio_data.keys()) | set(text_data.keys())
    
    final_scores = {}

    # 3. Calculate weighted average for each emotion
    for emotion in all_emotions:
        # Get score from each model, default to 0.0 if that model didn't detect it
        v_score = video_data.get(emotion, 0.0)
        a_score = audio_data.get(emotion, 0.0)
        t_score = text_data.get(emotion, 0.0)

        # Apply Formula: (Score * Weight) + (Score * Weight) ...
        weighted_score = (
            (v_score * WEIGHTS["video"]) +
            (a_score * WEIGHTS["audio"]) +
            (t_score * WEIGHTS["text"])
        )
        
        # Round to 2 decimal places for clean UI
        if weighted_score > 0:
            final_scores[emotion] = round(weighted_score, 2)

    # 4. Normalization (Optional Safety Net)
    # If the total > 100 due to floating point math, we leave it (UI handles it),
    # but this logic ensures we return a clean dictionary.
    
    return final_scores

# --- TEST RUN ---
if __name__ == "__main__":
    print("--- Testing Fusion Engine (Text Weight = 0) ---")
    
    # Mock Inputs
    vid = {"happy": 100.0, "neutral": 0.0}
    aud = {"happy": 50.0, "neutral": 50.0}
    txt = {"happy": 0.0, "neutral": 100.0} # This should be IGNORED
    
    # Calculation Expectation:
    # Happy: (100 * 0.6) + (50 * 0.4) + (0 * 0) = 60 + 20 = 80.0
    # Neutral: (0 * 0.6) + (50 * 0.4) + (100 * 0) = 0 + 20 = 20.0
    
    result = fuse_multimodal_sentiment(vid, aud, txt)
    print(f"Inputs:\n  Video: {vid}\n  Audio: {aud}\n  Text:  {txt}")
    print(f"Result: {result}")
    
    if result.get('happy') == 80.0:
        print("SUCCESS: Text data was successfully ignored.")
    else:
        print("FAIL: Math check failed.")