# 더뉴빌리지로 오세요 — 화면·서버 API 계약 v6

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
    "gender": "female",
    "job": null,
    "journal": [],
    "today": "11월 9일",
    "photo_back_date": null,
    "choice_deadline": null,
    "ending": null
  }
}
```

- `state_token`은 암호화된 진행 기록이다. 화면은 플레이 중 메모리에만 보관하고 **모든 후속 요청에 그대로 보낸다**. URL이나 브라우저의 영구 저장소에 넣지 않는다. 첫 화면에서 ‘시작하기’를 누르면 남/여 선택 화면이 열리고, 선택 뒤에만 독백을 시작해 이름을 입력한다. 성별은 `/chat`으로 이동할 때만 전달하고 주소에서 곧 지운다. 성별 없이 `/chat`에 들어오면 독백을 시작하지 않고 첫 화면으로 돌아간다. 새 시작에는 성별과 이름을 다시 받으며 이전 기록을 쓰지 않는다.
- `events`는 이번 요청에서 새로 생긴 메시지다. `speaker_id`는 `jimmy`, `karen`, `bob`, `cathy`, `narrator`, `thought` 중 하나이고 `image`는 공개 URL 또는 `null`이다. 사용자의 입력은 화면이 표시한다.
- `view`에는 현재 장면·장소 이름과 배경, 공개 가능한 선택지가 들어간다. `available_characters`는 현재 장소에서 대화할 수 있는 인물 최대 한 명이다. 새집에서는 해당 장면의 인물이 먼저 찾아온다. 축제 광장의 대화 상대는 밥이다.
- `affinity`는 공개되는 마을 호감도 정수(0~100)다. 화면은 이 값을 그대로 표시하고 점수나 일자리 여부를 직접 계산하지 않는다. `available_actions.kind`는 `move`, `inspect`, `choice` 중 하나다. `ending`은 `null`, `escape`, `death`, `assimilation` 중 하나다. 엔딩 후에는 대화 상대와 행동 목록이 비어 있다.
- `view.gender`는 새 플레이에서 선택한 `male`(남) 또는 `female`(여)다. 이전 버전에서 발급된 진행 토큰에는 `null`일 수 있다. `view.job`은 직업을 실제 선택하기 전과 거절한 뒤에는 `null`, 정원사를 선택하면 `gardener`, 트럭 운전수를 선택하면 `driver`다. 화면은 이 값을 표시용 이름으로만 바꾸며 대사·기록·제안 여부로 직업을 추측하지 않는다. 주인공 사진이 준비되기 전에는 성별과 관계없이 공통 임시 표시를 쓴다.
- 차 키, 미래 단서, 인물별 비밀은 `view`로 보내지 않는다. 이미 발견한 사실만 `journal`에 나타낸다.
- `view.today`는 해당 플레이의 이야기 날짜를 `M월 D일`로 표시한다. 내부에는 시작한 해를 보관하지만 응답에는 연도가 없다. 새 플레이 시작 시 한국 시간의 실제 날짜를 고정하고, 지미를 기다리는 장면과 축제로 이동할 때 각각 다음 날로 넘어간다. `view.photo_back_date`는 액자 뒷면 확인 전과 다른 장면에서 `null`이며, 확인에 성공한 `photo_found` 장면에서만 그 장면의 어제 날짜를 같은 형식으로 보낸다.
- 화면은 장소 이미지를 큰 배경으로 사용하고 현재 인물을 그 위에 표시한다. 현재 장면의 사건 대사와 해당 인물의 자유 대화는 같은 대화창에 시간순으로 보여준다. 다른 인물의 과거 대화는 섞지 않는다. 행동 선택지는 화면 중앙 하단에 놓는다.
- URL은 `/assets/images/...` 형식이며 실제 파일이 `public/assets/images/`에 있어야 한다.

## 요청

| 엔드포인트 | JSON 요청 | 성공 | 역할 |
| --- | --- | --- | --- |
| `POST /api/session` | `{"player_name":"알렉스","gender":"female"}` | `201` | 새 이야기 시작. 이름은 공백을 제외한 1~50자, 성별은 `male` 또는 `female` 필수 |
| `POST /api/session/resume` | `{"state_token":"..."}` | `200` | 기존 서버 API 호환용. 현재 화면은 이어하기에 사용하지 않는다 |
| `POST /api/chat` | `{"state_token":"...","character_id":"jimmy","message":"마을은 어때요?"}` | `200` | 현재 대화 가능한 인물에게 자유 입력. 메시지는 공백을 제외한 1~2000자 |
| `POST /api/action` | `{"state_token":"...","action_id":"visit_neighbors"}` | `200` | 직전 `view.available_actions`에 있는 ID만 실행 |

대화 입력은 AI 대사와 제한된 호감도 변화만 만든다. 장면 이동, 단서 획득, 차 키, 엔딩은 `action_id`로만 처리한다. 화면은 요청 중 다른 요청을 보내지 않고, 성공 응답의 새 토큰으로 이전 토큰을 교체한다. 모델 실패 시 이전 토큰을 유지한다.

미용실 `cathy_help` 장면에서는 먼저 캐시가 “지금 너무 바쁘니까 바구니에서 물건 좀 꺼내와줄래요?”라고 부탁하고 퇴장하는 화면 연출을 보여준다. 인사 뒤 대기는 1.4초이며, 퇴장 뒤 배경 중앙에 투명 배경의 바구니를 표시한다. 바구니를 누르면 서버 `events`의 구체적인 요청을 한 줄로 표시하고 `3→2→1` 카운트를 약 1초씩, 총 3초 진행한다. 이후 요청·숫자를 함께 숨기고 도구 선택을 시작한다. 아래의 작은 기억 도움말은 계속 유지한다. 이 장면 동안에는 사용자 제공 미니게임 음악을 사용하고 결과 장면에서는 원래 장소 음악으로 돌아간다. 2026-11-09 사용자가 첨부 그림에 맞춘 선택지 변경을 선택함에 따라, 도구는 `view.available_actions`의 `choose_shampoo`, `choose_scissors`, `choose_conditioner`, `choose_comb`, `choose_spray`, `choose_serum`, `choose_brush`, `choose_mirror`, `choose_towel`, `choose_roller`를 사용한다. 그림에 없는 `choose_dryer`는 더 이상 제공하지 않는다. 기존 요청인 샴푸·가위·빗은 그림에 모두 있으므로 정답으로 유지한다. 같은 ID를 다시 보내면 해당 도구의 선택이 취소된다. `help_cathy`는 현재 선택을 서버에서 판정해 `cathy_result`로 이동하며, 성공일 때만 호감도 +5를 적용한다. `cathy_result`의 `return_home`으로 기존 지미 장면에 이어진다. 응답 필드와 요청 JSON 형식은 그대로다.

정육점의 `inspect_basement`는 기존처럼 지하실 **입장** 행동이다. `basement` 장면에서는 그림의 화로를 클릭할 때만 `view.available_actions`의 `inspect_brazier`를 `/api/action`에 보낸다. 성공 응답의 단서 사건을 표시한 뒤 서버가 제공하는 `go_upstairs`(“지하실에서 나온다”)를 보여준다. 입장만으로 단서를 표시하거나 조사 전 퇴장을 제공하지 않는다. 같은 행동을 반복 요청하면 기존 `invalid_action` 오류가 난다. 공개 API 필드와 토큰 전달 방식은 그대로다.

사색 지미가 있는 `butcher_search`에서는 대화 응답을 “...”로 고정하며, `approach_jimmy` 뒤에는 `empty_butcher`에서 퇴장 서술을 표시합니다. 사건과 점수 판정은 기존 서버 규칙을 유지합니다.

캐런의 집에서 `inspect_room`을 실행하면 `photo_found`로 이동하지만, 이때는 사진 단서와 호감도 변화가 없다. 화면은 정면 방→‘주변을 둘러본다’→사진이 있는 옆면 순서를 보여주며, 정면에서는 사진 선택을 제공하지 않습니다. 사진 확대·앞뒷면 확인 흐름을 보여준 뒤 `view.available_actions`의 `recognize_photo`를 `/api/action`에 보내면, 서버가 사진 단서·호감도 −5·캐런의 고정 대사를 한 번 적용한다. 성공 응답에서만 `return_home`이 제공된다. 요청·응답 형식과 장면 ID는 그대로다.

`photo_found`에서 액자 **뒷면을 열 때** 화면은 `view.available_actions`의 `inspect_photo_back`을 `/api/action`에 보낸다. 성공한 응답의 `view.photo_back_date`를 뒷면에 표시하고 날짜 단서를 기록한다. 요청 전에는 뒷면 날짜를 표시하거나 단서를 기록하지 않는다. 이 조사는 한 번만 가능하며 `recognize_photo`의 사진 인지·감점·캐런 대사는 변경하지 않는다. 뒤집기 요청이 실패하면 이전 토큰과 사진 상태를 유지한다.

사진 사건 뒤 귀가 시 65점 이상이면 `checkpoint`에서 `accept_job`(일자리를 알아본다)·`decline_job`(지금은 거절한다)을 제공합니다. `accept_job`은 `job_choice`로 이동하며 `choose_gardener`·`choose_driver` 중 하나를 선택합니다. 직업 확정 시에만 +5(최대 100)를 적용하고 트럭 운전수만 차 키를 받습니다. 직업 선택과 거절 뒤에는 `job_result`에서 캐런의 축하·안내 대사를 표시하며, 마지막 대사까지 읽은 뒤 화면이 캐런을 페이드아웃하고 기존 `see_karen_off`를 자동 요청하면 `festival_invite`로 이동해 밥의 초대를 보여 줍니다. 자동 요청 실패 때만 ‘계속하기’로 같은 행동을 다시 요청합니다. 직업과 이미 받은 키는 `journal`에 기록하고, 현재 직업은 `view.job`으로 보냅니다. `job_result`는 고정 대사를 읽는 장면으로 자유 대화 상대가 없습니다.

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

축제의 `inspect_food` 응답은 음식 독백→머리카락 발견→추리 순서의 사건을 보냅니다. 화면은 음식 독백을 모두 읽은 뒤 고기 윤곽을 누르면 머리카락 사진으로 바로 넘어갑니다. 손이 들어오는 연출은 제거합니다. 사진 사이 이동은 같은 응답 안의 표현이며 새 API 요청이나 점수를 만들지 않습니다.

마지막 선택은 서버가 관리합니다. `hair_found`의 `begin_final_choice`를 머리카락 독백 여섯 문장을 모두 읽은 뒤 자동 요청하면 `final_choice`로 이동합니다. 이때만 `view.choice_deadline`에 서버가 정한 **10초 뒤 UTC Unix 밀리초**를 보냅니다(나머지 장면은 `null`). 화면은 주민 시선 사진 위에 어두운 배경의 중앙 선택창을 띄우고 `escape`(도망친다)·`stay`(남은 고기를 맛있게 먹는다)만 버튼으로 제공합니다. 시간 종료 시 `choice_timeout`을 요청합니다. 서버는 기한 전의 시간 종료 요청을 거절하고, 기한이 지난 `escape`·`stay`도 사망으로 처리합니다. 독백을 읽는 중에는 기한이 시작되지 않습니다. 요청 중 중복 클릭을 막고 실패 후에도 기한은 연장하지 않습니다.
