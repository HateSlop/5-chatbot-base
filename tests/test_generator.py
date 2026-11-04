"""대화 모델에 장소, 마을 공통 태도와 해당 인물의 기억만 전달한다."""

import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from services.generator import StoryGenerator


class GeneratorTest(unittest.TestCase):
    def test_low_affinity_and_prior_chat_reach_model(self):
        answer = {"reply": "기억해요.", "attitude": "neutral", "visual_cue": "neutral"}
        history = [{"role": "user", "content": "나는 커피를 좋아해"}, {"role": "assistant", "content": "기억할게요."}]
        with patch("services.generator.OpenAI") as client:
            client.return_value.responses.create.return_value = SimpleNamespace(status="completed", output_text=json.dumps(answer))
            result = StoryGenerator().generate("내 취향 기억해?", "알렉스", {"name": "밥", "persona": {}}, [], history, "정육점", 25,
                                               [{"speaker_id": "bob", "text": "고기 좋아하쇼?"}], ("가게 방문", "밥은 가게 주인", "비밀"))
        self.assertEqual(result, answer)
        request = client.return_value.responses.create.call_args.kwargs
        self.assertIn("정육점", request["instructions"])
        self.assertIn("경계:", request["instructions"])
        self.assertIn("캐런은 정중하고 밝은 겉모습", request["instructions"])
        self.assertIn("고기 좋아하쇼?", request["instructions"])
        self.assertIn("다시 인사하지 말고", request["instructions"])
        self.assertIn("오래된 대화보다 우선", request["instructions"])
        self.assertIn("플레이어가 목격한 사실: 가게 방문", request["instructions"])
        self.assertIn("당신이 실제로 아는 사실: 밥은 가게 주인", request["instructions"])
        self.assertIn("지금 말하면 안 되는 사실: 비밀", request["instructions"])
        self.assertEqual(request["input"][0]["content"], "나는 커피를 좋아해")

    def test_village_stages_keep_persona_and_score_private(self):
        answer = {"reply": "어서 오세요.", "attitude": "neutral", "visual_cue": "smile"}
        with patch("services.generator.OpenAI") as client:
            client.return_value.responses.create.return_value = SimpleNamespace(status="completed", output_text=json.dumps(answer))
            for score, stage in ((20, "경계:"), (50, "평소:"), (70, "환대:")):
                with self.subTest(score=score):
                    StoryGenerator().generate("안녕하세요", "알렉스", {"name": "캐런", "persona": {"speaking_style": "정중하고 밝게"}}, [], [], "캐런의 집", score, [], ("방문", "주민대표", "미래 사건"))
                    instructions = client.return_value.responses.create.call_args.kwargs["instructions"]
                    self.assertIn(stage, instructions)
                    self.assertIn("정중하고 밝게", instructions)
                    self.assertNotIn(f"{score}점", instructions)

    def test_everyday_korean_examples_and_investigation_are_in_classification_rules(self):
        answer = {"reply": "반가워요.", "attitude": "friendly", "visual_cue": "smile"}
        with patch("services.generator.OpenAI") as client:
            client.return_value.responses.create.return_value = SimpleNamespace(status="completed", output_text=json.dumps(answer))
            StoryGenerator().generate("안녕하세요", "알렉스", {"name": "캐런", "persona": {}}, [], [], "캐런의 집", 50, [], ("방문", "주민대표", "미래 사건"))
        request = client.return_value.responses.create.call_args.kwargs
        for utterance in ("안녕하세요", "고맙습니다", "잘 지내셨어요?", "하시는 일은 어떠세요?", "마을 이야기를 들려주실 수 있나요?", "많이 놀라셨겠어요"):
            self.assertIn(utterance, request["instructions"])
        for question in ("지미는 어디 있죠?", "사진은 왜 여기 있나요?"):
            self.assertIn(question, request["instructions"])
        self.assertIn("근거 있는 추궁만으로 hostile이라 하지 마세요", request["instructions"])
        self.assertEqual(request["text"]["format"]["schema"]["properties"]["attitude"]["enum"],
                         ["friendly", "cooperative", "neutral", "hostile"])


if __name__ == "__main__":
    unittest.main()
