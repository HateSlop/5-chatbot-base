"""질문에 맞는 자료를 찾는 경계. 기본 구현은 검색하지 않습니다."""

from dataclasses import dataclass


@dataclass(frozen=True)
class KnowledgeHit:
    title: str
    content: str


class DemoRetriever:
    def search(self, question: str) -> list[KnowledgeHit]:
        """실제 검색을 붙일 때 이 메서드를 교체하세요."""
        return []
