# 캐릭터 챗봇 프로젝트 베이스 코드

5기 중간 프로젝트를 시작하기 위한 **실행 가능한 예시**입니다. Flask 웹 화면과 채팅 API, 검색·답변 생성의 연결 지점을 제공합니다. 처음 실행하면 API 키 없이 데모 답변이 나옵니다. 캐릭터, 화면, 모델, 서버 구조, 배포 방법은 기획에 맞게 바꿀 수 있습니다.

> **데모의 한계:** 현재 답변은 입력을 되돌려주는 예시이며 AI 답변이나 RAG 결과가 아닙니다. 실제 프로젝트에서는 `services/retriever.py`와 `services/generator.py`를 구현하고 결과를 검증해야 합니다.

## 시작하기: 한 가지 방법을 선택하세요

### Conda

수업에서 사용한 Conda로 시작할 수 있습니다. 프로젝트 루트에서 실행하세요. 현재 Dockerfile과 같은 Python 3.12를 예시로 사용합니다.

```bash
conda create -n chatbot-base python=3.12 pip
conda activate chatbot-base
python -m pip install -r requirements.txt
python app.py
```

<http://localhost:5000>에서 화면과 데모 답변을 확인하세요. 가상환경을 만든 뒤 설치하는 패키지는 `requirements.txt`를 기준으로 합니다.

### Docker Compose

팀원 간 실행 환경과 명령을 맞추고 싶다면 Docker Desktop 또는 Docker Engine과 Compose를 설치한 뒤 실행하세요.

```bash
docker compose up --build
```

<http://localhost:5001>에서 확인합니다. Docker 사용 시 호스트에 Conda/venv를 따로 만들 필요는 없습니다. 의존성을 바꾸면 이미지를 다시 빌드하세요. 이 경로로 컨테이너 안에서 테스트하는 방법은 [로컬 실행 가이드](docs/LOCAL_SETUP.md)에 있습니다. Docker는 최종 기술 선택의 필수 조건이 아닙니다.

### Python venv

Conda나 Docker를 사용하지 않는 팀을 위한 선택지입니다.

```powershell
# Windows PowerShell 예시
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

브라우저에서 **캐릭터 소개 → 대화 시작 → 메시지 전송**을 확인하세요. `.env`는 데모 실행에 필수는 아닙니다. PowerShell에서 `py -3.12`가 없다면 설치된 Python 실행 명령을 사용하세요. 자세한 운영체제별 명령은 [로컬 실행 가이드](docs/LOCAL_SETUP.md)에 있습니다.

## 이 베이스의 범위

| 제공하는 것 | 팀이 구현하거나 바꿀 것 |
| --- | --- |
| 메인·소개·대화의 **예시 화면**과 기본 반응형 CSS | 팀의 콘셉트에 맞는 UX·디자인. 화면 전면 교체 가능 |
| 메시지 전송 JS, 입력 검증, JSON 응답을 가진 **예시 API** | 실제 AI 답변, 자료 검색, 오류·품질 개선. API 계약 변경 가능 |
| 검색 → 답변 생성 → 응답 조립의 **기본 코드 구조** | 모델·검색기 연결, 저장소, 필요한 기능과 모듈 추가 |
| 캐릭터 설정 파일, 가상 연습 자료, 출처 표시 자리 | 실제 캐릭터·자료의 준비와 검색 인덱스·모델 연결 |
| Conda/venv 실행 명령, 개발용 Compose, 배포용 Dockerfile | 팀의 의존성, 데이터 저장소, 배포 구성과 공개 URL 검증 |

현재 코드는 화면과 API가 연결된 데모입니다. AI 챗봇 기능은 아직 구현되어 있지 않습니다. 세 화면의 흐름, Flask, 단일 캐릭터, `/api/chat` 형식, 색상·레이아웃은 과제 제약이 아닙니다. React/Next.js 등 별도 프런트와 API 서버를 구성해도 됩니다. 그 경우 새 구조에 맞춰 실행·테스트·배포 문서를 갱신하세요.

## 어디를 바꾸나요?

| 원하는 작업 | 파일 |
| --- | --- |
| 캐릭터 이름·소개·첫 인사·대표 이미지 | `config/chatbot_config.json`, `public/assets/images/` |
| 자료 검색 | `services/retriever.py` |
| 모델 호출·답변 생성 | `services/generator.py` |
| 검색 결과와 답변을 API 형식으로 조립 | `services/chatbot_service.py` |
| API 요청 검증·화면 라우팅 | `app.py` |
| 화면 구성 | `templates/`, `public/assets/css/`, `public/assets/js/` |
| 챗봇이 참고할 원본 자료 | `data/knowledge/` |
| 배포 방법 | `docs/DEPLOYMENT.md` |

자료 파일을 `data/knowledge/`에 넣는 것만으로는 검색이 되지 않습니다. 자료를 나누고, 검색 인덱스를 만들고, 답변과 출처를 연결하는 코드는 팀이 구현해야 합니다. 수업에서 배운 ChromaDB는 좋은 출발점이지만 필수 저장소는 아닙니다.

## API 키와 환경 파일

데모에는 API 키가 필요하지 않습니다. 모델 API를 연결할 때는 실제 키를 로컬 `.env` 또는 배포 플랫폼의 환경 변수에 보관하세요. `.env.example`에는 변수 이름과 빈 예시 값만 적습니다. **README·다른 Markdown·코드·이슈·스크린샷에 실제 키를 적어 공유하지 마세요.** `.gitignore`는 `.env`와 `.env.*`를 제외합니다. 커밋 전 `git status --short`로 파일 목록을 확인하고, `git check-ignore .env`로 제외 여부를 확인하세요. 이미 키를 올렸다면 파일을 지우는 데서 끝내지 말고 해당 키를 폐기·재발급하세요. 자세한 내용은 [로컬 실행 가이드](docs/LOCAL_SETUP.md)를 보세요.

## 현재 데모 API

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
- **구현 선택:** ChromaDB·LangChain·OpenAI·Flask·Docker·Render 중 어느 하나도 최종 결과물의 필수 기술로 지정하지 않습니다. 프런트 화면 수, 프레임워크, 서버 분리 여부, API 형식도 팀의 제품에 맞게 정할 수 있습니다.
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
- [팀 협업과 Docker 활용](docs/TEAM_WORKFLOW.md)
- [AI 도구 사용과 검증](docs/AI_WORKFLOW.md)

배포 서비스의 조건은 바뀔 수 있으므로 실제 배포 전에 각 플랫폼의 공식 문서를 확인하세요.
