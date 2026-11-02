"""인물의 대사와 대화 태도를 한 번의 모델 호출로 생성한다."""

import json
import os

from openai import OpenAI

from .retriever import KnowledgeHit
from .story import CHAT_DELTAS, WARY_SCORE, WELCOME_SCORE


ALLOWED_REASONING_EFFORTS = {"none", "low", "medium"}
TURN_SCHEMA = {
    "type": "object",
    "properties": {
        "reply": {"type": "string"},
        "attitude": {"type": "string", "enum": ["cooperative", "neutral", "suspicious"]},
        "visual_cue": {"type": "string", "enum": ["neutral", "smile", "worried"]},
    },
    "required": ["reply", "attitude", "visual_cue"],
    "additionalProperties": False,
}


class StoryGenerator:
    def generate(
        self,
        question: str,
        username: str,
        character: dict,
        knowledge: list[KnowledgeHit],
        history: list[dict],
        place_name: str,
        affinity: int,
        scene_events: list[dict],
    ) -> dict:
        effort = os.getenv("OPENAI_REASONING_EFFORT", "none")
        if effort not in ALLOWED_REASONING_EFFORTS:
            raise ValueError("OPENAI_REASONING_EFFORT must be none, low, or medium.")

        persona = character.get("persona", {})
        village_attitude = (
            "경계: 원래의 성격과 말투를 유지하되 대답을 짧게 하고 거리를 두세요. 캐런은 정중하고 밝은 겉모습을 유지하세요"
            if affinity < WARY_SCORE else
            "환대: 원래의 성격과 말투를 유지하며 편안하게 맞이하세요"
            if affinity >= WELCOME_SCORE else
            "평소: 원래의 성격과 말투를 유지하며 자연스럽게 대하세요"
        )
        instructions = (
            f"당신은 1960년대 미국 마을 더뉴빌리지의 {character['name']}입니다. 한국어로 자연스럽게 말하세요.\n"
            f"현재 장소: {place_name}. 마을 전체의 태도: {village_attitude}. 이 태도는 모든 주민에게 공유됩니다. 점수 자체를 대사에서 말하지 마세요.\n"
            f"성격: {persona.get('personality', '')}\n"
            f"말투: {persona.get('speaking_style', '')}\n"
            f"현재 공개 가능한 사실: {persona.get('world', '')}\n"
            "제공된 사실 밖의 사건이나 미래의 비밀을 지어내거나 미리 밝히지 마세요. "
            "장소 이동, 단서 획득, 호감도와 엔딩을 선언하지 마세요. 이전에 나눈 대화를 기억하고, 일반적인 질문에도 자연스럽게 이어서 한두 문장으로 대답하세요. "
            "현재 장면에서 이미 한 대사를 반복하거나 다시 인사하지 말고, 플레이어의 질문에 이어서 답하세요. "
            "attitude는 답변의 친절함이나 표정이 아니라 이번 사용자 발화의 행동만 분류하세요. "
            "실제로 도움을 약속하거나 협조하면 cooperative, 근거 있는 추궁이나 적대적 행동이면 suspicious입니다. "
            "인사, 반복 질문, 단순 정보 요청, 판단 근거가 부족한 말은 neutral입니다. visual_cue는 답변에 어울리는 표정입니다."
        )

        if scene_events:
            lines = "\n".join(
                f"- {'당신이 이미 한 말' if item['speaker_id'] != 'narrator' else '공개된 상황'}: {item['text']}"
                for item in scene_events
            )
            instructions += f"\n현재 장면에서 이미 일어난 공개 사건:\n{lines}"

        if knowledge:
            context = "\n".join(
                f"- {hit.title}: {hit.content}" for hit in knowledge[:3]
            )
            instructions += f"\n참고 자료:\n{context}"

        conversation = [
            {"role": item["role"], "content": item["content"]}
            for item in history[-20:]
        ]
        conversation.append({"role": "user", "content": f"{username}: {question}"})
        response = OpenAI(timeout=20.0, max_retries=0).responses.create(
            model=os.getenv("OPENAI_MODEL", "gpt-6-luna"),
            reasoning={"effort": effort},
            instructions=instructions,
            input=conversation,
            text={"format": {"type": "json_schema", "name": "character_turn", "strict": True, "schema": TURN_SCHEMA}},
            max_output_tokens=700,
        )
        if response.status == "incomplete":
            raise RuntimeError("모델 응답이 완료되지 않았습니다.")

        try:
            turn = json.loads(response.output_text)
            if not isinstance(turn["reply"], str) or not turn["reply"].strip():
                raise ValueError("empty reply")
            if turn["attitude"] not in CHAT_DELTAS:
                raise ValueError("invalid attitude")
            if turn["visual_cue"] not in {"neutral", "smile", "worried"}:
                raise ValueError("invalid visual cue")
        except (ValueError, KeyError, TypeError) as exc:
            raise RuntimeError("모델 응답 형식이 올바르지 않습니다.") from exc
        return turn
