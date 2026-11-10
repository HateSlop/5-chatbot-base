# Vercel 공개 배포 안내

**현재 공개 주소:** [더뉴빌리지로 오세요](https://5-chatbot-base.vercel.app/). Render 무료 서비스의 전송량 한도를 소진해 Vercel Hobby로 옮겼다. 예전 Render 절차는 [보관 문서](archive/RENDER-GUIDE.md)에 남겨 둔다.

2026-11-10 공개 주소에서 첫 화면·광고 영상, `/health` 응답, 남성 주인공의 새 플레이, 지미와의 실제 AI 대화 및 호감도 50→55를 확인했다. 여성 경로·세 결말·휴대전화 화면·30명 동시 접속은 아직 확인하지 않았다.

## 배포와 확인

1. 팀장 저장소의 배포 대상 브랜치가 `main`인지 Vercel 대시보드에서 확인한다. `suyoung`과 `yejoon`의 변경은 PR로 `main`에 병합한다.
2. 프로젝트 루트를 배포한다. Flask 앱은 루트 `app.py`에 있고 `public/`의 그림·영상·음악은 Vercel의 정적 파일로 제공된다. Build·Output·Install Command는 별도로 덮어쓰지 않는다.
3. 비밀 환경 변수 `OPENAI_API_KEY`와 `STORY_STATE_KEY`를 Vercel에 설정한다. `OPENAI_MODEL`과 `OPENAI_REASONING_EFFORT`는 코드 기본값이 있어 선택 사항이다. 키 값이나 로컬 `.env`는 Git·문서·캡처에 넣지 않는다.
4. 배포 뒤 `/health`, 첫 화면 영상, 새 플레이 생성, 자유 대화 한 번을 확인한다. 발표 전에는 성별별 경로와 세 결말, 휴대전화 화면, 여러 기기의 동시 접속도 직접 확인한다.

현재는 기본 흐름만 공개 주소에서 확인했다. 발표 인원 수준의 응답 속도와 OpenAI API 사용량은 별도 시험이 필요하다.
