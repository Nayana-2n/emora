import warnings
warnings.filterwarnings("ignore")

text_classifier = None
try:
    from transformers import pipeline
    print("[TextProcessor] Loading Emotion Model (j-hartmann/emotion-english-distilroberta-base)...")
    text_classifier = pipeline(
        "text-classification", 
        model="j-hartmann/emotion-english-distilroberta-base", 
        top_k=None
    )
    print("[TextProcessor] Text Emotion Model loaded successfully.")
except Exception as e:
    print(f"[TextProcessor] Warning: Could not load HuggingFace text model ({e}). Using keyword fallback.")

def analyze_text_sentiment(text: str) -> dict:
    """
    Analyzes text transcript and returns percentage distribution across emotions:
    happy, sad, angry, neutral, etc.
    """
    if not text or not text.strip():
        return {"happy": 0.0, "sad": 0.0, "angry": 0.0, "neutral": 100.0}

    results = {"happy": 0.0, "sad": 0.0, "angry": 0.0, "neutral": 0.0}

    if text_classifier:
        try:
            raw_scores = text_classifier(text[:512])[0]
            label_map = {
                'joy': 'happy',
                'sadness': 'sad',
                'anger': 'angry',
                'neutral': 'neutral',
                'disgust': 'angry',
                'fear': 'sad',
                'surprise': 'happy'
            }
            for item in raw_scores:
                lbl = item['label']
                sc = item['score'] * 100.0
                target = label_map.get(lbl, 'neutral')
                results[target] = round(results.get(target, 0.0) + sc, 2)
            
            total = sum(results.values()) or 1.0
            results = {k: round((v / total) * 100.0, 2) for k, v in results.items()}
            return results
        except Exception as err:
            print(f"[TextProcessor] Inference Error ({err}). Using fallback.")

    # Rule/Keyword-based sentiment fallback
    lower = text.lower()
    happy_words = ["happy", "great", "good", "awesome", "joy", "excited", "love", "wonderful", "calm", "relax", "smil"]
    sad_words = ["sad", "depressed", "unhappy", "cry", "crying", "lonely", "hopeless", "hurt", "grief", "pain", "blue", "down", "miserable", "upset", "tired", "stressed"]
    angry_words = ["angry", "mad", "furious", "hate", "annoyed", "frustrated", "screaming", "rage", "irritated", "pissed", "resent"]

    h_score = sum(30 for w in happy_words if w in lower)
    s_score = sum(30 for w in sad_words if w in lower)
    a_score = sum(30 for w in angry_words if w in lower)

    total_detected = h_score + s_score + a_score
    if total_detected == 0:
        return {"happy": 10.0, "sad": 10.0, "angry": 10.0, "neutral": 70.0}

    # The detected emotion should dominate; neutral is just a small remainder.
    n_score = 15.0
    total = total_detected + n_score
    return {
        "happy": round((h_score / total) * 100.0, 2),
        "sad": round((s_score / total) * 100.0, 2),
        "angry": round((a_score / total) * 100.0, 2),
        "neutral": round((n_score / total) * 100.0, 2),
    }

if __name__ == "__main__":
    print("--- Text Processor Test ---")
    print(analyze_text_sentiment("I feel really happy and excited about life!"))