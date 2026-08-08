import os
import uuid
import subprocess
from pathlib import Path
from fastapi import UploadFile

UPLOAD_DIR = "static/uploads"

def ensure_dir():
    os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_upload(file: UploadFile) -> str:
    ensure_dir()
    name = file.filename or "upload.bin"
    base = uuid.uuid4().hex + "_" + os.path.basename(name)
    path = os.path.join(UPLOAD_DIR, base)
    with open(path, "wb") as f:
        f.write(file.file.read())
    return path

def split_video_audio(path: str) -> tuple[str, str]:
    """Split and re-encode the uploaded video into separate mp4 video and wav audio files.
    Re-encodes webm/raw streams to standard H.264 mp4 so OpenCV can read every frame reliably.
    """
    try:
        src = Path(path)
        base = src.with_suffix("")
        out_video = base.with_name(base.name + "_video.mp4")
        out_audio = base.with_name(base.name + "_audio.wav")

        out_video.parent.mkdir(parents=True, exist_ok=True)

        # Extract audio to WAV using ffmpeg
        subprocess.run([
            "ffmpeg", "-y", "-fflags", "+genpts", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", str(out_audio)
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)

        # Re-encode video to MP4 (H.264) for OpenCV compatibility
        subprocess.run([
            "ffmpeg", "-y", "-fflags", "+genpts", "-i", str(src), "-avoid_negative_ts", "make_zero", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-an", str(out_video)
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)

        v_res = str(out_video) if out_video.exists() and out_video.stat().st_size > 0 else path
        a_res = str(out_audio) if out_audio.exists() and out_audio.stat().st_size > 0 else path

        return v_res, a_res
    except Exception:
        return path, path
