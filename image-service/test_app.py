import unittest
from fastapi import HTTPException
from app import background_color


class BackgroundColorTests(unittest.TestCase):
    def test_supported_colors(self):
        cases = {
            "replace background with white": (255, 255, 255),
            "background y'umukara": (0, 0, 0),
            "hindura background ibe ubururu": (40, 110, 220),
            "background icyatsi": (30, 150, 75),
            "background ibe umutuku": (210, 35, 45),
            "background gray": (128, 128, 128),
            "background umuhondo": (255, 220, 30),
        }
        for prompt, expected in cases.items():
            with self.subTest(prompt=prompt):
                self.assertEqual(background_color(prompt), expected)

    def test_rejects_non_background_edit(self):
        with self.assertRaises(HTTPException) as caught:
            background_color("make the person smile")
        self.assertEqual(caught.exception.status_code, 422)

    def test_rejects_unknown_background_color(self):
        with self.assertRaises(HTTPException) as caught:
            background_color("replace background with a beach scene")
        self.assertEqual(caught.exception.status_code, 422)


if __name__ == "__main__":
    unittest.main()
