import base64
import hmac
import os
import re
from io import BytesIO

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from PIL import Image
from rembg import remove, new_session

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
    raise HTTPException(status_code=422, detail="Specify a solid background color: white, black, blue, green, red, gray or yellow.")


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
        if _session is None:
            _session = new_session(os.getenv("IRHCF_REMBG_MODEL", "u2netp"))
        cutout_bytes = remove(original, session=_session, force_return_bytes=True)
        subject = Image.open(BytesIO(cutout_bytes)).convert("RGBA")
        if subject.size != original.size:
            subject = subject.resize(original.size, Image.Resampling.LANCZOS)
        background = Image.new("RGBA", subject.size, (*rgb, 255))
        background.alpha_composite(subject)
        output = BytesIO()
        background.convert("RGB").save(output, format="PNG", optimize=True)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Local background segmentation failed.") from exc
    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    return {"success": True, "mediaType": "image", "mimeType": "image/png", "image": "data:image/png;base64," + encoded, "format": "data_url", "provider": "irhcf-local", "operation": "background-replacement", "background": {"rgb": list(rgb)}}
