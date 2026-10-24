# 배포 가이드

현재 저장소는 `app.py`의 Flask 앱 하나가 화면과 `/api/chat`을 함께 제공합니다. 아래 **Render** 또는 **Vercel** 절차는 이 구조를 기준으로 합니다. 어느 플랫폼을 쓰든 최종 확인 기준은 실제로 접속할 수 있는 공개 URL입니다. 서비스의 요금제·화면·제한은 바뀔 수 있으므로 배포 화면의 안내도 확인하세요.

## 시작 전 확인

1. 프로젝트 루트에서 `python -m unittest discover -s tests -v`를 실행합니다. Conda·venv·Docker 중 로컬 실행 방법은 [로컬 실행 가이드](LOCAL_SETUP.md)를 참고하세요.
2. `app.py`, `requirements.txt`, `config/`, `services/`, `templates/`, `public/`, `.python-version`이 저장소 루트에 있는지 확인합니다. `.python-version`은 Python 3.12를 지정합니다.
3. `git status --short`로 올릴 파일을 확인합니다. `.env`와 `.env.local` 등 실제 비밀 파일은 커밋하지 않습니다. `git check-ignore .env`는 `.env`를 출력해야 합니다. `.env.example`에는 변수 이름과 빈 예시 값만 둡니다.
4. 현재 데모는 API 키가 필요 없습니다. 실제 모델을 붙였다면 필요한 환경 변수 **이름**을 README에 적고, 값은 배포 플랫폼의 환경 변수 설정에만 입력합니다. Markdown, 코드, 프런트 JavaScript, 이슈, 화면 캡처에 실제 키를 적지 않습니다.
5. 배포할 Git 저장소에 변경 사항을 반영합니다. 이 가이드의 화면 경로는 배포 서비스가 Git 저장소를 연결하는 방식을 기준으로 합니다.

키를 잘못 커밋했다면 공개 파일에서 삭제하는 것만으로 해결되지 않습니다. 해당 서비스에서 키를 폐기·재발급하고 Git 기록과 공유 범위를 점검하세요. [GitHub 비밀 값 검사 안내](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)

## Render: 현재 Flask 앱 그대로 배포

Python 웹 서비스로 실행하는 경로입니다. 이 저장소의 `requirements.txt`에 Gunicorn이 들어 있고, `app.py`에 Flask `app` 객체가 있습니다. [Render Flask 배포 공식 절차](https://render.com/docs/deploy-flask), [Python 버전 지정](https://render.com/docs/python-version)

1. [Render 대시보드](https://dashboard.render.com/)에서 **New → Web Service**를 선택합니다.
2. Git 제공자를 연결하고 배포할 저장소와 브랜치를 선택합니다. 코드가 저장소 루트에 있다면 **Root Directory**는 비워 둡니다. 하위 폴더에 넣었다면 해당 폴더를 지정하고 아래 명령의 경로도 그 폴더 기준으로 확인합니다.
3. 서비스 이름과 지역, 사용할 요금제를 선택하고 **Language/Runtime = Python 3**으로 설정합니다. 이 저장소의 `.python-version`이 Python 3.12를 요청합니다.
4. **Build Command**에 `pip install -r requirements.txt`, **Start Command**에 `gunicorn --bind 0.0.0.0:$PORT app:app`를 입력합니다. `python app.py`는 로컬 개발용이며 공개 서비스 시작 명령으로 사용하지 않습니다.
5. 실제 모델 API를 연결했다면 **Environment**에서 필요한 키와 값을 추가합니다. `.env` 파일을 저장소에 올리거나 값을 README에 적지 않습니다. 데모 상태라면 API 키는 추가하지 않습니다. `FLASK_DEBUG=1`은 공개 서비스에서 설정하지 않습니다. [Render 환경 변수 설정](https://render.com/docs/configure-environment-variables)
6. **Create Web Service**를 누르고 빌드·시작 로그가 성공하는지 확인합니다. 배포 후 서비스의 `https://…onrender.com` 주소를 엽니다.
7. `공개주소/health`, `공개주소/`, `공개주소/chat`을 확인하고 채팅 화면에서 메시지를 보냅니다. 현재 코드를 그대로 배포했다면 **데모 답변**이 정상입니다. AI 기능을 구현했다면 실제 답변과 실패 처리도 확인합니다.

배포 뒤 환경 변수를 추가하거나 변경했다면 서비스의 재배포가 필요한지 대시보드에서 확인하세요. Render 무료 웹 서비스는 유휴 상태에서 멈출 수 있고 파일시스템은 영속 저장소가 아닙니다. 서비스가 다시 시작해도 필요한 데이터가 남는지 따로 확인하세요. [Render 무료 서비스 제한](https://render.com/docs/free)

### Render에서 Dockerfile을 쓰는 경우

Python 런타임 대신 **Docker**를 선택하면 루트 `Dockerfile`을 사용할 수 있습니다. 로컬에서 `docker compose up`으로 개발할 때 쓰는 `docker-compose.yml`은 Render에 그대로 전달되는 배포 설정이 아닙니다. Web Service 생성 시 Docker 런타임과 루트 Dockerfile을 선택하고, 키는 Render의 Environment에 입력하세요. 이 Dockerfile은 Gunicorn으로 앱을 시작하고 `/health`를 검사합니다. 먼저 로컬에서 `docker build -t chatbot-base .`와 `docker run --rm -p 5000:5000 chatbot-base`로 이미지를 확인한 뒤 공개 URL에서 다시 검증하세요. [Render Docker 배포](https://render.com/docs/docker)

## Vercel: Flask Function으로 배포

Vercel은 루트 `app.py`의 Flask `app` 객체를 찾아 Function으로 실행합니다. `requirements.txt`와 `.python-version`도 읽습니다. `public/`의 정적 파일은 배포 시 CDN으로 제공됩니다. 로컬 Flask가 같은 파일을 제공하도록 둔 설정과 배포 동작은 다를 수 있으므로 CSS·JS·이미지를 공개 URL에서 각각 확인하세요. [Vercel Flask 공식 가이드](https://vercel.com/docs/frameworks/backend/flask), [Python 런타임](https://vercel.com/docs/functions/runtimes/python)

1. [Vercel 대시보드](https://vercel.com/dashboard)에서 **Add New → Project**를 선택하고 Git 저장소를 가져옵니다.
2. **Root Directory**를 이 저장소의 루트로 설정합니다. 하위 폴더로 옮겼다면 실제 `app.py`가 있는 폴더를 지정합니다. Flask가 자동 감지되는지 확인하고, 특별한 이유가 없다면 빌드 명령과 출력 폴더를 임의로 덮어쓰지 않습니다.
3. 모델 API를 연결했다면 **Environment Variables**에 필요한 변수 이름과 값을 입력하고 적용할 환경을 선택합니다. 데모에는 키가 필요 없습니다. `.env` 파일을 Git에 추가하지 않습니다. [Vercel 환경 변수 관리](https://vercel.com/docs/environment-variables/managing-environment-variables)
4. **Deploy**를 누르고 빌드 로그에서 의존성 설치·Function 생성의 오류가 없는지 확인합니다. 배포가 끝나면 표시된 `https://….vercel.app` 주소를 엽니다.
5. `공개주소/`, `공개주소/chat`, `공개주소/health`, `공개주소/assets/css/style.css`, `공개주소/assets/js/chatbot.js`, `공개주소/assets/images/avatar.svg`가 열리는지 확인합니다. 채팅창에서 메시지를 보내고 브라우저 개발자 도구의 Network에서 `POST /api/chat` 응답도 확인합니다.
6. 환경 변수를 나중에 변경했다면 새 배포에 반영되도록 다시 배포하고, Function 로그에서 오류를 확인합니다.

Vercel Function에는 실행 시간·패키지 크기·파일시스템 제한이 있습니다. 모델 호출이 오래 걸리거나 큰 로컬 인덱스를 쓰는 설계라면 배포 전에 [Flask 제한](https://vercel.com/docs/frameworks/backend/flask#limitations)을 확인하세요. 요청 중에 Chroma 인덱스나 사용자 대화 기록을 로컬 파일에 쓰는 구조는 영속 저장을 보장하지 않습니다.

## Cloudflare 또는 프런트·API 분리

Cloudflare는 선택할 수 있지만 **이 저장소를 위 절차처럼 그대로 올리는 경로는 아닙니다.** Python Worker에서 Flask를 실행하려면 Worker 진입점·설정·정적 자산 배치를 추가하고 의존성 호환성을 확인해야 합니다. Cloudflare의 [Flask Worker 가이드](https://developers.cloudflare.com/workers/framework-guides/apis/flask/)와 [Python 패키지 안내](https://developers.cloudflare.com/workers/languages/python/packages/)를 출발점으로 삼으세요. Cloudflare에서 정적 프런트를 운영하고 Flask API는 다른 플랫폼에 배포하는 구성도 가능합니다.

React/Next.js 등 별도 프런트로 바꾼다면 프런트 호스팅과 API 호스팅을 각각 정하고, 브라우저의 `/api/chat` 상대 경로를 실제 API 주소 또는 프록시 설정으로 바꾸세요. 서버가 허용할 출처, 환경별 API 주소, 쿠키·인증 방식, 두 서비스의 배포 순서를 함께 확인해야 합니다. **API 키를 프런트의 공개 환경 변수나 JS 번들에 넣지 마세요.**

## 자료와 대화 기록의 저장 위치

`data/knowledge/`에는 원본 예시만 있습니다. 실제 RAG를 구현했다면 인덱스를 언제 만들고 어디에서 읽을지 배포 전에 결정하세요. 빌드 시 포함한 읽기 전용 자료는 코드 배포와 함께 갱신할 수 있지만, 요청 중에 생성·수정하는 Chroma 인덱스나 사용자 데이터는 외부의 지속 저장소가 필요할 수 있습니다. 컨테이너나 Function의 로컬 파일이 재시작 뒤에도 남는다고 가정하지 마세요. 모델 제공자의 키, 데이터베이스 연결 정보, 저장소 자격 증명은 플랫폼의 비밀 변수로 관리합니다.

## 공개 URL 최종 확인

1. 새 브라우저 창에서 화면 3개와 정적 파일이 열리는지 확인합니다.
2. 채팅 메시지를 보내고 `reply`가 빈 값이나 `null`이 아닌지, 오류가 났을 때 사용자에게 안내가 보이는지 확인합니다.
3. 실제 AI·검색을 구현했다면 자료가 있는 질문, 없는 질문, 외부 API 실패 상황을 확인합니다. 데모 답변만 나오면 모델 연결이 완료된 것이 아닙니다.
4. 로그와 브라우저 Network 탭에 실제 API 키나 개인정보가 노출되지 않았는지 확인합니다.
5. 서비스를 재시작하거나 다시 배포한 뒤에도 필요한 자료·대화 기록이 유지되는지 확인합니다.
6. 팀 README에 공개 URL, 사용 방법, 필요한 환경 변수 **이름**, 배포 구조와 알려진 제한을 적습니다.

빌드가 실패하면 먼저 Root Directory, Python 버전, `requirements.txt`, 빌드 로그를 확인하세요. 화면은 열리는데 채팅이 실패하면 Network의 `/api/chat` 상태 코드와 서버 로그, 필요한 환경 변수의 **이름과 설정 여부**를 확인하세요. 키의 실제 값을 로그나 질문 글에 붙이지 마세요.
