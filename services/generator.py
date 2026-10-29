"""캐릭터 설정과 검색 결과를 사용해 답변을 생성합니다."""

import os

from openai import OpenAI

from .retriever import KnowledgeHit


ALLOWED_REASONING_EFFORTS = {"none", "low", "medium"}


class DemoGenerator:
    def generate(
        self,
        question: str,
        username: str,
        character: dict,
        knowledge: list[KnowledgeHit],
        reasoning_effort: str | None = None,
    ) -> str:
        effort = (
            reasoning_effort
            if reasoning_effort is not None
            else os.getenv("OPENAI_REASONING_EFFORT", "none")
        )
        if effort not in ALLOWED_REASONING_EFFORTS:
            raise ValueError(
                "OPENAI_REASONING_EFFORT must be none, low, or medium."
            )

        persona = character.get("persona", {})
        instructions = (
            f"당신은 {character.get('name', '캐릭터')}입니다.\n"
            f"성격: {persona.get('personality', '')}\n"
            f"말투: {persona.get('speaking_style', '')}\n"
            f"세계관: {persona.get('world', '')}\n"
            "캐릭터 설정을 유지하며 답하세요. 모르는 사실은 지어내지 마세요."
        )

        if knowledge:
            context = "\n".join(
                f"- {hit.title}: {hit.content}" for hit in knowledge[:3]
            )
            instructions += f"\n참고 자료:\n{context}"

        response = OpenAI(timeout=20.0, max_retries=0).responses.create(
            model=os.getenv("OPENAI_MODEL", "gpt-6-luna"),
            reasoning={"effort": effort},
            instructions=instructions,
            input=f"{username}: {question}",
            max_output_tokens=512,
        )
        if response.status == "incomplete":
            raise RuntimeError("모델 응답이 완료되지 않았습니다.")

        reply = response.output_text.strip()
        if not reply:
            raise RuntimeError("모델이 빈 답변을 반환했습니다.")
        return reply
