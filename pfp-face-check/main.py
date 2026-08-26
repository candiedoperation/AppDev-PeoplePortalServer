import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File
from PIL import Image
import io

app = FastAPI()

MODEL_PATH = "face_detection_yunet_2023mar.onnx"
SCORE_THRESHOLD = 0.85


@app.get("/health")
async def health():
    return {"status": "ok"}


def check_photo_bytes(image_bytes, score_threshold=SCORE_THRESHOLD):
    # Use PIL for robust format handling (JPEG/PNG/WEBP/HEIC), per earlier discussion
    pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    height, width = img.shape[:2]
    detector = cv2.FaceDetectorYN.create(
        MODEL_PATH, "", (width, height), score_threshold=score_threshold
    )
    _, faces = detector.detect(img)
    faces = [] if faces is None else [f for f in faces if f[-1] >= score_threshold]
    count = len(faces)

    if count == 0:
        return {"passed": False, "reason": "no_face_detected", "count": 0}
    if count > 1:
        return {"passed": False, "reason": "multiple_faces_detected", "count": count}
    return {"passed": True, "reason": "ok", "count": 1}

@app.post("/check-photo")
async def check_photo(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        result = check_photo_bytes(contents)
    except Exception as e:
        return {"passed": True, "reason": "processing_error", "error": str(e)}
    return result
