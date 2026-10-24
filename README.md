# 캐릭터 챗봇 프로젝트 베이스 코드

5기 중간 프로젝트를 시작하기 위한 **실행 가능한 예시**입니다. Flask와 기본 웹 화면, 채팅 API의 연결을 제공합니다. 처음 실행하면 API 키 없이 데모 답변이 나옵니다. 팀의 캐릭터, 자료 활용 방식, 모델, 프런트엔드, 배포 플랫폼은 기획에 맞게 바꾸세요.

> **데모의 한계:** 현재 답변은 입력을 되돌려주는 예시이며 AI 답변이나 RAG 결과가 아닙니다. 실제 프로젝트에서는 `services/chatbot_service.py`를 구현하고 결과를 검증해야 합니다.

## 5분 시작

Python 3.12를 권장합니다. 프로젝트 루트에서 실행하세요.

```powershell
# Windows PowerShell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python app.py
```

```bash
# macOS / Linux
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python app.py
```

브라우저에서 <http://localhost:5000>에 접속해 **캐릭터 소개 → 대화 시작 → 메시지 전송**을 확인하세요. `.env`는 데모 실행에 필수는 아닙니다. PowerShell에서 `py -3.12`가 없다면 설치한 Python 3.12 실행 명령을 사용하세요.

Docker를 선호한다면 `docker compose up --build`를 실행하고 <http://localhost:5001>에 접속하세요. 구형 Compose만 설치된 환경은 `docker-compose up --build`를 사용합니다. Docker는 **선택**입니다.

## 어디를 바꾸나요?

| 원하는 작업 | 파일 |
| --- | --- |
| 캐릭터 이름·소개·첫 인사·대표 이미지 | `config/chatbot_config.json`, `public/assets/images/` |
| 검색·모델 호출·답변 생성 | `services/chatbot_service.py` |
| API 요청 검증·화면 라우팅 | `app.py` |
| 화면 구성 | `templates/`, `public/assets/css/`, `public/assets/js/` |
| 챗봇이 참고할 원본 자료 | `data/knowledge/` |
| 배포 방법 | `docs/DEPLOYMENT.md` |

자료 파일을 `data/knowledge/`에 넣는 것만으로는 검색이 되지 않습니다. 자료를 나누고, 검색 인덱스를 만들고, 답변과 출처를 연결하는 코드는 팀이 구현해야 합니다. 수업에서 배운 ChromaDB는 좋은 출발점이지만 필수 저장소는 아닙니다.

## 기본 API

`POST /api/chat`에 JSON을 보냅니다.

```json
{"message":"안녕!","username":"민지"}
```

성공 응답:

```json
{"reply":"민지님, ...","image":null,"sources":[]}
```

`reply`는 필수 문자열, `image`는 이미지 URL 또는 `null`, `sources`는 답변에 사용한 자료 이름의 문자열 목록입니다. 입력 오류는 `400` 또는 `413`과 `{"error":{"code":"...","message":"..."}}` 형식으로 응답합니다. 서버 오류는 `500`입니다. `GET /health`는 프로세스가 응답하는지 확인하며 검색 품질이나 외부 서비스 상태를 보증하지 않습니다.

## 프로젝트 기준과 자유도

- **결과 기준:** 팀의 캐릭터와 대화할 수 있는 서비스, 설명 가능한 기술 선택, 실제 사용 시나리오의 검증, 공개 접속 URL을 준비합니다.
- **자료 활용:** 캐릭터의 세계관·기록·FAQ처럼 외부 지식이 있는 기획은 검색한 자료를 답변에 반영하고 출처를 보여주는 구성을 권장합니다. RAG가 기획에 불필요하다면 이유, 대신 구현할 기술 요소, 검증 방법을 프로젝트 문서에 적으세요.
- **구현 선택:** ChromaDB·LangChain·OpenAI·Flask·Docker·Render 중 어느 하나도 최종 결과물의 필수 기술로 지정하지 않습니다. 이 저장소는 Flask로 시작하지만 팀은 동일한 기능을 다른 구조로 구현할 수 있습니다.
- **선택 확장:** 질문에 맞는 **이미지 검색**과 이전 대화를 저장·반영하는 **대화 메모리**는 필요할 때 추가합니다. 현재 대표 이미지 표시와 화면 내 메시지 나열은 그 기능을 구현한 것이 아닙니다.

과제 범위의 자세한 판단 기준은 [프로젝트 가이드](docs/PROJECT_GUIDE.md)에, 현재 코드와 확장 지점은 [구조 설명](docs/ARCHITECTURE.md)에 있습니다.

## 배포 경로

이 베이스 코드는 한 Flask 앱이 화면과 API를 함께 제공하도록 구성했습니다. Render의 웹 서비스나 Vercel의 Flask Function으로 검토할 수 있습니다. 프런트와 API를 분리하거나 Cloudflare Workers를 쓰려면 정적 파일 위치, API 주소, Python 패키지 호환성, 지속 저장소를 다시 설계해야 합니다. **특정 플랫폼을 강요하지 않습니다.** [배포 가이드](docs/DEPLOYMENT.md)의 선택표와 점검 목록을 먼저 보세요.

## 검증

```bash
python -m unittest discover -s tests -v
```

이 테스트는 데모 화면·정적 파일·API 계약을 확인합니다. 팀이 구현한 검색 품질과 모델 답변의 정확도는 별도로 평가해야 합니다.

## 문서

- [프로젝트 목표와 결과 기준](docs/PROJECT_GUIDE.md)
- [코드 구조와 확장 지점](docs/ARCHITECTURE.md)
- [로컬 실행·문제 해결](docs/LOCAL_SETUP.md)
- [배포 구성 선택](docs/DEPLOYMENT.md)
- [RAG·평가·메모리 확장](docs/ADVANCED_TOPICS.md)
- [AI 도구 사용과 검증](docs/AI_WORKFLOW.md)

이 코드는 [3기](https://github.com/HateSlop/3-character-chat)와 [4기](https://github.com/HateSlop/4-chatbot)의 공통 Flask 흐름을 검토하고, 5기용으로 다시 구성한 초안입니다. 과거 저장소의 문서와 구현을 현재 기준으로 그대로 따르지 마세요. 배포 서비스의 조건은 변경될 수 있으므로 실제 배포 전에 공식 문서를 다시 확인하세요.
