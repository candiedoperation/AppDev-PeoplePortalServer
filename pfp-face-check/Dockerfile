FROM python:3.12-slim

# opencv-python requires libGL and libglib2 which are absent on slim images
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN useradd --create-home --uid 10001 appuser

COPY --chown=appuser:appuser main.py .
# face_detection_yunet_2023mar.onnx must be present in the build context
COPY --chown=appuser:appuser face_detection_yunet_2023mar.onnx .

USER appuser

EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
