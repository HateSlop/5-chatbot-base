# 로컬 실행

## 실행 방법 선택

Conda, Python venv, Docker Compose 중 **하나만 선택**하면 됩니다. 기본 데모에는 모델 API 키와 ChromaDB가 필요하지 않습니다. Dockerfile은 Python 3.12를 사용하므로, 로컬에서도 같은 버전을 쓰면 환경 차이를 줄일 수 있습니다. 팀이 다른 Python 버전을 택한다면 사용한 패키지의 호환성을 확인하고 Dockerfile·문서를 함께 고치세요.

| 방법 | 적합한 경우 | 필요한 것 |
| --- | --- | --- |
| Conda | 수업에서 익숙한 방식으로 빠르게 개발할 때 | Conda 설치 |
| Python venv | 표준 Python만으로 개발할 때 | 호환되는 Python 설치 |
| Docker Compose | 팀원별 OS·패키지 차이를 줄이고 동일한 명령으로 실행·테스트할 때 | Docker Engine/Desktop와 Compose |

## Conda

프로젝트 루트에서 실행합니다. 운영체제에 관계없이 Conda가 초기화된 터미널에서 같은 명령을 사용합니다.

```bash
conda create -n chatbot-base python=3.12 pip
conda activate chatbot-base
python -m pip install -r requirements.txt
python app.py
```

이미 같은 이름의 환경이 있다면 새 이름을 선택하세요. 개발을 마치고 환경을 종료할 때는 `conda deactivate`를 실행합니다. 팀이 새 라이브러리를 추가하면 `requirements.txt`를 갱신해 다른 팀원도 설치할 수 있게 하세요. [Conda 환경 관리](https://docs.conda.io/projects/conda/en/stable/user-guide/tasks/manage-environments.html)

## Python venv

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

Conda와 venv는 모두 <http://localhost:5000>을 엽니다. 이름을 입력해 대화해 보세요. 정지하려면 터미널에서 `Ctrl+C`를 누릅니다. `.env`는 데모에는 없어도 됩니다. 모델 API를 붙일 때에는 `.env.example`의 필요한 변수만 `.env`에 추가하세요. 키 값은 README나 스크린샷에 넣지 마세요.

## Docker Compose로 실행

```bash
docker compose up --build
```

접속 주소는 <http://localhost:5001>입니다. Compose 파일은 개발 편의를 위해 코드와 테스트를 읽기 전용으로 컨테이너에 연결하고 Flask 개발 서버를 실행합니다. 화면·Python 코드 변경은 개발 서버의 재시작/새로고침으로 확인하고, **의존성이나 Dockerfile이 바뀌면 다시 빌드**하세요. 실제 컨테이너 배포에는 `Dockerfile`의 Gunicorn 실행 명령을 사용합니다. 설치된 CLI가 옛 버전이라면 `docker-compose up --build`를 사용하세요.

```bash
docker compose ps
docker compose logs -f chatbot
docker compose exec chatbot python -m unittest discover -s tests -v
docker compose down
```

`ps`로 실행 상태를, `logs`로 오류를, `exec`으로 **팀원이 같은 컨테이너 환경에서 테스트한 결과**를 확인할 수 있습니다. `down`은 컨테이너를 정리합니다. 로컬 Conda/venv와 Docker를 동시에 실행하면 동일한 기능을 두 번 띄우게 되므로, 비교 목적이 아니라면 한 방법을 골라 쓰세요. [Docker Compose 빠른 시작](https://docs.docker.com/compose/gettingstarted/)

Docker 실행 시 `.env`에 넣은 값은 Compose가 **변수 치환용으로 읽더라도 자동으로 컨테이너에 모두 전달하지 않습니다.** 팀이 API 키를 연결한다면 해당 키를 Compose의 `environment`/`env_file`이나 배포 플랫폼의 비밀 변수 설정에 명시해야 합니다. `.env` 자체를 Git에 올리지 마세요. [Docker Compose 환경 변수](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation)

## API 직접 확인

아래 명령은 Conda/venv의 기본 포트 `5000`을 사용합니다. Docker Compose로 실행했다면 URL의 포트를 `5001`로 바꾸세요.

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
| Python 3.12 명령을 찾지 못함 | Conda를 쓰거나 설치된 Python 버전을 확인해 호환 가능한 실행 파일로 환경을 만드세요. |
| `conda activate`가 동작하지 않음 | Conda가 현재 셸에 초기화되었는지 확인하고 새 터미널을 여세요. |
| Docker 연결 오류 | Docker Engine/Desktop이 실행 중인지 확인하세요. CLI 설치만으로는 컨테이너가 실행되지 않습니다. |
| PowerShell에서 활성화가 막힘 | 터미널의 실행 정책을 확인하거나 `.venv\Scripts\python.exe app.py`처럼 가상환경 Python을 직접 실행하세요. |
| 5000 또는 5001 포트 충돌 | 기존 프로세스를 끄거나 `PORT`/Compose 포트 매핑을 변경하세요. |
| 화면은 열리는데 답변이 데모 문구임 | 정상입니다. `ChatbotService`의 검색·모델 연결을 아직 구현하지 않았습니다. |
| 이미지·JS가 404 | `public/assets/`와 `config/chatbot_config.json`의 경로, 브라우저 개발자 도구의 Network 탭을 확인하세요. |
| 모델 연결 뒤 오류 | 서버 로그와 환경 변수 **이름**을 확인하세요. 로그나 질문 글에 실제 API 키를 붙이지 마세요. |

Flask 개발 서버는 로컬 작업용입니다. 운영 배포에서는 플랫폼의 실행 방식이나 WSGI 서버를 사용하세요. [Flask 공식 안내](https://flask.palletsprojects.com/en/stable/server/)
