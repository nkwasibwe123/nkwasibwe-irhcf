# IRHCF Local Image Service (first milestone)

This service replaces a photo's background with a solid color using open-source segmentation (rembg/U²-Net) and Pillow compositing. It does not call OpenAI or another paid image API.

## Endpoint
- `GET /health`
- `POST /edit/background` with JSON `{"imageDataUrl":"data:image/jpeg;base64,...","prompt":"replace the background with white"}`
- Send `X-IRHCF-Image-Token: <secret>` on edit requests.
- Supported solid colors: white, black, blue, green, red, gray, yellow (English and common Kinyarwanda color terms).

## Deploy
Deploy this directory as a separate Render **Docker** web service, using `image-service/Dockerfile` as the Dockerfile path. Set a long random `IRHCF_IMAGE_SERVICE_TOKEN` environment variable. After deployment, configure the backend to call this service with the same token.

## Limits and expectations
- The model runs on CPU and needs sufficient RAM and startup time; it may be slow on small instances.
- The service only changes a background to a solid color in this first milestone. It does not yet generate a new scene (beach, office, etc.) or implement general-purpose generative edits.
- The original subject pixels are composited from the cutout; segmentation can still have edge artifacts, especially around fine hair or transparent objects.
- No API credits are used, but hosting CPU/RAM and bandwidth are still infrastructure costs.
