"""이전 베이스에서 놓쳤던 정적 파일과 빈 응답 회귀를 확인합니다."""

import unittest
from unittest.mock import patch

from app import app


class SmokeTest(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_pages_and_referenced_assets(self):
        for route in ("/", "/detail", "/chat?username=민지", "/health"):
            with self.subTest(route=route):
                self.assertEqual(self.client.get(route).status_code, 200)

        chat_page = self.client.get("/chat").get_data(as_text=True)
        self.assertIn("/assets/js/chatbot.js", chat_page)
        self.assertIn("/assets/images/avatar.svg", self.client.get("/").get_data(as_text=True))
        for path in (
            "/assets/js/chatbot.js",
            "/assets/css/style.css",
            "/assets/images/avatar.svg",
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                response.close()

    def test_chat_returns_a_real_response(self):
        response = self.client.post("/api/chat", json={"message": "안녕", "username": "민지"})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("안녕", data["reply"])
        self.assertIsNone(data["image"])
        self.assertEqual(data["sources"], [])

    def test_bad_inputs_are_rejected(self):
        cases = (
            ({}, 400, "invalid_message"),
            ({"message": "   "}, 400, "invalid_message"),
            ({"message": "x" * 2001}, 413, "message_too_long"),
            ({"message": "안녕", "username": 1}, 400, "invalid_username"),
        )
        for payload, status, code in cases:
            with self.subTest(code=code):
                response = self.client.post("/api/chat", json=payload)
                self.assertEqual(response.status_code, status)
                self.assertEqual(response.get_json()["error"]["code"], code)

        response = self.client.post("/api/chat", data="broken", content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"]["code"], "invalid_json")

    def test_service_failure_is_not_a_successful_null(self):
        with patch("app.chatbot.generate_response", side_effect=RuntimeError("upstream down")), patch(
            "app.app.logger.exception"
        ):
            response = self.client.post("/api/chat", json={"message": "안녕"})
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.get_json()["error"]["code"], "chat_failed")


if __name__ == "__main__":
    unittest.main()
