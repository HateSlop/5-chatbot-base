"""팀이 검색과 모델 호출을 연결할 자리.

이 파일의 기본 구현은 외부 API를 호출하지 않는 데모입니다. 제공되는 웹 화면과
요청·응답 계약을 먼저 확인한 다음, 팀의 캐릭터 데이터와 답변 생성 방식을 구현하세요.
"""


class ChatbotService:
    def generate_response(self, user_message: str, username: str = "사용자") -> dict:
        """`{'reply': str, 'image': str | None, 'sources': list[str]}` 형태로 답합니다.

        구현 시 권장 흐름: 자료 준비 → 관련 자료 검색 → 출처 확인 → 답변 생성.
        검색 방법, 모델 제공자, 프레임워크와 저장소는 팀이 선택할 수 있습니다.
        """
        return {
            "reply": (
                f"{username}님, ‘{user_message}’ 메시지를 받았습니다. "
                "현재는 데모 응답입니다. 이 함수를 팀의 챗봇 로직으로 바꿔주세요."
            ),
            "image": None,
            "sources": [],
        }
