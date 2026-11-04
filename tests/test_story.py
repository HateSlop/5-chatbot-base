"""장면, 점수와 세 결말의 결정적인 규칙을 확인한다."""

import os
import unittest
from unittest.mock import patch

from cryptography.fernet import Fernet

os.environ["STORY_STATE_KEY"] = Fernet.generate_key().decode("ascii")

from app import app, chatbot  # noqa: E402
from services.retriever import StoryRetriever  # noqa: E402
from services.state_token import decode_state, encode_state  # noqa: E402
from services.story import CHAT_DELTAS, START_SCORE, adjusted_affinity, available_actions, available_characters  # noqa: E402


TO_CHECKPOINT = [
    "visit_neighbors", "visit_karen", "visit_bob", "visit_cathy", "return_home",
    "go_help_cathy", "help_cathy", "see_jimmy_off", "go_butcher", "approach_jimmy",
    "inspect_basement", "go_upstairs", "return_home", "accept_dinner_invite",
    "go_karen_dinner", "inspect_room", "return_home",
]


class StoryTest(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        response = self.client.post("/api/session", json={"player_name": "알렉스"})
        self.assertEqual(response.status_code, 201)
        self.token = response.get_json()["state_token"]

    def action(self, action_id):
        response = self.client.post("/api/action", json={"state_token": self.token, "action_id": action_id})
        self.assertEqual(response.status_code, 200, (action_id, response.get_json()))
        data = response.get_json()
        self.token = data["state_token"]
        self.assertLessEqual(len(data["view"]["available_characters"]), 1, action_id)
        return data

    def checkpoint(self):
        for action_id in TO_CHECKPOINT:
            self.action(action_id)
        self.assertEqual(decode_state(self.token)["scene_id"], "checkpoint")

    def chat(self, character, message, attitude="cooperative"):
        turn = {"reply": "알겠습니다.", "visual_cue": "neutral"}
        with patch.object(chatbot.generator, "classify", return_value=attitude), patch.object(chatbot.generator, "generate", return_value=turn):
            response = self.client.post("/api/chat", json={"state_token": self.token, "character_id": character, "message": message})
        self.assertEqual(response.status_code, 200)
        self.token = response.get_json()["state_token"]
        return response.get_json()

    def festival(self, checkpoint_action):
        self.action(checkpoint_action)
        self.action("go_festival")
        self.action("inspect_food")
        self.assertEqual(decode_state(self.token)["scene_id"], "hair_found")

    def test_low_affinity_continues_to_festival_and_escape_fails_without_key(self):
        self.checkpoint()
        state = decode_state(self.token)
        self.assertEqual(state["affinity"], 45)
        self.assertIsNone(state["ending"])
        self.assertFalse(state["has_car_key"])
        self.festival("continue_festival")
        result = self.action("escape")
        self.assertEqual(result["view"]["ending"], "death")
        self.assertEqual(result["view"]["available_actions"], [])

    def test_cooperative_chat_unlocks_job_and_key_then_escape(self):
        self.chat("jimmy", "마을을 안내해 줘. 나도 도울게")
        for action_id in TO_CHECKPOINT:
            self.action(action_id)
            state = decode_state(self.token)
            characters = available_characters(state)
            if characters and state["scene_id"] != "checkpoint":
                self.chat(characters[0], f"{characters[0]}의 {state['scene_id']}에서 제가 도울게요")
        self.assertEqual(decode_state(self.token)["affinity"], 88)
        self.assertTrue(decode_state(self.token)["job_offered"])
        self.festival("accept_job")
        self.assertTrue(decode_state(self.token)["has_car_key"])
        self.assertEqual(self.action("escape")["view"]["ending"], "escape")

    def test_everyday_conversation_can_reach_job_offer(self):
        self.chat("jimmy", "지미, 안녕하세요", "friendly")
        for action_id in TO_CHECKPOINT:
            self.action(action_id)
            state = decode_state(self.token)
            characters = available_characters(state)
            if characters and state["scene_id"] != "checkpoint":
                self.chat(characters[0], f"{characters[0]}의 {state['scene_id']}에서 만나 반가워요", "friendly")
        state = decode_state(self.token)
        self.assertEqual(state["affinity"], 82)
        self.assertTrue(state["job_offered"])
        self.assertIn("accept_job", [item["id"] for item in available_actions(state)])

    def test_continued_hostility_path_has_no_job_offer(self):
        self.chat("jimmy", "적대 arrival", "hostile")
        for action_id in TO_CHECKPOINT:
            self.action(action_id)
            state = decode_state(self.token)
            characters = available_characters(state)
            if characters and state["scene_id"] != "checkpoint":
                self.chat(characters[0], f"적대 {state['scene_id']} {characters[0]}", "hostile")
        state = decode_state(self.token)
        self.assertEqual(state["affinity"], 0)
        self.assertFalse(state["job_offered"])
        self.assertEqual(state["hostile_streak"], 10)

    def test_staying_assimilates_even_when_watched(self):
        self.checkpoint()
        self.festival("continue_festival")
        self.assertEqual(self.action("stay")["view"]["ending"], "assimilation")

    def test_action_cannot_repeat_and_secret_is_gated(self):
        self.action("visit_neighbors")
        response = self.client.post("/api/action", json={"state_token": self.token, "action_id": "visit_neighbors"})
        self.assertEqual(response.status_code, 409)
        retriever = StoryRetriever()
        self.assertFalse(any("머리카락" in hit.content or "음식의 재료" in hit.content
                             for hit in retriever.search("지미의 머리카락과 고기", "jimmy", "arrival", [])))
        self.assertFalse(any(hit.title == "축제 음식의 정체" for hit in retriever.search("지미 머리카락", "bob", "festival", [])))
        self.assertTrue(any(hit.title == "축제 음식의 정체" for hit in retriever.search("지미 머리카락", "bob", "hair_found", ["jimmy_hair"])))

    def test_place_has_one_character_and_affinity_is_shared_with_bob(self):
        start = self.client.post("/api/session", json={"player_name": "검증"}).get_json()["view"]
        self.assertEqual((start["location_name"], start["affinity"]), ("새집", 50))
        self.assertEqual(start["available_characters"][0]["id"], "jimmy")
        self.assertEqual(self.action("visit_neighbors")["view"]["available_characters"], [])
        self.assertEqual(self.action("visit_karen")["view"]["available_characters"][0]["id"], "karen")
        with patch.object(chatbot.generator, "classify", return_value="hostile"), patch.object(chatbot.generator, "generate", return_value={"reply": "그 얘기는 불편하군요.", "visual_cue": "worried"}):
            response = self.client.post("/api/chat", json={"state_token": self.token, "character_id": "karen", "message": "당신을 가만두지 않겠어요"})
        self.assertEqual(response.status_code, 200)
        self.token = response.get_json()["state_token"]
        self.assertEqual(response.get_json()["view"]["affinity"], 48)
        bob = self.action("visit_bob")
        self.assertEqual(bob["view"]["location_name"], "정육점")
        self.assertEqual([person["id"] for person in bob["view"]["available_characters"]], ["bob"])
        self.assertIn("필요한 게", bob["events"][0]["text"])
        with patch.object(chatbot.generator, "classify", return_value="neutral"), patch.object(chatbot.generator, "generate", return_value={"reply": "어서 오시오.", "visual_cue": "neutral"}) as generate:
            response = self.client.post("/api/chat", json={"state_token": self.token, "character_id": "bob", "message": "가게는 언제 열어요?"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(generate.call_args.args[6], 48)

    def test_same_reply_uses_new_attitude_at_both_boundaries(self):
        state = decode_state(self.token)
        state["affinity"] = 69
        self.token = encode_state(state)
        with patch.object(chatbot.generator, "classify", return_value="friendly"), patch.object(chatbot.generator, "generate", return_value={"reply": "반가워!", "visual_cue": "smile"}) as generate:
            result = self.client.post("/api/chat", json={"state_token": self.token, "character_id": "jimmy", "message": "안녕하세요"}).get_json()
        self.assertEqual(result["view"]["affinity"], 72)
        self.assertEqual(generate.call_args.args[6], 72)
        self.token = result["state_token"]

        self.action("visit_neighbors")
        self.action("visit_karen")
        state = decode_state(self.token)
        state["affinity"] = 35
        self.token = encode_state(state)
        with patch.object(chatbot.generator, "classify", return_value="hostile"), patch.object(chatbot.generator, "generate", return_value={"reply": "어서 오세요.", "visual_cue": "smile"}) as generate, patch.object(chatbot.image_selector, "select", return_value="/assets/images/karen_smile.svg") as select:
            result = self.client.post("/api/chat", json={"state_token": self.token, "character_id": "karen", "message": "협박하겠어요"}).get_json()
        self.assertEqual(result["view"]["affinity"], 33)
        self.assertEqual(generate.call_args.args[6], 33)
        self.assertEqual(select.call_args.args, ("어서 오세요.", "karen", "neighbors", "smile"))
        self.assertEqual(result["events"][0]["image"], "/assets/images/karen_smile.svg")

    def test_revisiting_neighbor_does_not_repeat_fixed_greeting(self):
        self.action("visit_neighbors")
        self.assertTrue(self.action("visit_karen")["events"])
        self.action("visit_bob")
        revisit = self.action("visit_karen")
        self.assertEqual(revisit["events"], [])
        self.assertEqual(decode_state(self.token)["scene_events"], [])

    def test_each_character_remembers_only_own_conversation(self):
        self.action("visit_neighbors")
        self.action("visit_karen")
        turn = {"reply": "기억하고 있어요.", "visual_cue": "neutral"}
        with patch.object(chatbot.generator, "classify", return_value="neutral"), patch.object(chatbot.generator, "generate", return_value=turn) as generate:
            for character, message in (("karen", "제 이름은 알렉스예요"), ("bob", "고기가 있나요?"), ("karen", "제 이름을 기억하나요?")):
                if character == "bob":
                    self.action("visit_bob")
                elif message.startswith("제 이름을"):
                    self.action("visit_karen")
                response = self.client.post("/api/chat", json={"state_token": self.token, "character_id": character, "message": message})
                self.assertEqual(response.status_code, 200)
                self.token = response.get_json()["state_token"]
        self.assertEqual(generate.call_args_list[1].args[4], [])
        self.assertEqual(generate.call_args_list[2].args[4][0]["content"], "제 이름은 알렉스예요")
        self.assertEqual(decode_state(self.token)["history"]["bob"][0]["content"], "고기가 있나요?")

    def test_jimmy_leaves_before_karen_arrives(self):
        for action_id in TO_CHECKPOINT[:6]:
            self.action(action_id)
        self.assertEqual(decode_state(self.token)["location_id"], "salon")
        jimmy = self.action("help_cathy")
        self.assertEqual(jimmy["view"]["location_id"], "player_house")
        self.assertEqual([person["id"] for person in jimmy["view"]["available_characters"]], ["jimmy"])
        self.assertEqual([item["id"] for item in jimmy["view"]["available_actions"]], ["see_jimmy_off"])
        self.assertEqual([item["speaker_id"] for item in jimmy["events"]], ["thought", "jimmy"])
        self.assertIn("정육점", jimmy["events"][1]["text"])
        self.assertEqual([item["speaker_id"] for item in decode_state(self.token)["scene_events"]], ["jimmy"])
        self.chat("jimmy", "정육점에는 왜 가요?", "neutral")
        karen = self.action("see_jimmy_off")
        self.assertEqual([person["id"] for person in karen["view"]["available_characters"]], ["karen"])
        self.assertEqual([item["id"] for item in karen["view"]["available_actions"]], ["go_butcher"])
        self.assertEqual([item["speaker_id"] for item in karen["events"]], ["thought", "karen"])
        self.assertIn("지미가 떠난 뒤", karen["events"][0]["text"])
        self.assertEqual([item["speaker_id"] for item in decode_state(self.token)["scene_events"]], ["karen"])

    def test_dinner_pickup_promise_and_festival_inference(self):
        for action_id in TO_CHECKPOINT[:12]:
            self.action(action_id)
        notebook = decode_state(self.token)
        self.assertIn("notebook", notebook["clues"])
        self.assertNotIn("jimmy_hair", notebook["clues"])
        self.assertFalse(any("식인" in entry or "음식의 정체" in entry for entry in notebook["journal"]))
        invitation = self.action("return_home")
        self.assertEqual(invitation["view"]["scene_id"], "dinner_invite")
        self.assertEqual([person["id"] for person in invitation["view"]["available_characters"]], ["jimmy"])
        self.assertIn("캐런이 내일 저녁 식사에 초대", invitation["events"][0]["text"])
        self.assertIn("네 집으로 데리러 올게", invitation["events"][0]["text"])
        self.assertIn("데리러", invitation["view"]["available_actions"][0]["label"])
        self.assertNotRegex(invitation["events"][0]["text"], r"\d+시")
        wait = self.action("accept_dinner_invite")
        self.assertIn("데리러 오지 않았다", wait["events"][0]["text"])
        self.assertIn("혼자", wait["view"]["available_actions"][0]["label"])
        alone = self.action("go_karen_dinner")
        self.assertEqual(alone["view"]["location_id"], "karen_house")
        self.assertEqual([person["id"] for person in alone["view"]["available_characters"]], ["karen"])
        for action_id in ("inspect_room", "return_home", "continue_festival", "go_festival"):
            self.action(action_id)
        food = self.action("inspect_food")
        thoughts = " ".join(item["text"] for item in food["events"])
        for detail in ("금발 머리카락", "밥은 대머리", "지미는 사라졌고", "수첩", "음식의 정체"):
            self.assertIn(detail, thoughts)
        self.assertEqual([item["id"] for item in food["view"]["available_actions"]], ["escape", "stay"])

    def test_fixed_scene_line_reaches_ai_without_private_thoughts(self):
        for action_id in TO_CHECKPOINT[:-1]:
            self.action(action_id)
        state = decode_state(self.token)
        self.assertEqual(state["scene_id"], "photo_found")
        self.assertEqual([item["speaker_id"] for item in state["scene_events"]], ["karen"])
        self.assertIn("제 방에서", state["scene_events"][0]["text"])
        with patch.object(chatbot.generator, "classify", return_value="neutral"), patch.object(chatbot.generator, "generate", return_value={"reply": "놀랐을 뿐이에요.", "visual_cue": "worried"}) as generate:
            response = self.client.post("/api/chat", json={"state_token": self.token, "character_id": "karen", "message": "왜 놀라셨어요?"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(generate.call_args.args[-2], state["scene_events"])
        self.assertIn("지미의 사진", generate.call_args.args[-1][0])
        self.assertEqual(decode_state(response.get_json()["state_token"])["scene_events"], state["scene_events"])

    def test_current_incident_context_reaches_each_character_without_forcing_chat(self):
        steps = [
            ("visit_neighbors", None, None),
            ("visit_karen", None, None), ("visit_bob", None, None), ("visit_cathy", None, None),
            ("return_home", "jimmy", "캐시가"),
            ("go_help_cathy", "cathy", "구체적인 업무는 아직 정해지지 않았다"),
            ("help_cathy", "jimmy", "잠깐 정육점에 다녀오겠다고"),
            ("see_jimmy_off", "karen", "정육점에 가겠다며 떠난 뒤"),
            ("go_butcher", "jimmy", "지미는 정육점 지하실에서"),
            ("approach_jimmy", None, None), ("inspect_basement", None, None),
            ("go_upstairs", "bob", "이름과 축제 준비 날짜"),
            ("return_home", "jimmy", "데리러 오겠다고 약속했다"),
            ("accept_dinner_invite", None, None), ("go_karen_dinner", "karen", "혼자 캐런의 집에 왔다"),
            ("inspect_room", "karen", "지미의 사진"),
            ("return_home", None, None), ("continue_festival", "bob", "다음 주 축제"),
        ]
        for action_id, character, expected in steps:
            result = self.action(action_id)
            if character:
                self.assertTrue(result["view"]["available_actions"], action_id)
                with patch.object(chatbot.generator, "classify", return_value="neutral"), patch.object(chatbot.generator, "generate", return_value={"reply": "글쎄요.", "visual_cue": "neutral"}) as generate:
                    response = self.client.post("/api/chat", json={"state_token": self.token, "character_id": character, "message": "무슨 일이에요?"})
                    self.assertEqual(response.status_code, 200)
                    self.token = response.get_json()["state_token"]
                context = generate.call_args.args[-1]
                self.assertIn(expected, " ".join(context), action_id)
                if character != "jimmy" or action_id == "help_cathy":
                    self.assertNotIn("식인", " ".join(context), action_id)
                self.assertEqual(result["view"]["available_actions"],
                                 self.client.post("/api/session/resume", json={"state_token": self.token}).get_json()["view"]["available_actions"])
                if action_id == "go_butcher":
                    self.assertIn("식인", context[1])
                    self.assertNotIn("식인", context[0])
                if action_id == "return_home" and character == "jimmy" and "데리러" in expected:
                    self.assertIn("이름과 날짜만", context[0])

    def test_job_offer_is_fixed_when_later_chat_lowers_affinity(self):
        state = decode_state(self.token)
        state["affinity"] = 75
        self.token = encode_state(state)
        self.checkpoint()
        self.assertEqual(decode_state(self.token)["affinity"], 70)
        for index in range(3):
            response = self.chat("karen", f"당신을 가만두지 않겠어요 {index}", "hostile")
        self.assertEqual(response["view"]["affinity"], 58)
        self.assertIn("accept_job", [action["id"] for action in response["view"]["available_actions"]])
        self.assertTrue(decode_state(self.action("accept_job")["state_token"])["has_car_key"])

    def test_adjustment_center_edges_rounding_and_bounds(self):
        self.assertEqual(START_SCORE, 50)
        self.assertEqual(CHAT_DELTAS, {"friendly": 5, "cooperative": 7, "neutral": 0, "hostile": -2})
        for score, friendly, cooperative in ((50, 5, 7), (70, 3, 4), (90, 1, 1), (0, 5, 7)):
            self.assertEqual(adjusted_affinity(score, 5) - score, friendly)
            self.assertEqual(adjusted_affinity(score, 7) - score, cooperative)
        self.assertEqual(adjusted_affinity(0, -2), 0)
        self.assertEqual(adjusted_affinity(100, 5), 100)
        self.assertEqual(adjusted_affinity(100, -6), 94)
        self.assertEqual(adjusted_affinity(99, 7), 99)  # Rounded zero stays zero.

    def test_neutral_duplicate_and_positive_tiers(self):
        self.assertEqual(self.chat("jimmy", "네", "neutral")["view"]["affinity"], 50)
        self.assertEqual(self.chat("jimmy", "네", "friendly")["view"]["affinity"], 50)
        self.assertEqual(self.chat("jimmy", "안녕하세요", "friendly")["view"]["affinity"], 55)
        self.assertEqual(self.chat("jimmy", "안녕하세요", "friendly")["view"]["affinity"], 55)
        self.assertEqual(self.chat("jimmy", "도울게")["view"]["affinity"], 57)
        self.assertEqual(self.chat("jimmy", "다른 일도 도울게")["view"]["affinity"], 57)
        self.action("visit_neighbors")
        self.action("visit_karen")
        self.assertEqual(self.chat("karen", "  안녕하세요  ", "friendly")["view"]["affinity"], 57)
        state = decode_state(self.token)
        state["scored_chat"] = [f"earlier:{n}" for n in range(12)] + state["scored_chat"]
        self.token = encode_state(state)
        self.assertEqual(self.chat("karen", "다른 일을 돕겠습니다")["view"]["affinity"], 63)

    def test_hostile_streak_recovery_duplicates_and_scene_cap(self):
        self.assertEqual(self.chat("jimmy", "꺼져 1", "hostile")["view"]["affinity"], 48)
        self.assertEqual(self.chat("jimmy", "꺼져 2", "hostile")["view"]["affinity"], 44)
        self.assertEqual(self.chat("jimmy", "꺼져 2", "hostile")["view"]["affinity"], 44)
        self.assertEqual(decode_state(self.token)["hostile_streak"], 2)
        self.assertEqual(self.chat("jimmy", "고마워요", "friendly")["view"]["affinity"], 49)
        self.assertEqual(decode_state(self.token)["hostile_streak"], 1)
        self.assertEqual(self.chat("jimmy", "꺼져 3", "hostile")["view"]["affinity"], 45)
        self.assertEqual(self.chat("jimmy", "꺼져 4", "hostile")["view"]["affinity"], 45)
        self.assertEqual(decode_state(self.token)["hostile_streak"], 2)
        self.assertEqual(self.chat("jimmy", "네", "neutral")["view"]["affinity"], 45)
        self.assertEqual(decode_state(self.token)["hostile_streak"], 2)
        self.assertEqual(self.chat("jimmy", "도와드릴게요", "cooperative")["view"]["affinity"], 47)
        self.assertEqual(decode_state(self.token)["hostile_streak"], 1)

    def test_zero_score_hostility_does_not_advance_streak(self):
        state = decode_state(self.token)
        state["affinity"] = 0
        self.token = encode_state(state)
        self.assertEqual(self.chat("jimmy", "꺼져", "hostile")["view"]["affinity"], 0)
        self.assertEqual(decode_state(self.token)["hostile_streak"], 0)
        self.assertEqual(self.chat("jimmy", "고마워요", "friendly")["view"]["affinity"], 5)
        self.assertEqual(self.chat("jimmy", "나가", "hostile")["view"]["affinity"], 3)
        self.assertEqual(decode_state(self.token)["hostile_streak"], 1)

    def test_fixed_actions_do_not_change_hostile_streak(self):
        self.chat("jimmy", "꺼져", "hostile")
        state = decode_state(self.token)
        self.assertEqual(state["hostile_streak"], 1)
        for action_id in TO_CHECKPOINT[:7]:
            self.action(action_id)
        self.assertEqual(decode_state(self.token)["hostile_streak"], 1)

    def test_legacy_token_keeps_duplicate_record(self):
        self.chat("jimmy", "꺼져", "hostile")
        state = decode_state(self.token)
        state.pop("hostile_streak")
        state.pop("positive_scores")
        state["scored_chat"] = ["arrival:jimmy:suspicious"]
        state["scored_messages"] = ["꺼져"]
        self.token = encode_state(state)
        self.assertEqual(self.chat("jimmy", "꺼져", "hostile")["view"]["affinity"], 48)
        self.assertEqual(decode_state(self.token).get("hostile_streak", 0), 0)


if __name__ == "__main__":
    unittest.main()
