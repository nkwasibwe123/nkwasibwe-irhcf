import base64
import hmac
import os
import re
from io import BytesIO

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from PIL import Image, ImageEnhance, ImageFilter

app = FastAPI(title="Nkwasibwe IRHCF Local Image Service", version="0.1.0")
MAX_IMAGE_BYTES = 5 * 1024 * 1024
SERVICE_TOKEN = os.getenv("IRHCF_IMAGE_SERVICE_TOKEN", "").strip()
_session = None


class EditRequest(BaseModel):
    imageDataUrl: str = Field(min_length=30, max_length=7_100_000)
    prompt: str = Field(min_length=1, max_length=4000)


def require_service_token(token: str | None):
    if not SERVICE_TOKEN:
        raise HTTPException(status_code=503, detail="Image service token is not configured.")
    if not token or not hmac.compare_digest(token, SERVICE_TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized image service request.")


def background_color(prompt: str):
    p = prompt.lower()
    if not re.search(r"background|back ground|fond|inyuma|ibara", p):
        raise HTTPException(status_code=422, detail="This local engine currently supports background replacement only.")
    colors = [
        (("white", "umweru"), (255, 255, 255)),
        (("black", "umukara"), (0, 0, 0)),
        (("blue", "ubururu"), (40, 110, 220)),
        (("green", "icyatsi"), (30, 150, 75)),
        (("red", "umutuku"), (210, 35, 45)),
        (("gray", "grey", "imvi"), (128, 128, 128)),
        (("yellow", "umuhondo"), (255, 220, 30)),
    ]
    for words, rgb in colors:
        if any(word in p for word in words):
            return rgb
    # A plain request such as “make it clear and change background” defaults to white.
    return (255, 255, 255)


@app.get("/health")
def health():
    return {"success": True, "service": "irhcf-local-image", "ready": True, "capabilities": ["background-replacement-solid-color"]}


@app.post("/edit/background")
def replace_background(payload: EditRequest, x_irhcf_image_token: str | None = Header(default=None)):
    global _session
    require_service_token(x_irhcf_image_token)
    match = re.fullmatch(r"data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)", payload.imageDataUrl)
    if not match:
        raise HTTPException(status_code=400, detail="Use a PNG, JPEG or WebP image.")
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Image data is not valid base64.")
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be no larger than 5 MB.")
    rgb = background_color(payload.prompt)
    try:
        original = Image.open(BytesIO(raw))
        original.verify()
        original = Image.open(BytesIO(raw)).convert("RGBA")
    except Exception:
        raise HTTPException(status_code=400, detail="The uploaded image could not be decoded.")
    try:
        # Keep inference memory bounded on the 512 MB free-tier instance.
        original_size = original.size
        inference_image = original.copy()
        inference_image.thumbnail((768, 768), Image.Resampling.LANCZOS)

        if _session is None:
            import onnxruntime as ort
            from rembg import new_session, remove

            session_options = ort.SessionOptions()
            session_options.intra_op_num_threads = 1
            session_options.inter_op_num_threads = 1
            session_options.enable_cpu_mem_arena = False
            session_options.enable_mem_pattern = False
            _session = new_session(
                os.getenv("IRHCF_REMBG_MODEL", "u2netp"),
                sess_opts=session_options,
            )
        else:
            from rembg import remove

        cutout_bytes = remove(inference_image, session=_session, force_return_bytes=True)
        subject = Image.open(BytesIO(cutout_bytes)).convert("RGBA")
        if subject.size != inference_image.size:
            subject = subject.resize(inference_image.size, Image.Resampling.LANCZOS)
        background = Image.new("RGBA", subject.size, (*rgb, 255))
        background.alpha_composite(subject)
        result = background.convert("RGB").resize(original_size, Image.Resampling.LANCZOS)
        # Mild sharpening improves perceived clarity without inventing image details.
        result = ImageEnhance.Contrast(result).enhance(1.05)
        result = result.filter(ImageFilter.UnsharpMask(radius=1.2, percent=115, threshold=3))
        output = BytesIO()
        result.save(output, format="PNG", optimize=True)
    except Exception as exc:
        print(f"[IMAGE_EDIT] segmentation failed: {type(exc).__name__}: {exc}", flush=True)
        raise HTTPException(status_code=502, detail=f"Local background segmentation failed ({type(exc).__name__}).") from exc
    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    return {"success": True, "mediaType": "image", "mimeType": "image/png", "image": "data:image/png;base64," + encoded, "format": "data_url", "provider": "irhcf-local", "operation": "background-replacement", "background": {"rgb": list(rgb)}}
