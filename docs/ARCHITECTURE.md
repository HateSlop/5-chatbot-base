# 코드 구조와 확장 지점

이 저장소는 **한 Flask 앱이 화면과 API를 함께 제공하는 기본 구조**입니다. 모델 호출·자료 검색·이미지 선택은 각각 파일을 두고 `chatbot_service.py`가 실행 순서를 연결합니다. 파일을 늘리거나 프런트와 서버를 분리해도 됩니다. 구조를 바꾼 뒤에는 실행 방법과 API 설명을 함께 고치세요.

## 현재 디렉터리

```text
app.py                         화면 라우트, 채팅 API, 입력·응답 검증
config/chatbot_config.json     캐릭터 이름·소개·첫 인사·성격·말투·세계관
services/
  retriever.py                 질문에 맞는 자료 검색 경계
  generator.py                 캐릭터 답변 생성 경계
  image_selector.py            생성된 답변에 맞는 이미지 선택 경계
  chatbot_service.py           검색 → 생성 → 이미지 선택 → API 응답 조립
templates/                     Flask/Jinja 예시 화면
public/assets/                 CSS·브라우저 JS·예시 이미지
data/knowledge/                검색 자료의 원본 예시
data/images/                   이미지 메타데이터·인덱스 준비 위치
tests/                         화면·API·서비스 연결 확인
Dockerfile                     배포용 Gunicorn 이미지
docker-compose.yml             로컬 개발용 컨테이너 실행
```

현재 `DemoRetriever.search()`는 빈 목록을 반환하고 `DemoGenerator.generate()`는 고정된 데모 문장을 만듭니다. `DemoImageSelector.select()`는 `None`을 반환합니다. `data/knowledge/`의 파일은 자동으로 읽거나 인덱싱하지 않습니다. 메모리·로그인·이미지 검색·영속 저장소도 구현되어 있지 않습니다.

## 요청이 흐르는 순서

```text
브라우저 → GET /, /detail, /chat → app.py → config + templates + public

브라우저 → POST /api/chat
            → app.py: JSON 입력 검증, config 로드
            → ChatbotService.generate_response()
              → retriever.search(question) → KnowledgeHit 목록
              → generator.generate(question, username, character, knowledge) → 답변 문자열
              → image_selector.select(reply, character) → 이미지 URL 또는 None
              → {reply, image, sources}
            → app.py: 응답 형식 검증 → 브라우저
```

`app.py`는 HTTP 요청과 오류를 맡고, `services/`는 답변 흐름을 맡습니다. 캐릭터 설정은 화면과 생성기에 같은 JSON으로 전달됩니다. 현재 생성기는 설정을 사용하지 않으므로, 실제 모델을 붙일 때 `persona`의 성격·말투·세계관을 프롬프트에 반영해야 합니다. `GET /health`는 앱 프로세스 응답만 확인합니다.

## 처음 구현할 때의 순서

1. `config/chatbot_config.json`의 `persona`를 채우고 화면에 보이는 이름·소개를 바꿉니다.
2. `services/generator.py`의 `generate()`에 모델을 연결합니다. 인자는 `question`(입력), `username`, `character`(설정 JSON), `knowledge`(검색 결과)입니다. 반환값은 **답변 문자열**입니다. 첫 단계에서는 빈 `knowledge`로 동작해도 됩니다. 설치부터 코드 교체까지는 [OpenAI 연결 예시](MODEL_SETUP.md)를 보세요.
3. 검색할 세계관 자료가 있을 때 `services/retriever.py`의 `search()`를 구현합니다. 반환값은 `KnowledgeHit(title, content)` 목록입니다. 원본 파일을 저장하는 것과 인덱스를 만드는 작업은 다릅니다.
4. `public/assets/images/`에 공개 이미지 파일을 두고 `data/images/`에 이미지 설명·출처를 정리합니다. 먼저 상황별 규칙으로 보여줄 이미지와 생략할 상황을 시험하고, 이후 `services/image_selector.py`에서 답변 문장과 이미지 임베딩의 유사도를 비교하도록 확장합니다. 임베딩 모델이 벡터를 만들고, ChromaDB 같은 벡터 저장소는 그 벡터를 보관하고 가까운 이미지를 찾습니다. 반환값은 브라우저에서 열리는 이미지 URL 또는 `None`입니다.
5. `services/chatbot_service.py`는 세 기능의 호출 순서와 JSON 조립을 맡습니다. 이미지 메타데이터나 API 응답 형식을 바꿀 때 이 파일과 `app.py`, 브라우저 JS를 함께 확인합니다.

각 파일에 실제 구현을 넣으면 기존 화면에서 `POST /api/chat`을 통해 확인할 수 있습니다. 프런트를 별도로 만들 때는 API 주소와 응답 형식을 맞추세요.

## 각 모듈에서 구현할 내용

| 위치 | 지금 있는 것 | 확장 예시 |
| --- | --- | --- |
| `services/retriever.py` | `KnowledgeHit(title, content)`, 빈 검색 결과 | 원본 자료 정제·분할, ChromaDB 인덱스 조회, 키워드 검색, 검색 실패 처리 |
| `services/generator.py` | 질문을 되돌려주는 데모 문장 | 캐릭터 설정·검색 결과를 넣은 프롬프트, 모델 API 호출, 시간 초과와 실패 처리 |
| `services/image_selector.py` | 항상 `None`인 이미지 선택 | 답변·이미지 임베딩 비교, 이미지 메타데이터 조회, 공개 URL 반환 |
| `services/chatbot_service.py` | 검색·생성·이미지 선택 호출과 `sources` 조립 | 검색 결과 점검, 응답 후처리, 메모리 결합 |
| `app.py` | 라우트·입력 검증·오류 응답 | 인증, 요청 제한, 새 API, 프런트 분리 시 CORS·API 주소 설정 |
| `data/knowledge/` | 연습용 원본 문서 | 사용 권한을 확인한 실제 자료. 인덱스 저장 위치는 별도로 결정 |
| `templates/`, `public/` | 세 가지 예시 화면과 채팅 JS | 화면 추가·교체 또는 독립 프런트엔드. 대화용 이미지는 `public/assets/images/`에 둘 수 있음 |

새 기능은 관련 폴더에 파일을 더해 연결하면 됩니다. 예를 들어 인덱스를 만드는 배치 작업은 `scripts/`, 대화 저장 코드는 `services/memory.py`, 외부 API 설정은 `config/`에 둘 수 있습니다. 이는 확장 예시이며 해당 폴더와 기능은 아직 제공하지 않습니다.

## 검색과 답변의 계약

검색기는 질문을 받아 `KnowledgeHit` 목록을 반환합니다. `title`은 자료를 구분하는 이름, `content`는 생성기에 줄 실제 내용입니다. 검색 결과가 없다면 빈 목록을 반환합니다. 생성기는 질문·사용자 이름·캐릭터 설정·검색 결과를 받아 **문자열 답변**을 반환합니다. 현재 서비스는 검색 결과의 제목을 모두 `sources`에 넣습니다. 개발 중 어떤 자료가 검색됐는지 확인하는 데 쓸 수 있지만, 실제 답변에 사용됐다는 뜻은 아닙니다.

API의 현재 성공 형식은 다음과 같습니다.

```json
{"reply":"사용자에게 보여줄 답변","image":null,"sources":[]}
```

`reply`는 문자열, `image`는 브라우저에서 접근할 수 있는 URL 또는 `null`, `sources`는 개발 중 검색된 자료 제목을 확인하기 위한 목록입니다. 채팅 화면에는 답변과 이미지만 표시합니다. 입력 오류는 `400`/`413`, 서비스 오류는 `500`으로 반환합니다. 브라우저 JS는 `/api/chat`을 같은 도메인의 상대 경로로 호출합니다. 프런트와 API를 분리할 때는 주소와 교차 출처 요청 정책을 맞추세요. 요청·응답 형식을 바꾼다면 프런트와 서버를 함께 수정하면 됩니다. 프로필의 `thumbnail`과 답변에 첨부하는 `image`는 별개입니다.

## RAG를 붙이는 경우

1. 원본 문서의 출처와 사용 권한을 확인하고, 필요한 단위로 나눕니다.
2. 인덱스 생성 작업을 대화 요청과 분리합니다. 배포 후 인덱스를 어디에 둘지 먼저 정합니다.
3. `retriever.search()`에서 관련 조각을 찾아 내용과 출처를 반환합니다.
4. `generator.generate()`에서 캐릭터 설정·질문·검색 결과를 사용해 답변을 만듭니다.
5. 자료가 없는 질문, 틀린 자료가 검색된 질문, 모델 API가 실패한 경우를 시험합니다.

수업에서 다룬 ChromaDB는 이 경계에 붙일 수 있는 선택지입니다. Render·Vercel 같은 환경의 로컬 파일을 **지속 저장소로 가정하지 마세요.** 인덱스를 빌드 시점에 읽기 전용으로 포함할지, 외부 저장소를 쓸지, 다른 검색 방식을 쓸지 팀의 자료 갱신 요구에 따라 결정하세요. RAG가 필요 없다면 `DemoRetriever`를 그대로 두거나 검색 단계를 제거하고, 대신 답변 생성·상태 관리 등 필요한 부분을 구현하면 됩니다.

## 검증

`python -m unittest discover -s tests -v`는 화면·정적 파일·API 오류와 서비스의 검색기→생성기 연결을 확인합니다. 답변별 이미지 선택 품질, 실제 자료 검색 품질, 모델 답변의 캐릭터 일관성, 배포 환경의 저장 동작은 구현한 팀이 별도로 확인해야 합니다.
