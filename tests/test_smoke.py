"""화면·정적 파일·채팅 응답과 서비스 연결을 확인합니다."""

import unittest
from unittest.mock import patch

from app import app
from services.chatbot_service import ChatbotService
from services.retriever import KnowledgeHit


class SmokeTest(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_pages_and_referenced_assets(self):
        for route in ("/", "/detail", "/chat?username=헤슬", "/health"):
            with self.subTest(route=route):
                self.assertEqual(self.client.get(route).status_code, 200)

        chat_page = self.client.get("/chat").get_data(as_text=True)
        self.assertIn("/assets/js/chatbot.js", chat_page)
        self.assertIn("/assets/images/hateslop-logo.png", self.client.get("/").get_data(as_text=True))
        for path in (
            "/assets/js/chatbot.js",
            "/assets/css/style.css",
            "/assets/images/hateslop-logo.png",
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                response.close()

    def test_chat_returns_demo_response(self):
        response = self.client.post("/api/chat", json={"message": "안녕", "username": "헤슬"})
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

    def test_service_passes_character_and_retrieved_sources_to_generator(self):
        hit = KnowledgeHit(title="세계관 설정", content="성 안에는 오래된 도서관이 있다.")

        class Retriever:
            def search(self, question):
                self.question = question
                return [hit]

        class Generator:
            def generate(self, question, username, character, knowledge):
                self.args = (question, username, character, knowledge)
                return "도서관을 찾아보세요."

        retriever, generator = Retriever(), Generator()
        service = ChatbotService(retriever, generator)
        character = {"name": "안내인"}
        result = service.generate_response("도서관은 어디?", "헤슬", character)
        self.assertEqual(retriever.question, "도서관은 어디?")
        self.assertEqual(generator.args, ("도서관은 어디?", "헤슬", character, [hit]))
        self.assertEqual(result["sources"], ["세계관 설정"])
        self.assertEqual(result["reply"], "도서관을 찾아보세요.")


if __name__ == "__main__":
    unittest.main()
