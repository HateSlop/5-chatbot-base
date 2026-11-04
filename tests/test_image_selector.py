import unittest

from services.image_selector import StoryImageSelector


class ImageSelectorTests(unittest.TestCase):
    def test_delivered_character_expressions_exist(self):
        selector = StoryImageSelector()
        for character in ("bob", "cathy"):
            for cue, expression in (("neutral", "basic"), ("smile", "smile"), ("worried", "angry")):
                with self.subTest(character=character, cue=cue):
                    self.assertEqual(selector.select("대사", character, "neighbors", cue),
                                     f"/assets/images/{character}_{expression}.png")

    def test_karen_photo_discovery_uses_angry_but_keeps_explicit_smile(self):
        selector = StoryImageSelector()
        self.assertEqual(selector.select("여기서 뭐 하세요?", "karen", "photo_found", "worried"),
                         "/assets/images/karen_angry.png")
        self.assertEqual(selector.select("안녕하세요", "karen", "neighbors", "neutral"),
                         "/assets/images/karen_basic.png")
        self.assertEqual(selector.select("괜찮아요", "karen", "photo_found", "smile"),
                         "/assets/images/karen_smile.png")
