# 더뉴빌리지로 오세요 — 화면·서버 API 계약 v4

> 분류: 팀 신규 · 독자: 두 개발자와 구현 AI 에이전트 · 실행 중 대화 모델의 입력: 아님. [문서 지도](README.md)

이 계약은 화면과 서버를 다른 브랜치에서 작업할 때의 공통 기준이다. 모든 API는 동일 출처의 UTF-8 JSON을 사용한다. 서버만 장면·단서·호감도·차 키·엔딩을 판정한다. 화면은 응답의 `view`와 `events`를 그린다.

## 성공 응답

모든 성공 응답은 같은 최상위 필드를 사용한다.

```json
{
  "state_token": "encrypted-state-token",
  "events": [{"speaker_id": "jimmy", "text": "새로 오셨군요!", "image": "/assets/images/jimmy_smile.svg"}],
  "view": {
    "scene_id": "arrival",
    "location_id": "player_house",
    "location_name": "새집",
    "background": "/assets/images/player_house.svg",
    "available_characters": [{"id": "jimmy", "name": "지미", "portrait": "/assets/images/jimmy_neutral.svg"}],
    "available_actions": [{"id": "visit_neighbors", "label": "이웃들에게 인사하러 간다", "kind": "move"}],
    "affinity": 50,
    "journal": [],
    "ending": null
  }
}
```

- `state_token`은 암호화된 진행 기록이다. 화면은 플레이 중 메모리에만 보관하고 **모든 후속 요청에 그대로 보낸다**. URL이나 브라우저의 영구 저장소에 넣지 않는다. 새로고침·화면 이탈 뒤 재진입·엔딩 뒤 새 시작은 이름 입력 화면부터 새 플레이를 만든다.
- `events`는 이번 요청에서 새로 생긴 메시지다. `speaker_id`는 `jimmy`, `karen`, `bob`, `cathy`, `narrator`, `thought` 중 하나이고 `image`는 공개 URL 또는 `null`이다. 사용자의 입력은 화면이 표시한다.
- `view`에는 현재 장면·장소 이름과 배경, 공개 가능한 선택지가 들어간다. `available_characters`는 현재 장소에서 대화할 수 있는 인물 최대 한 명이다. 새집에서는 해당 장면의 인물이 먼저 찾아온다. 축제 광장의 대화 상대는 밥이다.
- `affinity`는 공개되는 마을 호감도 정수(0~100)다. 화면은 이 값을 그대로 표시하고 점수나 일자리 여부를 직접 계산하지 않는다. `available_actions.kind`는 `move`, `inspect`, `choice` 중 하나다. `ending`은 `null`, `escape`, `death`, `assimilation` 중 하나다. 엔딩 후에는 대화 상대와 행동 목록이 비어 있다.
- 차 키, 미래 단서, 인물별 비밀은 `view`로 보내지 않는다. 이미 발견한 사실만 `journal`에 나타낸다.
- 화면은 장소 이미지를 큰 배경으로 사용하고 현재 인물을 그 위에 표시한다. 현재 장면의 사건 대사와 해당 인물의 자유 대화는 같은 대화창에 시간순으로 보여준다. 다른 인물의 과거 대화는 섞지 않는다. 행동 선택지는 화면 중앙 하단에 놓는다.
- URL은 `/assets/images/...` 형식이며 실제 파일이 `public/assets/images/`에 있어야 한다.

## 요청

| 엔드포인트 | JSON 요청 | 성공 | 역할 |
| --- | --- | --- | --- |
| `POST /api/session` | `{"player_name":"알렉스"}` | `201` | 새 이야기 시작. 이름은 공백을 제외한 1~50자 |
| `POST /api/session/resume` | `{"state_token":"..."}` | `200` | 기존 서버 API 호환용. 현재 화면은 이어하기에 사용하지 않는다 |
| `POST /api/chat` | `{"state_token":"...","character_id":"jimmy","message":"마을은 어때요?"}` | `200` | 현재 대화 가능한 인물에게 자유 입력. 메시지는 공백을 제외한 1~2000자 |
| `POST /api/action` | `{"state_token":"...","action_id":"visit_neighbors"}` | `200` | 직전 `view.available_actions`에 있는 ID만 실행 |

대화 입력은 AI 대사와 제한된 호감도 변화만 만든다. 장면 이동, 단서 획득, 차 키, 엔딩은 `action_id`로만 처리한다. 화면은 요청 중 다른 요청을 보내지 않고, 성공 응답의 새 토큰으로 이전 토큰을 교체한다. 모델 실패 시 이전 토큰을 유지한다.

미용실 `cathy_help` 장면은 대화창 없이 배경과 바구니를 보여준다. 바구니를 누르면 확대 화면에서 서버 `events`의 캐시 요청을 3초 보여준 뒤 도구를 고를 수 있다. 도구 버튼은 `view.available_actions`에 있는 `choose_shampoo`, `choose_scissors`, `choose_conditioner`, `choose_comb`, `choose_dryer`, `choose_spray`를 사용한다. 같은 ID를 다시 보내면 해당 도구의 선택이 취소된다. `help_cathy`는 현재 선택을 서버에서 판정해 `cathy_result`로 이동하며, 성공일 때만 호감도 +5를 적용한다. `cathy_result`의 `return_home`으로 기존 지미 장면에 이어진다. 응답 필드와 요청 JSON 형식은 그대로다.

정육점의 `inspect_basement`는 기존처럼 지하실 **입장** 행동이다. `basement` 장면에서는 그림의 화로를 클릭할 때만 `view.available_actions`의 `inspect_brazier`를 `/api/action`에 보낸다. 성공 응답의 단서 사건을 표시한 뒤 서버가 제공하는 `go_upstairs`(“지하실에서 나온다”)를 보여준다. 입장만으로 단서를 표시하거나 조사 전 퇴장을 제공하지 않는다. 같은 행동을 반복 요청하면 기존 `invalid_action` 오류가 난다. 공개 API 필드와 토큰 전달 방식은 그대로다.

캐런의 집에서 `inspect_room`을 실행하면 `photo_found`로 이동하지만, 이때는 사진 단서와 호감도 변화가 없다. 화면이 기존 사진 확대·앞뒷면 확인 흐름을 보여준 뒤 `view.available_actions`의 `recognize_photo`를 `/api/action`에 보내면, 서버가 사진 단서·호감도 −5·캐런의 고정 대사를 한 번 적용한다. 성공 응답에서만 `return_home`이 제공된다. 요청·응답 형식과 장면 ID는 그대로다.

마을 호감도는 인물 사이에 공유된다. 한 인물과의 대화로 점수가 바뀌면 이후 다른 인물의 대사 태도에도 반영한다. 인물별 최근 대화는 진행 토큰에 따로 보관해 같은 인물을 다시 만났을 때 이어 쓴다. 사진 사건 뒤 귀가할 때의 일자리 판정은 그 시점에 고정하고 이후 대화로 바꾸지 않는다.

서버는 현재 장면에서 이미 화면에 나온 고정 대사 중 **대화 상대 자신의 말과 공개 상황**을 진행 토큰에 보관한다. `/api/chat`은 이를 인물별 자유 대화 기록과 함께 AI에 전달한다. 주인공의 속마음과 미래 사건은 전달하지 않는다. AI는 이미 한 인사를 되풀이하지 않고 사용자의 질문에 이어 답하되, 사건·단서·점수·엔딩은 결정하지 않는다. 고정 사건 대사는 계속 서버 규칙이 만들고, 이웃을 다시 방문할 때 첫 인사를 반복하지 않는다.

## 오류

```json
{"error":{"code":"invalid_action","message":"지금은 이 행동을 할 수 없습니다."}}
```

| HTTP | 코드 | 의미 |
| --- | --- | --- |
| `400` | `invalid_request`, `invalid_message`, `invalid_state_token` | 요청 형식·입력 또는 토큰이 잘못됨 |
| `409` | `invalid_action`, `character_unavailable`, `story_finished` | 현재 장면에서 불가능한 요청 |
| `413` | `message_too_long` | 메시지가 2000자를 넘음 |
| `500` | `chat_failed` | 모델 호출 등 처리 실패. 서버 비밀과 내부 예외를 노출하지 않음 |

## 서버 내부 이미지 선택기

```python
select(reply_text: str, character_id: str, scene_id: str, visual_cue: str | None = None) -> str | None
```

`visual_cue`는 `neutral`, `smile`, `worried` 중 하나이거나 `None`이다. 선택기는 대사·상황에 맞는 카탈로그 이미지를 반환하지만 진행 상태를 바꾸지 않는다. 카탈로그에 없는 파일이나 외부 URL을 새로 만들지 않는다.

## 변경 절차

필드 이름, 자료형, 엔드포인트 또는 이미지 선택기 시그니처를 바꾸려면 두 개발자가 먼저 합의해 이 문서를 수정한다. 각자 브랜치에서 인터페이스를 추측해 늘리지 않는다.
