"""대화 모델에 장소, 마을 공통 태도와 해당 인물의 기억만 전달한다."""

import json
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from services.generator import StoryGenerator
from services.story import SCENE_CONTEXT


class GeneratorTest(unittest.TestCase):
    def test_karen_keeps_composed_persona_and_never_outputs_her_old_laugh(self):
        config = json.loads((Path(__file__).resolve().parents[1] / "config" / "chatbot_config.json").read_text(encoding="utf-8"))
        karen = config["characters"]["karen"]
        with patch("services.generator.OpenAI") as client:
            client.return_value.responses.create.return_value = SimpleNamespace(status="completed", output_text=json.dumps({"reply":"마음을 내주셔서 고마워요. 후후.","visual_cue":"smile"}))
            turn = StoryGenerator().generate("일을 도울게요", "확인", karen, [], [], "새집", 65, [], ("일자리 권유", "마을의 일", "이후 사건"))
        self.assertNotIn("후후", turn["reply"])
        self.assertEqual(turn["reply"], "마음을 내주셔서 고마워요.")
        self.assertIn("짧고 단호", client.return_value.responses.create.call_args.kwargs["instructions"])

    def test_short_question_follows_latest_scene_after_older_chat(self):
        answer = {"reply": "그래요.", "visual_cue": "neutral"}
        history = [{"role": "user", "content": "이웃은 누구예요?"}, {"role": "assistant", "content": "세 사람이 있어."}]
        cases = (
            ("jimmy", "캐시가 바빠 보이더라. 미용실로 가볼래?", "캐시가 바빠 보인다"),
            ("jimmy", "고기 좀 사러 정육점에 다녀올게.", "고기를 사러 간다"),
            ("karen", "지미에게 전할 말이 있는데, 어디로 갔는지 아세요?", "지미에게 전할 말이 있다"),
        )
        with patch("services.generator.OpenAI") as client:
            client.return_value.responses.create.return_value = SimpleNamespace(status="completed", output_text=json.dumps(answer))
            for character, line, observation in cases:
                with self.subTest(line=line):
                    StoryGenerator().generate("왜?", "알렉스", {"name": character, "persona": {}}, [], history,
                                              "새집", 50, [{"speaker_id": character, "text": line}],
                                              (observation, "현재 아는 사실", "미래 비밀 비공개"))
                    messages = client.return_value.responses.create.call_args.kwargs["input"]
                    self.assertEqual(messages[:2], history)
                    self.assertEqual(messages[-2]["role"], "developer")
                    self.assertIn(line, messages[-2]["content"])
                    self.assertIn(observation, messages[-2]["content"])
                    self.assertEqual(messages[-1]["content"], "알렉스: 왜?")

    def test_cathy_keeps_hair_services_user_initiated(self):
        config = json.loads((Path(__file__).resolve().parents[1] / "config" / "chatbot_config.json").read_text(encoding="utf-8"))
        world = config["characters"]["cathy"]["persona"]["world"]
        self.assertIn("플레이어가 먼저 요청하지 않으면", world)
        self.assertIn("직접 머리 손질을 물으면", world)

    def test_low_affinity_and_prior_chat_reach_model(self):
        answer = {"reply": "기억해요.", "visual_cue": "neutral"}
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
        self.assertEqual(request["input"][-2], {"role": "developer", "content": "현재 장면에서 방금 들은 말: 고기 좋아하쇼?\n현재 목격한 상황: 가게 방문"})
        self.assertEqual(request["input"][-1], {"role": "user", "content": "알렉스: 내 취향 기억해?"})

    def test_village_stages_keep_persona_and_score_private(self):
        answer = {"reply": "어서 오세요.", "visual_cue": "smile"}
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
        answer = {"category": "friendly"}
        with patch("services.generator.OpenAI") as client:
            client.return_value.responses.create.return_value = SimpleNamespace(status="completed", output_text=json.dumps(answer))
            self.assertEqual(StoryGenerator().classify("안녕하세요", [], []), "friendly")
        request = client.return_value.responses.create.call_args.kwargs
        for utterance in ("안녕하세요", "고맙습니다", "잘 지내셨어요?", "하시는 일은 어떠세요?", "마을 이야기를 들려주실 수 있나요?", "많이 놀라셨겠어요"):
            self.assertIn(utterance, request["instructions"])
        for question in ("지미는 어디 있죠?", "사진은 왜 여기 있나요?"):
            self.assertIn(question, request["instructions"])
        self.assertIn("근거 있는 추궁만으로 hostile이라 하지 마세요", request["instructions"])
        self.assertEqual(request["text"]["format"]["schema"]["properties"]["category"]["enum"],
                         ["friendly", "cooperative", "neutral", "hostile"])

    def test_destination_classification_requires_boolean_and_same_call(self):
        with patch("services.generator.OpenAI") as client:
            create = client.return_value.responses.create
            create.return_value = SimpleNamespace(status="completed", output_text='{"category":"neutral","destination_disclosed":false}')
            self.assertEqual(StoryGenerator().classify("지미가 정육점에 갔다고요?", [], [], True), ("neutral", False))
            self.assertIn("부정문, 질문, 추측", create.call_args.kwargs["instructions"])
            self.assertEqual(create.call_args.kwargs["text"]["format"]["schema"]["required"], ["category", "destination_disclosed"])
            self.assertEqual(create.call_count, 1)
            create.return_value = SimpleNamespace(status="completed", output_text='{"category":"neutral","destination_disclosed":"true"}')
            with self.assertRaises(RuntimeError):
                StoryGenerator().classify("지미가 정육점에 갔다고 했어요", [], [], True)

    def test_dinner_prompt_has_no_unrevealed_secret(self):
        with patch("services.generator.OpenAI") as client:
            client.return_value.responses.create.return_value = SimpleNamespace(status="completed", output_text='{"reply":"내일 보자.","visual_cue":"worried"}')
            StoryGenerator().generate("왜 무서워?", "확인", {"name":"지미", "persona":{}}, [], [], "새집", 50, [], SCENE_CONTEXT["dinner_invite"])
        instructions = client.return_value.responses.create.call_args.kwargs["instructions"]
        self.assertIn("두려워", instructions)
        self.assertNotIn("식인", instructions)
        self.assertNotIn("사이비", instructions)


if __name__ == "__main__":
    unittest.main()
