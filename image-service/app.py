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
    mode: str = Field(default="prompt", max_length=20)
    effect: str = Field(default="prompt", max_length=40)
    strength: int = Field(default=50, ge=0, le=100)


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


def infer_effect(prompt: str, requested_effect: str, mode: str) -> str:
    effect = (requested_effect or "prompt").strip().lower()
    supported = {
        "natural", "brightness", "contrast", "saturation", "warmth", "cool",
        "black-white", "sepia", "sharpen", "soft-focus",
        "background-white", "background-blur"
    }
    if effect in supported:
        return effect
    if effect != "prompt" and mode != "prompt":
        raise HTTPException(status_code=422, detail="This local tool is not supported yet.")
    p = prompt.lower()
    if re.search(r"background|back[ -]?ground|fond|inyuma|ibara", p):
        return "background-white"
    if re.search(r"bright|brightness|lighten|urumuri|kurabagirana", p):
        return "brightness"
    if re.search(r"contrast|contrast|itandukaniro", p):
        return "contrast"
    if re.search(r"saturat|vibrant|colorful|amabara menshi", p):
        return "saturation"
    if re.search(r"warm|warmer|warmth|ushyushye", p):
        return "warmth"
    if re.search(r"cool tone|cooler|blue tone|ubururu", p):
        return "cool"
    if re.search(r"black.?and.?white|grayscale|monochrome|umukara n.?umweru", p):
        return "black-white"
    if re.search(r"sepia|vintage", p):
        return "sepia"
    if re.search(r"sharpen|sharp|clarity|clearer|clear|gusobanuka", p):
        return "sharpen"
    if re.search(r"soft.?focus|soften|blur", p):
        return "soft-focus"
    if re.search(r"natural|enhance|improve|kunoza|kunonosora", p):
        return "natural"
    raise HTTPException(
        status_code=422,
        detail="Prompt Mode y'ubuntu ishobora gukora background, brightness, contrast, saturation, warmth, cool tone, black-and-white, sepia, sharpen cyangwa soft-focus. Iri tegeko risaba generative AI itariho ubu."
    )


@app.post("/edit")
@app.post("/edit/background")
def edit_image(payload: EditRequest, x_irhcf_image_token: str | None = Header(default=None)):
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
    effect = infer_effect(payload.prompt, payload.effect, payload.mode)
    strength = max(0, min(100, int(payload.strength)))
    is_background = effect.startswith("background-") or (
        payload.mode == "prompt" and re.search(r"background|back[ -]?ground|fond|inyuma", payload.prompt.lower())
    )
    try:
        original = Image.open(BytesIO(raw))
        original.verify()
        original = Image.open(BytesIO(raw)).convert("RGB")
        original.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
    except Exception:
        raise HTTPException(status_code=400, detail="The uploaded image could not be decoded.")

    try:
        if strength == 0:
            result = original.copy()
        elif is_background:
            # Keep model input small to stay within Render's free 512 MB RAM limit.
            inference_image = original.copy()
            inference_image.thumbnail((512, 512), Image.Resampling.LANCZOS)
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
            if effect == "background-blur":
                background = inference_image.filter(ImageFilter.GaussianBlur(radius=5 + 5 * (strength / 100.0))).convert("RGBA")
                background.alpha_composite(subject)
                result = background.convert("RGB").resize(original.size, Image.Resampling.LANCZOS)
            else:
                rgb = background_color(payload.prompt)
                background = Image.new("RGBA", subject.size, (*rgb, 255))
                background.alpha_composite(subject)
                result = background.convert("RGB").resize(original.size, Image.Resampling.LANCZOS)
        else:
            result = original.copy()
            amount = strength / 100.0
            if effect == "brightness":
                result = ImageEnhance.Brightness(result).enhance(1.0 + 0.65 * amount)
            elif effect == "contrast":
                result = ImageEnhance.Contrast(result).enhance(1.0 + 0.7 * amount)
            elif effect == "saturation":
                result = ImageEnhance.Color(result).enhance(1.0 + 0.9 * amount)
            elif effect == "warmth":
                r, g, b = result.split()
                result = Image.merge("RGB", (
                    r.point(lambda x: min(255, int(x + 22 * amount))),
                    g.point(lambda x: min(255, int(x + 5 * amount))),
                    b.point(lambda x: max(0, int(x - 20 * amount))),
                ))
            elif effect == "cool":
                r, g, b = result.split()
                result = Image.merge("RGB", (
                    r.point(lambda x: max(0, int(x - 18 * amount))),
                    g,
                    b.point(lambda x: min(255, int(x + 22 * amount))),
                ))
            elif effect == "black-white":
                result = ImageEnhance.Color(result).enhance(1.0 - amount)
                if strength >= 50:
                    result = result.convert("L").convert("RGB")
            elif effect == "sepia":
                gray = result.convert("L")
                sepia = Image.merge("RGB", (
                    gray.point(lambda x: min(255, int(x * 1.08))),
                    gray.point(lambda x: min(255, int(x * 0.95))),
                    gray.point(lambda x: min(255, int(x * 0.78))),
                ))
                result = Image.blend(result, sepia, amount)
            elif effect == "soft-focus" or effect == "background-blur":
                blurred = result.filter(ImageFilter.GaussianBlur(radius=1 + 3 * amount))
                result = Image.blend(result, blurred, 0.15 + 0.45 * amount)
            elif effect == "sharpen" or effect == "natural":
                result = ImageEnhance.Contrast(result).enhance(1.0 + 0.08 * amount)
                result = result.filter(ImageFilter.UnsharpMask(radius=1.0 + amount, percent=int(70 + 80 * amount), threshold=3))
            else:
                raise HTTPException(status_code=422, detail="This local tool is not supported yet.")
        output = BytesIO()
        result.save(output, format="PNG", optimize=True)
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[IMAGE_EDIT] processing failed: {type(exc).__name__}: {exc}", flush=True)
        raise HTTPException(status_code=502, detail=f"Local image processing failed ({type(exc).__name__}).") from exc

    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    return {
        "success": True,
        "mediaType": "image",
        "mimeType": "image/png",
        "image": "data:image/png;base64," + encoded,
        "format": "data_url",
        "provider": "irhcf-local",
        "operation": effect,
        "verified": True,
        "background": {"rgb": list(background_color(payload.prompt))} if is_background else None,
    }
