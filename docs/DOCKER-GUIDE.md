# Docker 개발 가이드

이 문서는 Docker로 데모를 실행한 뒤, 파일·패키지 변경을 어떻게 적용할지 안내합니다. 개인 개발에서는 익숙한 Conda나 venv를 사용해도 됩니다. 팀에서 같은 실행 환경을 확인하거나 배포용 이미지와 비슷한 환경을 시험할 때 Compose를 활용하세요.

## 1. 준비물

- Docker Desktop 또는 Docker Engine
- Docker Compose v2 (`docker compose version` 명령으로 확인)
- 저장소를 내려받은 로컬 폴더

처음 화면과 데모 응답을 확인하는 데는 API 키가 필요하지 않습니다. 실제 모델을 연결할 때 `.env`에 키를 보관하고, 컨테이너에 전달할 환경 변수는 [모델 연결 가이드](MODEL_SETUP.md)에 따라 별도로 설정하세요.

## 2. Docker 파일은 각각 어떤 역할을 하나요?

| 파일 | 역할 |
| --- | --- |
| `Dockerfile` | 배포용 이미지를 만듭니다. Python과 `requirements.txt`의 패키지를 설치하고 앱 실행 명령을 지정합니다. |
| `docker-compose.yml` | 로컬 개발 컨테이너, 포트, 환경 변수, 소스 폴더 연결을 정의합니다. |
| `.dockerignore` | 이미지를 만들 때 보내지 않아도 되는 문서·테스트·비밀 파일을 빌드 입력에서 제외합니다. |

Compose는 `app.py`, `services/`, `config/`, `templates/`, `public/`, `data/`의 개발용 파일을 컨테이너에 연결합니다. Python 서버는 개발 설정으로 실행되므로 저장한 코드 변경을 확인하기 쉽습니다. `tests/`도 개발 중에는 연결하지만 배포용 이미지에는 복사하지 않습니다.

## 3. 실행하고 화면 확인하기

프로젝트 루트에서 실행합니다.

```bash
docker compose up --build
```

첫 실행은 이미지와 패키지를 준비하느라 시간이 걸릴 수 있습니다. 터미널에 서버 실행 로그가 보이면 브라우저에서 다음 주소를 엽니다.

- 화면: <http://localhost:5001>
- 상태 확인: <http://localhost:5001/health>

메인 화면에서 캐릭터 소개와 대화로 이동하고 메시지를 보내 데모 답변이 표시되는지 확인하세요. 이 단계의 응답은 실제 AI 모델 호출이 아닙니다.

## 4. 개발 중 바뀐 내용 적용하기

| 바꾼 내용 | 할 일 |
| --- | --- |
| 연결된 Python·HTML·CSS·JavaScript 파일 수정 | 파일을 저장하고 브라우저에서 다시 확인합니다. Python 변경은 개발 서버가 재시작될 수 있습니다. |
| 연결된 폴더 안에 파일 추가 | 보통 바로 컨테이너에 보입니다. 새 정적 경로를 썼다면 브라우저 주소와 앱의 정적 파일 제공도 확인합니다. |
| Python 패키지 추가·버전 변경 | `requirements.txt`를 수정하고 `docker compose up --build`로 다시 빌드합니다. |
| Compose에 새 최상위 폴더 연결 | `docker-compose.yml`의 `volumes`에 경로를 추가하고 컨테이너를 다시 만듭니다. |
| 배포 이미지에 새 파일·폴더 포함 | 실행 중 앱에서 필요한 파일이면 `Dockerfile`에도 `COPY`를 추가합니다. |

예를 들어 새 `scripts/` 폴더를 개발 컨테이너에 연결하려면 다음 항목을 `docker-compose.yml`의 `volumes`에 추가합니다.

```yaml
- ./scripts:/app/scripts:ro
```

Compose 설정을 바꿨다면 실행 터미널에서 `Ctrl+C`로 종료한 다음 다음 명령으로 다시 시작합니다.

```bash
docker compose up --build
```

새 Python 패키지도 `requirements.txt`에 기록해야 다른 팀원과 배포 환경에서 같은 의존성을 설치할 수 있습니다. 패키지 변경을 확인하려면 이미지 재빌드가 필요합니다.

## 5. 기본 테스트 실행하기

이 저장소의 스모크 테스트는 화면·정적 파일·API 형식과 서비스 연결을 확인합니다.

```bash
docker compose exec chatbot python -m unittest discover -s tests -v
```

로컬 Conda나 venv에서는 다음을 실행하면 됩니다.

```bash
python -m unittest discover -s tests -v
```

팀 기능을 추가하면 핵심 정상 사례와 실패 사례를 테스트에 보태세요. 테스트는 Git 저장소에 포함하지만, 프로덕션 Docker 이미지에는 보통 포함하지 않습니다.

## 6. 자주 쓰는 명령

```bash
docker compose ps                         # 컨테이너 상태
docker compose logs -f chatbot            # 서버 로그를 계속 보기
docker compose exec chatbot python --version
docker compose exec chatbot python -m unittest discover -s tests -v
```

현재 실행 중인 터미널에서 `Ctrl+C`를 누르면 컨테이너를 멈춥니다. Compose가 만든 컨테이너와 네트워크를 정리할 때는 다음을 사용합니다.

```bash
docker compose down
```

## 7. 문제가 생겼을 때

| 증상 | 확인할 내용 |
| --- | --- |
| Docker 명령이 데몬 연결 오류를 냄 | Docker Desktop/Engine이 실행 중인지 확인하고 `docker compose version`을 다시 실행합니다. |
| `localhost:5001`에 접속할 수 없음 | `docker compose ps`와 `docker compose logs -f chatbot`를 확인합니다. 다른 프로그램이 5001을 쓰고 있다면 Compose의 호스트 포트를 바꿉니다. |
| 새 패키지를 찾지 못함 | `requirements.txt`에 패키지가 있는지 확인하고 `docker compose up --build`로 다시 빌드합니다. |
| 새 폴더나 파일을 못 찾음 | 폴더가 `docker-compose.yml`의 마운트 경로 안에 있는지 확인합니다. 배포 시에도 쓸 파일이면 `Dockerfile`의 `COPY`도 확인합니다. |
| 모델 호출에 실패함 | 필요한 환경 변수가 Compose에 전달되는지 확인합니다. 로그·스크린샷에 API 키 값을 포함하지 마세요. |

## Conda와 같이 써도 되나요?

Conda/venv는 Python 가상환경을 관리하고 Docker는 앱이 실행될 OS 환경과 의존성을 묶습니다. 개인 작업은 Conda에서 하고 팀 통합 때 Compose로 실행해 보는 식으로 둘을 함께 활용할 수 있습니다. 같은 실행을 Conda와 Docker 안에서 동시에 중첩할 필요는 없습니다. 배포 구조를 선택할 때는 [배포 경로 안내](DEPLOYMENT.md)와 [Render 가이드](RENDER-GUIDE.md)를 확인하세요.
