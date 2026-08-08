import wave
import os
import numpy as np
import librosa
import torch
import warnings
import speech_recognition as sr
from transformers import pipeline

# Suppress warnings to keep the console clean
warnings.filterwarnings("ignore")

# ==========================================
# 1. LOAD MODELS (Global Scope)
# ==========================================
print("[AudioProcessor] Initializing Audio Services...")

# A. Emotion Model (HuggingFace)
# We use 'superb/hubert-large-superb-er' as it is the standard for Speech Emotion Recognition (SER)
AUDIO_MODEL_ID = "superb/hubert-large-superb-er"
emotion_classifier = None

try:
    print(f"[AudioProcessor] Loading Emotion Model ({AUDIO_MODEL_ID})...")
    emotion_classifier = pipeline("audio-classification", model=AUDIO_MODEL_ID)
    print("[AudioProcessor] Emotion Model Loaded Successfully.")
except Exception as e:
    print(f"[AudioProcessor] (!) Warning: Failed to load Audio Emotion Model. {e}")
    print("[AudioProcessor] Audio sentiment will return 0s.")

# B. Speech Recognizer (for STT)
recognizer = sr.Recognizer()


# ==========================================
# 2. CORE FUNCTIONS
# ==========================================

def analyze_audio_emotion(file_path: str):
    """
    Main entry point.
    Input: Path to video/audio file.
    Output: Tuple ({emotions_dict}, stress_score_float)
    """
    if not os.path.exists(file_path):
        print(f"[AudioProcessor] File not found: {file_path}")
        return {}, 0.0

    try:
        # 1. Load Audio (Resample to 16kHz which models expect)
        # 'duration=30' limits analysis to first 30s to keep API fast
        y, sr_rate = librosa.load(file_path, sr=16000, duration=30)
    except Exception as e:
        print(f"[AudioProcessor] Librosa Load Error: {e}")
        return {}, 0.0

    # 2. Get Emotion Predictions (AI Model)
    emotions = _predict_emotion(y, sr_rate)

    # 3. Calculate Stress (Signal Processing)
    stress_score = _calculate_stress(y, sr_rate)

    return emotions, stress_score


def transcribe_audio(file_path: str) -> str:
    """
    Converts Audio -> Text.
    Useful if the frontend doesn't send the transcript.
    """
    # SpeechRecognition needs a WAV file. 
    # If input is MP4, we might need to rely on the frontend sending text.
    # But if we have a wav/mp4, we can try processing it.
    
    text = ""
    try:
        # Note: sr.AudioFile usually requires WAV/AIFF. 
        # For Hackathon, rely on frontend sending text, OR convert using pydub here.
        # This is a basic fallback using Google's free API.
        with sr.AudioFile(file_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)
    except Exception:
        # If it fails (e.g., file is mp4), return empty string.
        # Converting MP4->WAV in python requires ffmpeg installed on system.
        pass
    
    return text


# ==========================================
# 3. HELPER LOGIC (Internal)
# ==========================================

def _predict_emotion(y, sr_rate) -> dict:
    """Runs the HuggingFace model on the raw audio array."""
    results = {"happy": 0.0, "neutral": 0.0, "sad": 0.0, "angry": 0.0}
    
    if emotion_classifier is None:
        return results

    try:
        # The pipeline expects a filename or numpy array
        # We pass the numpy array 'y' directly
        predictions = emotion_classifier(y, top_k=5)
        
        # Map HuggingFace labels to our standard format
        # Model outputs: 'neu', 'hap', 'ang', 'sad'
        label_map = {
            'neu': 'neutral',
            'hap': 'happy',
            'ang': 'angry',
            'sad': 'sad'
        }

        for p in predictions:
            original_label = p['label']
            score = p['score'] * 100 # Convert 0.9 to 90.0
            
            if original_label in label_map:
                mapped_label = label_map[original_label]
                results[mapped_label] = round(score, 2)
                
    except Exception as e:
        print(f"[AudioProcessor] Inference Error: {e}")
    
    return results


def _calculate_stress(y, sr_rate) -> float:
    """
    Calculates stress (0-100) based on:
    1. Pitch Variance (Jitter) -> High jitter = Nervousness
    2. Amplitude (Loudness) -> High volume = Aggression/Stress
    3. Speaking Rate (Zero Crossing) -> Fast speech = Anxiety
    """
    try:
        # A. RMS Energy (Volume)
        rms = librosa.feature.rms(y=y)
        avg_volume = np.mean(rms)
        
        # B. Pitch Detection (F0)
        # We use a fast method (pyin or piptrack). Piptrack is faster for CPU.
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr_rate)
        
        # Filter out background noise (low magnitude)
        pitches = pitches[magnitudes > np.median(magnitudes)]
        
        # Calculate deviation (Jitter)
        if len(pitches) > 0:
            pitch_std = np.std(pitches)
        else:
            pitch_std = 0.0

        # C. Zero Crossing Rate (Proxy for speech speed)
        zcr = np.mean(librosa.feature.zero_crossing_rate(y=y))

        # --- NORMALIZATION FORMULA ---
        # We convert raw physics numbers into a 0-100 human score.
        # These constants are tuned for standard speech.
        
        # 1. Volume Score (Typical RMS is 0.02 - 0.1)
        vol_score = min(avg_volume * 1000, 100)
        
        # 2. Pitch Score (Typical STD is 20-50Hz)
        pitch_score = min(pitch_std * 2, 100)
        
        # 3. Speed Score
        speed_score = min(zcr * 500, 100)
        
        # Weighted Average for Final Stress
        # Pitch varies most with stress, so it gets higher weight
        final_stress = (vol_score * 0.2) + (pitch_score * 0.5) + (speed_score * 0.3)
        
        return round(final_stress, 2)

    except Exception as e:
        print(f"[AudioProcessor] Stress Calc Error: {e}")
        return 0.0


# ==========================================
# 4. TEST BLOCK
# ==========================================
# ... (Keep all your existing code/functions above this point) ...

# ==========================================
# 5. LIVE TEST LOGIC
# ==========================================

def run_live_audio_test():
    """
    Records audio in 3-second chunks and runs analysis in a loop.
    Prints output to text.
    """
    import pyaudio

    CHUNK = 1024
    FORMAT = pyaudio.paInt16
    CHANNELS = 1
    RATE = 16000 # Matches the model's expected rate
    RECORD_SECONDS = 3
    TEMP_FILENAME = "temp_live_mic.wav"

    p = pyaudio.PyAudio()

    print("\n[Live Audio Test] Initializing Microphone...")
    print("------------------------------------------------")
    print(f"I will record in {RECORD_SECONDS}-second chunks.")
    print("Speak naturally into your mic.")
    print("Press CTRL+C to stop.")
    print("------------------------------------------------\n")

    try:
        while True:
            print("🎤 Recording...", end="", flush=True)
            
            # 1. Open Stream
            stream = p.open(format=FORMAT,
                            channels=CHANNELS,
                            rate=RATE,
                            input=True,
                            frames_per_buffer=CHUNK)

            frames = []

            # 2. Record for N seconds
            for i in range(0, int(RATE / CHUNK * RECORD_SECONDS)):
                data = stream.read(CHUNK)
                frames.append(data)

            print(" Done. Analyzing...", end="", flush=True)

            # 3. Stop Stream
            stream.stop_stream()
            stream.close()

            # 4. Save to Temp File (Because our main function expects a file path)
            wf = wave.open(TEMP_FILENAME, 'wb')
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(p.get_sample_size(FORMAT))
            wf.setframerate(RATE)
            wf.writeframes(b''.join(frames))
            wf.close()

            # 5. Run Analysis
            emotions, stress = analyze_audio_emotion(TEMP_FILENAME)
            
            # 6. Clean Output
            print("\r" + " " * 50 + "\r", end="") # Clear line
            
            # Find dominant emotion
            if emotions:
                dom_emotion = max(emotions, key=emotions.get)
                dom_val = emotions[dom_emotion]
            else:
                dom_emotion = "Unknown"
                dom_val = 0.0

            # Print Status Bar
            print(f"[{dom_emotion.upper()} {dom_val:.0f}%] | Stress Level: {stress:.1f}/100")
            
            if stress > 50:
                print("   ⚠️  High Stress Detected!")

    except KeyboardInterrupt:
        print("\n\n[Live Test] Stopping...")
        if os.path.exists(TEMP_FILENAME):
            os.remove(TEMP_FILENAME)
        p.terminate()

# ==========================================
# MAIN EXECUTION
# ==========================================
if __name__ == "__main__":
    print("--- Audio Processor Service ---")
    print("1. Test with File (test_audio.wav)")
    print("2. Test with Live Microphone")
    
    choice = input("Select mode (1 or 2): ").strip()
    
    if choice == "2":
        run_live_audio_test()
    else:
        test_file = "test_audio.wav"
        if os.path.exists(test_file):
            print(f"Processing: {test_file}")
            ems, stress = analyze_audio_emotion(test_file)
            print(f"Emotions: {ems}")
            print(f"Stress: {stress}")
        else:
            print("File not found.")