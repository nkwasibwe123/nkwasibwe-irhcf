""""Regression tests for rembg result compatibility."""
import base64
import sys
import types
import unittest
from io import BytesIO
from unittest.mock import patch

from PIL import Image
from fastapi import HTTPException

import app as image_app


def png_data_url():
    buffer = BytesIO()
    Image.new("RGB", (16, 16), (200, 40, 30)).save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


class RembgReturnTypeTests(unittest.TestCase):
    def setUp(self):
        self.original_token = image_app.SERVICE_TOKEN
        self.original_session = image_app._session
        image_app.SERVICE_TOKEN = "test-token"
        image_app._session = object()

    def tearDown(self):
        image_app.SERVICE_TOKEN = self.original_token
        image_app._session = self.original_session

    def _run_edit(self, rembg_result):
        fake_rembg = types.ModuleType("rembg")
        fake_rembg.remove = lambda *args, **kwargs: rembg_result
        with patch.dict(sys.modules, {"rembg": fake_rembg}):
            payload = image_app.EditRequest(
                imageDataUrl=png_data_url(),
                prompt="replace background with white",
                mode="prompt",
                effect="background-white",
                strength=50,
            )
            return image_app.edit_image(payload, x_irhcf_image_token="test-token")

    def test_accepts_pil_image_return(self):
        cutout = Image.new("RGBA", (16, 16), (10, 120, 40, 255))
        response = self._run_edit(cutout)
        self.assertTrue(response["success"])
        self.assertEqual(response["operation"], "background-white")
        self.assertTrue(response["image"].startswith("data:image/png;base64,"))

    def test_accepts_bytes_return(self):
        buffer = BytesIO()
        Image.new("RGBA", (16, 16), (10, 120, 40, 255)).save(buffer, format="PNG")
        response = self._run_edit(buffer.getvalue())
        self.assertTrue(response["success"])
        self.assertEqual(response["operation"], "background-white")
        self.assertTrue(response["image"].startswith("data:image/png;base64,"))


    def test_background_replacement_output_has_white_background_and_preserves_subject_pixels(self):
        cutout = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        for x in range(5, 11):
            for y in range(5, 11):
                cutout.putpixel((x, y), (10, 120, 40, 255))
        response = self._run_edit(cutout)
        encoded = response["image"].split(",", 1)[1]
        result = Image.open(BytesIO(base64.b64decode(encoded))).convert("RGB")
        self.assertEqual(result.getpixel((0, 0)), (255, 255, 255))
        self.assertEqual(result.getpixel((8, 8)), (10, 120, 40))

    def test_strength_zero_returns_original_without_running_background_model(self):
        payload = image_app.EditRequest(
            imageDataUrl=png_data_url(),
            prompt="replace background with white",
            mode="prompt",
            effect="background-white",
            strength=0,
        )
        fake_rembg = types.ModuleType("rembg")
        def unexpected_remove(*args, **kwargs):
            raise AssertionError("strength=0 must not run rembg inference")
        fake_rembg.remove = unexpected_remove
        with patch.dict(sys.modules, {"rembg": fake_rembg}):
            response = image_app.edit_image(payload, x_irhcf_image_token="test-token")
        result = Image.open(BytesIO(base64.b64decode(response["image"].split(",", 1)[1]))).convert("RGB")
        self.assertEqual(result.getpixel((0, 0)), (200, 40, 30))

    def test_rejects_missing_or_invalid_service_token_before_processing(self):
        payload = image_app.EditRequest(
            imageDataUrl=png_data_url(),
            prompt="replace background with white",
            mode="prompt",
            effect="background-white",
            strength=50,
        )
        with self.assertRaises(HTTPException) as missing:
            image_app.edit_image(payload, x_irhcf_image_token=None)
        self.assertEqual(missing.exception.status_code, 401)
        with self.assertRaises(HTTPException) as invalid:
            image_app.edit_image(payload, x_irhcf_image_token="wrong-token")
        self.assertEqual(invalid.exception.status_code, 401)

    def test_fails_closed_when_service_token_is_not_configured(self):
        payload = image_app.EditRequest(
            imageDataUrl=png_data_url(),
            prompt="replace background with white",
            mode="prompt",
            effect="background-white",
            strength=50,
        )
        image_app.SERVICE_TOKEN = ""
        with self.assertRaises(HTTPException) as caught:
            image_app.edit_image(payload, x_irhcf_image_token="test-token")
        self.assertEqual(caught.exception.status_code, 503)

    def test_health_reports_engine_and_token_readiness(self):
        with patch("app.importlib.util.find_spec", return_value=object()):
            status = image_app.health()
        self.assertTrue(status["success"])
        self.assertEqual(status["service"], "irhcf-local-image")
        self.assertTrue(status["ready"])
        self.assertTrue(status["inferenceAvailable"])
        self.assertTrue(status["modelConfigured"])
        self.assertTrue(status["tokenConfigured"])
        self.assertTrue(status["modelLoaded"])

        with patch("app.importlib.util.find_spec", return_value=None):
            status = image_app.health()
        self.assertFalse(status["ready"])
        self.assertFalse(status["inferenceAvailable"])

    def test_rejects_unsupported_image_type_before_model_inference(self):
        payload = image_app.EditRequest(
            imageDataUrl="data:image/gif;base64," + base64.b64encode(b"not-an-image").decode("ascii"),
            prompt="replace background with white",
            mode="prompt",
            effect="background-white",
            strength=50,
        )
        with self.assertRaises(HTTPException) as caught:
            image_app.edit_image(payload, x_irhcf_image_token="test-token")
        self.assertEqual(caught.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
