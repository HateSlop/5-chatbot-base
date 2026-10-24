"""캐릭터 답변을 만드는 경계. 기본 구현에는 모델 호출이 없습니다."""

from .retriever import KnowledgeHit


class DemoGenerator:
    def generate(
        self,
        question: str,
        username: str,
        character: dict,
        knowledge: list[KnowledgeHit],
    ) -> str:
        """캐릭터 설정과 검색 결과를 받아 답변 문자열을 반환합니다."""
        return (
            f"{username}님, ‘{question}’ 메시지를 받았습니다. "
            "현재는 데모 응답입니다. 이 함수를 팀의 챗봇 로직으로 바꿔주세요."
        )
