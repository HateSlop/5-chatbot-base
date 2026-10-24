"""검색 결과와 답변 생성기를 묶어 API 응답을 조립합니다."""

from .generator import DemoGenerator
from .retriever import DemoRetriever


class ChatbotService:
    def __init__(self, retriever=None, generator=None):
        self.retriever = retriever or DemoRetriever()
        self.generator = generator or DemoGenerator()

    def generate_response(
        self, user_message: str, username: str = "사용자", character: dict | None = None
    ) -> dict:
        """`reply`, `image`, `sources`로 이루어진 응답을 반환합니다."""
        knowledge = self.retriever.search(user_message)
        reply = self.generator.generate(user_message, username, character or {}, knowledge)
        return {
            "reply": reply,
            "image": None,
            "sources": list(dict.fromkeys(hit.title for hit in knowledge)),
        }
