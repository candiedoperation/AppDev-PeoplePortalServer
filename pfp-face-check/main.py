import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from PIL import Image
from contextlib import asynccontextmanager
import io
import logging
import warnings

logger = logging.getLogger(__name__)

MODEL_PATH = "face_detection_yunet_2023mar.onnx"
SCORE_THRESHOLD = 0.85
MAX_UPLOAD_BYTES = 1_000_000
MAX_IMAGE_DIMENSION = 4096


def create_detector(input_size, score_threshold=SCORE_THRESHOLD):
    return cv2.FaceDetectorYN.create(
        MODEL_PATH, "", input_size, score_threshold=score_threshold
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        detector = create_detector((320, 320))
        if detector is None:
            raise RuntimeError("OpenCV did not create the face detector")
        app.state.model_ready = True
    except Exception:
        logger.exception("Face detection model failed to initialize")
        app.state.model_ready = False
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    if not getattr(app.state, "model_ready", False):
        return JSONResponse(status_code=503, content={"status": "unhealthy"})
    return {"status": "ok"}


def check_photo_bytes(image_bytes, score_threshold=SCORE_THRESHOLD):
    # Inspect dimensions before decoding the full image into memory. Pillow's
    # default warning threshold is intentionally ignored here because the
    # stricter application limit below returns a clear rejection instead.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(image_bytes)) as source_img:
            width, height = source_img.size
            if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
                return {
                    "passed": False,
                    "reason": "image_dimensions_too_large",
                    "count": 0,
                }
            pil_img = source_img.convert("RGB")

    img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    height, width = img.shape[:2]
    detector = create_detector((width, height), score_threshold)
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
    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        return {"passed": False, "reason": "file_too_large", "count": 0}

    if not getattr(app.state, "model_ready", False):
        return {"passed": True, "reason": "service_unavailable"}

    try:
        result = check_photo_bytes(contents)
    except Exception:
        logger.exception("Photo processing failed")
        return {"passed": True, "reason": "processing_error"}
    return result
