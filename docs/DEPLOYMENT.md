# 배포 구성 선택

이 문서는 **2026-10-24에 확인한 공식 문서**를 바탕으로 작성했습니다. 무료 한도·런타임·설정 화면은 바뀔 수 있으므로 배포 시점에 링크를 다시 확인하세요. 과제에서 필요한 것은 공개 URL이며, 플랫폼은 자유입니다.

## 먼저 구조를 고르세요

| 구성 | 맞는 경우 | 배포 전 확인 |
| --- | --- | --- |
| **Flask 한 앱**이 화면과 API를 함께 제공 | 이 저장소를 적게 바꾸고 빠르게 공개할 때 | Python 의존성, 실행 명령, 모델 키, 검색 인덱스 저장 위치 |
| **정적 프런트 + 별도 API** | 프런트 프레임워크를 쓰거나 양쪽을 독립 배포할 때 | API 주소, CORS 또는 프록시, 환경별 설정, 양쪽 로그 |
| **Cloudflare Python Worker** | Worker 제약 안에서 실행할 수 있는 가벼운 Python API일 때 | 코드 변환, 패키지 호환성, 자원 한도, 지속 저장소 |
| **컨테이너 서비스** | 무거운 Python 패키지나 긴 실행·파일 저장이 필요할 때 | 운영 비용, 영구 저장소, 재시작·헬스체크 |

프런트와 API를 다른 도메인에 두면 현재 JS의 상대 경로 `/api/chat`를 실제 API 주소로 바꾸거나 프록시를 설정해야 합니다. 브라우저의 교차 출처 요청 정책도 함께 처리하세요. API 키는 브라우저 코드에 넣지 않습니다.

## Render: 단일 Flask 앱 예시

Git 저장소를 연결해 Web Service를 만들고, 루트를 이 저장소로 설정합니다. Python 환경의 빌드 명령은 `pip install -r requirements.txt`, 시작 명령은 `gunicorn --bind 0.0.0.0:$PORT app:app`으로 시작할 수 있습니다. Docker 배포를 선택해도 됩니다. 운영용 키는 서비스의 환경 변수/비밀 설정에 넣고, `/health`를 생존 확인 경로로 사용할 수 있습니다. [Render Flask 배포](https://render.com/docs/deploy-flask), [Web Service 설정](https://render.com/docs/web-services)

Render 무료 Web Service는 유휴 상태가 15분 지속되면 중지되고, 다시 켜질 때 기다릴 수 있습니다. 파일시스템은 임시이며 무료 Web Service에는 영구 디스크를 붙일 수 없습니다. 따라서 **런타임에 생성·변경한 Chroma 인덱스, 업로드 이미지, 대화 기록을 로컬 파일에만 보관하면 사라집니다.** Git에 포함된 읽기 전용 예시 자료는 재배포 때 다시 제공되지만, 생성 인덱스의 갱신·지속 보존 문제와는 별개입니다. [Render 무료 서비스](https://render.com/docs/free), [영구 디스크](https://render.com/docs/disks)

## Vercel: 단일 Flask Function 예시

Vercel은 루트의 `app.py`에서 `app` 객체를 찾을 수 있으며 Flask 앱을 하나의 Function으로 배포합니다. 정적 파일은 `public/`에 두어야 하므로 이 저장소는 `/assets/...` URL을 사용합니다. 배포 후 화면, CSS, JS, 이미지가 모두 열리는지 직접 확인하세요. Function의 크기·실행 제약과 Python 패키지 호환성을 적용 후 점검해야 합니다. [Vercel Flask](https://vercel.com/docs/frameworks/backend/flask), [Function 제한](https://vercel.com/docs/functions/limitations)

Vercel Function의 로컬 파일 변경을 지속 저장소로 취급하지 마세요. 파일 기반 Chroma 인덱스를 요청 중 생성하거나 갱신하는 설계라면 외부 저장소·검색 서비스로 바꾸거나 사전 생성한 읽기 전용 자료를 별도로 검증해야 합니다. [Vercel 파일시스템 안내](https://vercel.com/guides/why-does-my-serverless-function-work-locally-but-not-when-deployed)

## Cloudflare: 두 가지 경로

1. **정적 프런트 + 별도 Python API:** Cloudflare의 정적 호스팅을 프런트에 쓰고 Flask API는 다른 서비스에 둘 수 있습니다. 이 경우 템플릿을 정적 프런트로 바꾸고 API 주소를 설정합니다.
2. **Python Worker의 Flask WSGI 어댑터:** Cloudflare는 Flask를 Worker에서 실행하는 공식 예시를 제공합니다. 다만 이 저장소의 `app.py`를 그대로 업로드하는 절차가 아니며 Worker 진입점과 정적 자산 설정을 추가해야 합니다. Python 패키지는 pure Python·PyEmscripten·Pyodide 지원 범위를 확인해야 합니다. 기존 ChromaDB 로컬 저장을 그대로 옮길 수 있다고 가정하지 마세요. [Cloudflare Flask](https://developers.cloudflare.com/workers/framework-guides/apis/flask/), [Python 패키지](https://developers.cloudflare.com/workers/languages/python/packages/), [Worker 한도](https://developers.cloudflare.com/workers/platform/limits/)

Docker가 필요한 경우 Cloudflare Containers 같은 별도 선택지도 있지만, 계정·요금·운영 제약을 확인해야 합니다. [Cloudflare Containers](https://developers.cloudflare.com/containers/)

## 데이터 보관을 따로 설계하세요

| 데이터 | 예시 | 설계 질문 |
| --- | --- | --- |
| 원본 자료 | 세계관 문서, FAQ | 공개 가능한 자료인가? 변경 시 어떻게 배포하는가? |
| 생성 인덱스 | 임베딩·벡터 DB | 누가 언제 생성하는가? 재배포 뒤에도 필요한가? |
| 사용자 데이터 | 대화 기록, 업로드 | 사용자 구분·삭제·보관 기간은? |
| 비밀 값 | 모델 API 키 | 서버 환경 변수/비밀 관리에만 있는가? |

로컬 개발에서는 ChromaDB의 `PersistentClient`를 쓸 수 있지만, 호스팅 환경에서는 파일 보존 조건을 확인하거나 서버형·관리형 검색 저장소를 고려하세요. [Chroma Python 클라이언트](https://docs.trychroma.com/reference/python)

## 공개 URL 최종 점검

1. 시크릿 창에서 첫 화면, 소개, 대화 화면을 엽니다.
2. CSS·JS·이미지 요청이 200인지 확인합니다.
3. 정상 질문과 빈 질문, 검색 자료가 없는 질문을 보냅니다.
4. 실제 배포 환경에서 모델 키와 검색 저장소 연결을 확인합니다. 키 값은 로그에 출력하지 않습니다.
5. 재배포 또는 재시작 뒤에도 필요한 데이터가 남는지 확인합니다.
6. README에 공개 URL과 실행·검증 방법, 선택한 구성의 제한을 적습니다.
