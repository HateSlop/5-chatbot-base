# 로컬 실행

## 준비

Python 3.12를 권장합니다. Git과 코드 편집기가 있으면 충분합니다. 기본 데모에는 모델 API 키, ChromaDB, Docker가 필요하지 않습니다.

Windows PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python app.py
```

macOS / Linux:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env
python app.py
```

<http://localhost:5000>을 열고 이름을 입력해 대화해 보세요. 정지하려면 터미널에서 `Ctrl+C`를 누릅니다. `.env`는 데모에는 없어도 됩니다. 모델 API를 붙일 때에는 `.env.example`의 필요한 변수만 `.env`에 추가하세요. 키 값은 README나 스크린샷에 넣지 마세요.

## Docker로 실행

```bash
docker compose up --build
```

접속 주소는 <http://localhost:5001>입니다. Compose 파일은 개발 편의를 위해 코드를 읽기 전용으로 컨테이너에 연결하고 Flask 개발 서버를 실행합니다. 실제 배포에는 `Dockerfile`의 Gunicorn 실행 명령을 사용합니다. 설치된 CLI가 옛 버전이라면 `docker-compose up --build`를 사용하세요.

Docker 실행 시 `.env`에 넣은 값은 Compose가 **변수 치환용으로 읽더라도 자동으로 컨테이너에 모두 전달하지 않습니다.** 팀이 API 키를 연결한다면 해당 키를 Compose의 `environment`/`env_file`이나 배포 플랫폼의 비밀 변수 설정에 명시해야 합니다. `.env` 자체를 Git에 올리지 마세요.

## API 직접 확인

PowerShell:

```powershell
Invoke-RestMethod -Uri http://localhost:5000/health
$body = @{ message = '안녕'; username = '민지' } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:5000/api/chat -Method Post -ContentType 'application/json' -Body $body
```

macOS / Linux:

```bash
curl http://localhost:5000/health
curl -X POST http://localhost:5000/api/chat -H 'Content-Type: application/json' -d '{"message":"안녕","username":"민지"}'
```

테스트:

```bash
python -m unittest discover -s tests -v
```

## 자주 생기는 문제

| 증상 | 확인할 것 |
| --- | --- |
| Python 3.12 명령을 찾지 못함 | 설치된 Python 버전을 확인하고 해당 실행 파일로 가상환경을 만드세요. |
| PowerShell에서 활성화가 막힘 | 터미널의 실행 정책을 확인하거나 `.venv\Scripts\python.exe app.py`처럼 가상환경 Python을 직접 실행하세요. |
| 5000 또는 5001 포트 충돌 | 기존 프로세스를 끄거나 `PORT`/Compose 포트 매핑을 변경하세요. |
| 화면은 열리는데 답변이 데모 문구임 | 정상입니다. `ChatbotService`의 검색·모델 연결을 아직 구현하지 않았습니다. |
| 이미지·JS가 404 | `public/assets/`와 `config/chatbot_config.json`의 경로, 브라우저 개발자 도구의 Network 탭을 확인하세요. |
| 모델 연결 뒤 오류 | 서버 로그와 환경 변수 **이름**을 확인하세요. 로그나 질문 글에 실제 API 키를 붙이지 마세요. |

Flask 개발 서버는 로컬 작업용입니다. 운영 배포에서는 플랫폼의 실행 방식이나 WSGI 서버를 사용하세요. [Flask 공식 안내](https://flask.palletsprojects.com/en/stable/server/)
