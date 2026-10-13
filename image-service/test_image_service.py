""""Regression tests for rembg result compatibility."""
import base64
import sys
import types
import unittest
from io import BytesIO
from unittest.mock import patch

from PIL import Image

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


if __name__ == "__main__":
    unittest.main()
