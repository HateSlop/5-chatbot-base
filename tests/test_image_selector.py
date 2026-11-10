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

    def test_karen_photo_discovery_uses_angry(self):
        selector = StoryImageSelector()
        self.assertEqual(selector.select("여기서 뭐 하세요?", "karen", "photo_found", "worried"),
                         "/assets/images/karen_angry.png")
        self.assertEqual(selector.select("안녕하세요", "karen", "neighbors", "neutral"),
                         "/assets/images/karen_basic.png")
        self.assertEqual(selector.select("괜찮아요", "karen", "photo_found", "smile"),
                         "/assets/images/karen_angry.png")

    def test_jimmy_stays_scared_after_butcher_discovery(self):
        selector = StoryImageSelector()
        for scene in ("butcher_search", "empty_butcher"):
            for cue in (None, "neutral", "smile", "worried"):
                self.assertEqual(selector.select("대사", "jimmy", scene, cue),
                                 "/assets/images/jimmy_scared.png")

    def test_jimmy_dinner_invitation_uses_anxious_image(self):
        selector = StoryImageSelector()
        for cue in (None, "neutral", "smile", "worried", "angry"):
            self.assertEqual(selector.select("캐런의 저녁 초대", "jimmy", "dinner_invite", cue),
                             "/assets/images/jimmy_anxiety.png")
