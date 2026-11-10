"""공개 화면과 이야기 API의 기본 연결을 확인한다."""

import os
import unittest
from unittest.mock import patch

from cryptography.fernet import Fernet

os.environ["STORY_STATE_KEY"] = Fernet.generate_key().decode("ascii")

from app import app, chatbot  # noqa: E402
from services.state_token import decode_state, encode_state  # noqa: E402


class SmokeTest(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def start(self):
        response = self.client.post("/api/session", json={"player_name": "알렉스", "gender": "male"})
        self.assertEqual(response.status_code, 201)
        return response.get_json()["state_token"]

    def test_pages_and_assets(self):
        for path in ("/", "/detail", "/chat?username=알렉스", "/health", "/assets/js/chatbot.js", "/assets/css/style.css", "/assets/images/village-cover.svg", "/assets/images/jimmy_smile.svg"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                response.close()
        chat_response = self.client.get("/chat?username=이전이름")
        self.assertIn("no-store", chat_response.headers["Cache-Control"])
        chat_page = chat_response.get_data(as_text=True)
        self.assertIn('id="name-form"', chat_page)
        self.assertIn("assets/js/name-entry.js", chat_page)
        self.assertNotIn('data-player-name="이전이름"', chat_page)

    def test_session_and_resume(self):
        token = self.start()
        response = self.client.post("/api/session/resume", json={"state_token": token})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["view"]["scene_id"], "arrival")
        self.assertEqual(decode_state(response.get_json()["state_token"])["player_name"], "알렉스")
        self.assertEqual(response.get_json()["view"]["gender"], "male")
        self.assertIsNone(response.get_json()["view"]["job"])

    def test_new_play_requires_name_and_gender_and_resets_both(self):
        for payload in ({"player_name": "알렉스"}, {"gender": "female"},
                        {"player_name": "알렉스", "gender": "other"},
                        {"player_name": "알렉스", "gender": 1},
                        {"player_name": " ", "gender": "male"}):
            with self.subTest(payload=payload):
                response = self.client.post("/api/session", json=payload)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.get_json()["error"]["code"], "invalid_request")
        first = self.start()
        second = self.client.post("/api/session", json={"player_name": "새 이름", "gender": "female"})
        self.assertEqual(second.status_code, 201)
        state = decode_state(second.get_json()["state_token"])
        self.assertNotEqual(first, second.get_json()["state_token"])
        self.assertEqual((state["player_name"], state["gender"], state["job"], state["affinity"]),
                         ("새 이름", "female", None, 50))
        self.assertEqual(second.get_json()["view"]["gender"], "female")

    def test_older_token_without_gender_remains_readable(self):
        state = decode_state(self.start())
        del state["gender"]
        response = self.client.post("/api/session/resume", json={"state_token": encode_state(state)})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.get_json()["view"]["gender"])

    def test_new_session_with_same_name_has_no_previous_play(self):
        token = self.start()
        turn = {"reply": "도와줘서 고마워.", "visual_cue": "smile"}
        with patch.object(chatbot.generator, "classify", return_value="cooperative"), patch.object(chatbot.generator, "generate", return_value=turn):
            response = self.client.post("/api/chat", json={"state_token": token, "character_id": "jimmy", "message": "도울게"})
        self.assertEqual(response.get_json()["view"]["affinity"], 57)
        fresh = decode_state(self.start())
        self.assertEqual(fresh["affinity"], 50)
        self.assertEqual(fresh["history"], {})
        self.assertEqual(fresh["scored_chat"], [])

    def test_invalid_inputs_and_tampered_token(self):
        self.assertEqual(self.client.post("/api/session", json={"player_name": " ", "gender": "male"}).status_code, 400)
        self.assertEqual(self.client.post("/api/session", data="broken", content_type="application/json").status_code, 400)
        token = self.start()
        bad_token = token[:-2] + ("AA" if token[-2:] != "AA" else "BB")
        response = self.client.post("/api/session/resume", json={"state_token": bad_token})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"]["code"], "invalid_state_token")
        response = self.client.post("/api/chat", json={"state_token": token, "character_id": "jimmy", "message": "x" * 2001})
        self.assertEqual(response.status_code, 413)

    def test_undated_or_invalid_day_token_asks_for_new_play(self):
        state = decode_state(self.start())
        for day in range(5):
            with self.subTest(valid_day=day):
                response = self.client.post("/api/session/resume", json={"state_token": encode_state({**state, "story_day": day})})
                self.assertEqual(response.status_code, 200)
        for change in ({"start_date": None}, {"start_date": "2024-02-30"}, {"story_day": 5}, {"story_day": -1}):
            with self.subTest(change=change):
                response = self.client.post("/api/session/resume", json={"state_token": encode_state({**state, **change})})
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.get_json()["error"]["code"], "invalid_state_token")

    def test_chat_failure_keeps_state_and_unavailable_character_is_rejected(self):
        token = self.start()
        response = self.client.post("/api/chat", json={"state_token": token, "character_id": "bob", "message": "안녕"})
        self.assertEqual(response.status_code, 409)
        with patch.object(chatbot.generator, "classify", return_value="friendly"), patch.object(chatbot.generator, "generate", side_effect=RuntimeError("offline")), patch("app.app.logger.exception"):
            response = self.client.post("/api/chat", json={"state_token": token, "character_id": "jimmy", "message": "안녕"})
        self.assertEqual(response.status_code, 500)
        self.assertEqual(decode_state(token)["affinity"], 50)
        self.assertEqual(decode_state(token)["history"], {})

    def test_both_model_failures_leave_original_token_usable(self):
        token = self.start()
        payload = {"state_token": token, "character_id": "jimmy", "message": "안녕하세요"}
        with patch.object(chatbot.generator, "classify", side_effect=RuntimeError("offline")), patch.object(chatbot.generator, "generate") as generate, patch("app.app.logger.exception"):
            response = self.client.post("/api/chat", json=payload)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.get_json()["error"]["code"], "chat_failed")
        self.assertNotIn("state_token", response.get_json())
        generate.assert_not_called()

        with patch.object(chatbot.generator, "classify", return_value="friendly"), patch.object(chatbot.generator, "generate", side_effect=RuntimeError("offline")), patch("app.app.logger.exception"):
            response = self.client.post("/api/chat", json=payload)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.get_json()["error"]["code"], "chat_failed")
        self.assertNotIn("state_token", response.get_json())
        resumed = self.client.post("/api/session/resume", json={"state_token": token}).get_json()
        self.assertEqual(resumed["view"]["affinity"], 50)
        self.assertEqual(decode_state(resumed["state_token"])["history"], {})


if __name__ == "__main__":
    unittest.main()
