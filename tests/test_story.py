"""장면, 점수와 세 결말의 결정적인 규칙을 확인한다."""

import os
import unittest
from unittest.mock import patch

from cryptography.fernet import Fernet

os.environ["STORY_STATE_KEY"] = Fernet.generate_key().decode("ascii")

from app import app, chatbot  # noqa: E402
from services.retriever import StoryRetriever  # noqa: E402
from services.state_token import decode_state, encode_state  # noqa: E402
from services.story import CHAT_DELTAS, MAX_SCORED_CHATS, START_SCORE, adjusted_affinity, available_characters  # noqa: E402


TO_CHECKPOINT = [
    "visit_neighbors", "visit_karen", "visit_bob", "visit_cathy", "return_home",
    "go_help_cathy", "help_cathy", "go_butcher", "approach_jimmy",
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
        turn = {"reply": "알겠습니다.", "attitude": attitude, "visual_cue": "neutral"}
        with patch.object(chatbot.generator, "generate", return_value=turn):
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
                self.chat(characters[0], f"{state['scene_id']}에서 제가 도울게요")
        self.assertGreaterEqual(decode_state(self.token)["affinity"], 70)
        self.assertTrue(decode_state(self.token)["job_offered"])
        self.festival("accept_job")
        self.assertTrue(decode_state(self.token)["has_car_key"])
        self.assertEqual(self.action("escape")["view"]["ending"], "escape")

    def test_staying_assimilates_even_when_watched(self):
        self.checkpoint()
        self.festival("continue_festival")
        self.assertEqual(self.action("stay")["view"]["ending"], "assimilation")

    def test_action_cannot_repeat_and_secret_is_gated(self):
        self.action("visit_neighbors")
        response = self.client.post("/api/action", json={"state_token": self.token, "action_id": "visit_neighbors"})
        self.assertEqual(response.status_code, 409)
        retriever = StoryRetriever()
        self.assertEqual(retriever.search("지미의 머리카락과 고기", "jimmy", "arrival", []), [])
        self.assertFalse(any(hit.title == "축제 음식의 정체" for hit in retriever.search("지미 머리카락", "bob", "festival", [])))
        self.assertTrue(any(hit.title == "축제 음식의 정체" for hit in retriever.search("지미 머리카락", "bob", "hair_found", ["jimmy_hair"])))

    def test_place_has_one_character_and_affinity_is_shared_with_bob(self):
        start = self.client.post("/api/session", json={"player_name": "검증"}).get_json()["view"]
        self.assertEqual((start["location_name"], start["affinity"]), ("새집", 50))
        self.assertEqual(start["available_characters"][0]["id"], "jimmy")
        self.assertEqual(self.action("visit_neighbors")["view"]["available_characters"], [])
        self.assertEqual(self.action("visit_karen")["view"]["available_characters"][0]["id"], "karen")
        with patch.object(chatbot.generator, "generate", return_value={"reply": "그 얘기는 불편하군요.", "attitude": "suspicious", "visual_cue": "worried"}):
            response = self.client.post("/api/chat", json={"state_token": self.token, "character_id": "karen", "message": "지미는 어디 있죠?"})
        self.assertEqual(response.status_code, 200)
        self.token = response.get_json()["state_token"]
        self.assertEqual(response.get_json()["view"]["affinity"], 47)
        bob = self.action("visit_bob")
        self.assertEqual(bob["view"]["location_name"], "정육점")
        self.assertEqual([person["id"] for person in bob["view"]["available_characters"]], ["bob"])
        self.assertIn("필요한 게", bob["events"][0]["text"])
        with patch.object(chatbot.generator, "generate", return_value={"reply": "어서 오시오.", "attitude": "neutral", "visual_cue": "neutral"}) as generate:
            response = self.client.post("/api/chat", json={"state_token": self.token, "character_id": "bob", "message": "가게는 언제 열어요?"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(generate.call_args.args[6], 47)

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
        turn = {"reply": "기억하고 있어요.", "attitude": "neutral", "visual_cue": "neutral"}
        with patch.object(chatbot.generator, "generate", return_value=turn) as generate:
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

    def test_cathy_farewell_is_not_spoken_after_leaving_salon(self):
        for action_id in TO_CHECKPOINT[:6]:
            self.action(action_id)
        self.assertEqual(decode_state(self.token)["location_id"], "salon")
        result = self.action("help_cathy")
        self.assertEqual(result["view"]["location_id"], "player_house")
        self.assertEqual(result["view"]["available_characters"][0]["id"], "karen")
        self.assertNotIn("cathy", [item["speaker_id"] for item in result["events"]])

    def test_fixed_scene_line_reaches_ai_without_private_thoughts(self):
        for action_id in TO_CHECKPOINT[:-1]:
            self.action(action_id)
        state = decode_state(self.token)
        self.assertEqual(state["scene_id"], "photo_found")
        self.assertEqual([item["speaker_id"] for item in state["scene_events"]], ["karen"])
        self.assertIn("제 방에서", state["scene_events"][0]["text"])
        with patch.object(chatbot.generator, "generate", return_value={"reply": "놀랐을 뿐이에요.", "attitude": "neutral", "visual_cue": "worried"}) as generate:
            response = self.client.post("/api/chat", json={"state_token": self.token, "character_id": "karen", "message": "왜 놀라셨어요?"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(generate.call_args.args[-1], state["scene_events"])
        self.assertEqual(decode_state(response.get_json()["state_token"])["scene_events"], state["scene_events"])

    def test_job_offer_is_fixed_when_later_chat_lowers_affinity(self):
        state = decode_state(self.token)
        state["affinity"] = 75
        self.token = encode_state(state)
        self.checkpoint()
        self.assertEqual(decode_state(self.token)["affinity"], 70)
        for index in range(3):
            response = self.chat("karen", f"수상해요 {index}", "suspicious")
        self.assertEqual(response["view"]["affinity"], 68)
        self.assertIn("accept_job", [action["id"] for action in response["view"]["available_actions"]])
        self.assertTrue(decode_state(self.action("accept_job")["state_token"])["has_car_key"])

    def test_adjustment_center_edges_rounding_and_bounds(self):
        self.assertEqual(START_SCORE, 50)
        self.assertEqual(CHAT_DELTAS, {"cooperative": 3, "neutral": 0, "suspicious": -3})
        self.assertEqual(adjusted_affinity(50, 3), 53)
        self.assertEqual(adjusted_affinity(50, -3), 47)
        self.assertEqual(adjusted_affinity(0, 3), 2)
        self.assertEqual(adjusted_affinity(100, -3), 98)
        self.assertEqual(adjusted_affinity(0, -3), 0)
        self.assertEqual(adjusted_affinity(100, 3), 100)
        self.assertEqual(adjusted_affinity(0, 1), 0)

    def test_neutral_duplicate_and_chat_limit(self):
        self.assertEqual(self.chat("jimmy", "안녕", "neutral")["view"]["affinity"], 50)
        self.assertEqual(self.chat("jimmy", "도울게")["view"]["affinity"], 53)
        self.assertEqual(self.chat("jimmy", "도울게")["view"]["affinity"], 53)
        self.action("visit_neighbors")
        self.action("visit_karen")
        self.assertEqual(self.chat("karen", "  도울게  ")["view"]["affinity"], 53)
        state = decode_state(self.token)
        state["scored_chat"] = [f"earlier:{n}" for n in range(MAX_SCORED_CHATS)]
        self.token = encode_state(state)
        self.assertEqual(self.chat("karen", "다른 일을 돕겠습니다")["view"]["affinity"], 53)


if __name__ == "__main__":
    unittest.main()
