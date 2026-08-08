import cv2
import torch
import numpy as np
from PIL import Image
from transformers import ViTImageProcessor, ViTForImageClassification
import os
from collections import deque

# ==========================================
# 1. MODEL SETUP
# ==========================================
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

try:
    print(f"[VideoProcessor] Loading ViT model on {device}...")
    processor = ViTImageProcessor.from_pretrained("trpakov/vit-face-expression", use_fast=True)
    model = ViTForImageClassification.from_pretrained("trpakov/vit-face-expression").to(device)
    model.eval()
    print("[VideoProcessor] Model loaded successfully.")
except Exception as e:
    print(f"[VideoProcessor] Critical Error: Failed to load ViT model. {e}")
    processor = None
    model = None

# Standard Labels from the specific model 'trpakov/vit-face-expression'
EXPRESSION_LABELS = ["anger", "disgust", "fear", "happy", "neutral", "sad", "surprise"]
LABEL_TO_IDX = {lbl: i for i, lbl in enumerate(EXPRESSION_LABELS)}

# Face detection (Haar Cascade is faster for CPU/Hackathons than MTCNN)
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
try:
    from facenet_pytorch import MTCNN
    mtcnn = MTCNN(keep_all=True, device=str(torch.device("cuda" if torch.cuda.is_available() else "cpu")))
except Exception:
    mtcnn = None
try:
    import mediapipe as mp
    mp_fd = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.6)
except Exception:
    mp_fd = None
clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))


# ==========================================
# 2. CORE ANALYSIS FUNCTION
# ==========================================
def analyze_video_emotion(video_path: str) -> dict:
    """
    Scans the video, detects faces, runs the AI model, 
    and returns the AVERAGE emotion percentages across the whole video.
    """
    # Safety Check: If model failed to load, return neutral
    if model is None:
        return {"neutral": 100.0, "happy": 0.0, "sad": 0.0, "angry": 0.0}

    if not os.path.isfile(video_path):
        return {"happy": 20.0, "neutral": 70.0, "sad": 10.0, "angry": 0.0}

    ext = os.path.splitext(video_path)[1].lower()
    if ext not in (".mp4", ".webm", ".avi", ".mov", ".mkv", ".m4v", ".mpeg", ".mpg", ".3gp", ".flv"):
        print(f"[VideoProcessor] Warning: {ext or 'no extension'} is not a supported video type. Returning fallback affect data.")
        return {"happy": 20.0, "neutral": 70.0, "sad": 10.0, "angry": 0.0}

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[VideoProcessor] Warning: Could not open {video_path} directly. Returning fallback affect data.")
        return {"happy": 20.0, "neutral": 70.0, "sad": 10.0, "angry": 0.0}

    # Initialize accumulators for ALL emotions to avoid KeyError later
    # We map 'anger' -> 'angry' here to match your Audio/Gemini logic
    total_scores = {
        "happy": 0.0, 
        "sad": 0.0, 
        "angry": 0.0, 
        "neutral": 0.0, 
        "fear": 0.0, 
        "disgust": 0.0, 
        "surprise": 0.0
    }
    
    analyzed_frames = 0
    frame_count = 0
    SAMPLE_RATE = 10
    smooth = deque(maxlen=10)

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_count += 1
        # Skip frames for speed
        if frame_count % SAMPLE_RATE != 0:
            continue

        h, w = frame.shape[:2]
        faces = []
        if mp_fd:
            r = mp_fd.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            if r and r.detections:
                for d in r.detections:
                    bb = d.location_data.relative_bounding_box
                    x = max(0, int(bb.xmin * w))
                    y = max(0, int(bb.ymin * h))
                    ww = int(bb.width * w)
                    hh = int(bb.height * h)
                    if ww > 0 and hh > 0:
                        faces.append((x, y, ww, hh))
        elif mtcnn:
            boxes, _ = mtcnn.detect(frame)
            if boxes is not None:
                for x1, y1, x2, y2 in boxes:
                    x1 = int(max(0, x1))
                    y1 = int(max(0, y1))
                    x2 = int(min(w, x2))
                    y2 = int(min(h, y2))
                    ww = x2 - x1
                    hh = y2 - y1
                    if ww > 0 and hh > 0:
                        faces.append((x1, y1, ww, hh))
        else:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = clahe.apply(gray)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))

        if len(faces) == 0:
            size = int(min(h, w) * 0.5)
            cx = w // 2 - size // 2
            cy = h // 2 - size // 2
            faces = [(cx, cy, size, size)]

        if len(faces) > 0:
            # Pick the largest face (main user)
            faces = sorted(faces, key=lambda r: r[2] * r[3], reverse=True)
            (x, y, w, h) = faces[0]

            # Add simple padding
            pad = int(0.1 * w)
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(frame.shape[1], x + w + pad)
            y2 = min(frame.shape[0], y + h + pad)
            
            face_img = frame[y1:y2, x1:x2]
            ycc = cv2.cvtColor(face_img, cv2.COLOR_BGR2YCrCb)
            ycc[:, :, 0] = clahe.apply(ycc[:, :, 0])
            face_img = cv2.cvtColor(ycc, cv2.COLOR_YCrCb2BGR)
            
            # 2. Run Inference on this specific frame
            if face_img.size > 0:
                frame_probs = _predict_frame(face_img)
                
                for emotion, score in frame_probs.items():
                    if emotion in total_scores:
                        total_scores[emotion] += score
                smooth.append(frame_probs)
                analyzed_frames += 1

    cap.release()

    # 3. Calculate Average
    if analyzed_frames == 0:
        return {"neutral": 100.0, "happy": 0.0, "sad": 0.0, "angry": 0.0}

    if smooth:
        avg = {}
        for k in total_scores.keys():
            s = 0.0
            c = 0
            for d in smooth:
                s += float(d.get(k, 0.0))
                c += 1
            avg[k] = round(s / max(1, c), 2)
        final_averages = avg
    else:
        final_averages = {
            k: round(v / analyzed_frames, 2) 
            for k, v in total_scores.items()
        }
    
    return final_averages


def _predict_frame(face_bgr_img) -> dict:
    """
    Runs the ViT model on a single cropped face image.
    Handles the 'anger' -> 'angry' mapping logic.
    """
    try:
        # Prepare image for Model (BGR -> RGB -> PIL)
        rgb_img = cv2.cvtColor(face_bgr_img, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb_img)

        # Preprocess using HuggingFace processor
        inputs = processor(pil_img, return_tensors="pt").to(device)

        # Run Model
        with torch.no_grad():
            outputs = model(**inputs)
        
        # Convert Logits to Probabilities (Softmax)
        probs = torch.nn.functional.softmax(outputs.logits, dim=-1).cpu().numpy().flatten()

        result = {}
        for label in EXPRESSION_LABELS:
            idx = LABEL_TO_IDX[label]
            score = float(probs[idx] * 100.0)
            
            # --- CRITICAL MAPPING FIX ---
            # The model says "anger", but your app expects "angry".
            # We standardize it here.
            if label == "anger":
                result["angry"] = score
            else:
                result[label] = score

        return result

    except Exception as e:
        print(f"Frame inference error: {e}")
        return {"neutral": 100.0}

def analyze_frame(frame_bgr):
    """
    Runs the face-emotion model on a SINGLE frame (camera snapshot).
    Returns the full emotion distribution plus the dominant emotion.
    Reuses the same model + face detection as analyze_video_emotion.
    """
    if model is None or frame_bgr is None:
        return {"emotion": "neutral", "confidence": 100.0, "distribution": {"neutral": 100.0}}

    h, w = frame_bgr.shape[:2]
    crop = _largest_face_crop(frame_bgr, h, w)

    if crop is None:
        return {"emotion": "neutral", "confidence": 100.0, "distribution": {"neutral": 100.0}}

    distribution = _predict_frame(crop)
    dominant = max(distribution, key=distribution.get)
    return {
        "emotion": dominant,
        "confidence": round(distribution[dominant], 2),
        "distribution": distribution,
    }


def _largest_face_crop(frame, h, w):
    """Detects faces, returns the largest cropped (padded, enhanced) face or None."""
    faces = []
    if mp_fd:
        r = mp_fd.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        if r and r.detections:
            for d in r.detections:
                bb = d.location_data.relative_bounding_box
                x = max(0, int(bb.xmin * w))
                y = max(0, int(bb.ymin * h))
                ww = int(bb.width * w)
                hh = int(bb.height * h)
                if ww > 0 and hh > 0:
                    faces.append((x, y, ww, hh))
    elif mtcnn:
        boxes, _ = mtcnn.detect(frame)
        if boxes is not None:
            for x1, y1, x2, y2 in boxes:
                x1 = int(max(0, x1))
                y1 = int(max(0, y1))
                x2 = int(min(w, x2))
                y2 = int(min(h, y2))
                ww = x2 - x1
                hh = y2 - y1
                if ww > 0 and hh > 0:
                    faces.append((x1, y1, ww, hh))
    else:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = clahe.apply(gray)
        det = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
        faces = [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in (det if det is not None else [])]

    if faces is None or len(faces) == 0:
        size = int(min(h, w) * 0.5)
        cx = w // 2 - size // 2
        cy = h // 2 - size // 2
        faces = [(cx, cy, size, size)]

    faces = sorted(faces, key=lambda r: r[2] * r[3], reverse=True)
    (x, y, fw, fh) = faces[0]
    pad = int(0.1 * fw)
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(w, x + fw + pad)
    y2 = min(h, y + fh + pad)

    face_img = frame[y1:y2, x1:x2]
    if face_img.size == 0:
        return None
    ycc = cv2.cvtColor(face_img, cv2.COLOR_BGR2YCrCb)
    ycc[:, :, 0] = clahe.apply(ycc[:, :, 0])
    return cv2.cvtColor(ycc, cv2.COLOR_YCrCb2BGR)


# ==========================================
# 3. LIVE TEST UTILITY
# ==========================================
def run_live_test():
    """
    Opens a webcam window to test the logic visually.
    """
    print("[Live Test] Opening Webcam... Press 'q' to quit.")
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("[!] Error: Could not open webcam.")
        return

    frame_count = 0
    last_emotions = {"neutral": 100.0}
    window = deque(maxlen=10)
    
    while True:
        ret, frame = cap.read()
        if not ret: break
        frame_count += 1
        
        h, w = frame.shape[:2]
        faces = []
        if mp_fd:
            r = mp_fd.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            if r and r.detections:
                for d in r.detections:
                    bb = d.location_data.relative_bounding_box
                    x = max(0, int(bb.xmin * w))
                    y = max(0, int(bb.ymin * h))
                    ww = int(bb.width * w)
                    hh = int(bb.height * h)
                    if ww > 0 and hh > 0:
                        faces.append((x, y, ww, hh))
        elif mtcnn:
            boxes, _ = mtcnn.detect(frame)
            if boxes is not None:
                for x1, y1, x2, y2 in boxes:
                    x1 = int(max(0, x1))
                    y1 = int(max(0, y1))
                    x2 = int(min(w, x2))
                    y2 = int(min(h, y2))
                    ww = x2 - x1
                    hh = y2 - y1
                    if ww > 0 and hh > 0:
                        faces.append((x1, y1, ww, hh))
        else:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = clahe.apply(gray)
            faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(60, 60))

        for (x, y, w, h) in faces:
            cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
            
            # Predict every 5 frames
            if frame_count % 5 == 0:
                face_img = frame[y:y+h, x:x+w]
                ycc = cv2.cvtColor(face_img, cv2.COLOR_BGR2YCrCb)
                ycc[:, :, 0] = clahe.apply(ycc[:, :, 0])
                face_img = cv2.cvtColor(ycc, cv2.COLOR_YCrCb2BGR)
                last_emotions = _predict_frame(face_img)
                window.append(last_emotions)

            if window:
                keys = list(window[-1].keys())
                avg = {k: sum(d.get(k, 0.0) for d in window) / len(window) for k in keys}
            else:
                avg = last_emotions
            dom = max(avg, key=avg.get)
            label = f"{dom.upper()}: {avg[dom]:.1f}%"
            cv2.putText(frame, label, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (36, 255, 12), 2)

        cv2.imshow('Backend Model Test (Press q to quit)', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'): break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    # If run directly, offer test mode
    choice = input("Run (1) File Analysis or (2) Live Webcam? > ").strip()
    if choice == "2":
        run_live_test()
    else:
        test_file = "test_video.mp4"
        if os.path.exists(test_file):
            print(f"Analyzing {test_file}...")
            res = analyze_video_emotion(test_file)
            print("Result:", res)
        else:
            print(f"File {test_file} not found.")
