# 파일 역할 목록

실행 코드·화면·검사 파일은 각 파일 첫머리의 한 줄 주석이나 Python 설명문에서 담당 일을 확인할 수 있다. 이미지·음악·영상·JSON처럼 파일 안에 주석을 넣을 수 없는 자료는 아래에 적었다. 이 목록은 현재 저장소에 남긴 파일을 기준으로 한다.

## 설정과 자료

| 파일 | 담당 일 |
| --- | --- |
| `config/chatbot_config.json` | 서비스 이름·소개·썸네일과 인물의 공개 설정 |
| `data/images/catalog.json` | 인물별 표정 단서를 실제 그림 경로에 연결 |
| `data/images/cathy_basket.prompt.txt` | 미용실 바구니 그림의 제작 문구 기록 |
| `data/images/diary-paper.prompt.txt` | 독백 종이 그림의 제작 문구 기록 |
| `data/knowledge/facts.json` | 인물이 대화에서 참고하는 공개 마을 정보 |
| `data/knowledge/example_lore.md` | 초기 예시 세계관 자료; 현재 대화 검색에는 사용하지 않음 |
| `.python-version` | 로컬 Python 버전 지정 |
| `.gitattributes` | Git 파일 처리 규칙 |
| `.gitignore` | Git에 올리지 않을 파일 지정 |
| `.dockerignore` | 컨테이너에 넣지 않을 파일 지정 |
| `public/assets/fonts/NanumBrushScript-Regular.ttf` | 필기체 글꼴 파일 |
| `public/assets/fonts/NanumBrushScript-OFL.txt` | 해당 글꼴의 사용 허가 조건 |

## 이미지

| 파일 | 담당 일 |
| --- | --- |
| `public/assets/images/basement.svg` | 정육점 지하실 배경 |
| `public/assets/images/basement_wallet.png` | 지갑을 발견한 지하실 배경 |
| `public/assets/images/bob_angry.png` | 화난 밥 |
| `public/assets/images/bob_basic.png` | 밥의 기본 모습 |
| `public/assets/images/bob_knife_blood.png` | 사망 분기에서 칼을 든 밥 |
| `public/assets/images/bob_lunge.png` | 사망 분기의 밥 공격 컷 |
| `public/assets/images/bob_smile.png` | 웃는 밥 |
| `public/assets/images/butcher_shop.svg` | 정육점 기본 배경 |
| `public/assets/images/butcher_shop_open.png` | 문이 열린 정육점 배경 |
| `public/assets/images/cathy_angry.png` | 화난 캐시 |
| `public/assets/images/cathy_basic.png` | 캐시의 기본 모습 |
| `public/assets/images/cathy_basket.png` | 미용실 도구 바구니 |
| `public/assets/images/cathy_smile.png` | 웃는 캐시 |
| `public/assets/images/character_user_boy.png` | 동화 엔딩의 남성 주인공 |
| `public/assets/images/character_user_girl.png` | 동화 엔딩의 여성 주인공 |
| `public/assets/images/diary-paper.png` | 이사 전 독백의 종이 배경 |
| `public/assets/images/ending_truck.png` | 도주 중 트럭 장면 배경 |
| `public/assets/images/escape_comic_1.png` | 탈출 엔딩의 남성 주인공 컷 1 |
| `public/assets/images/escape_comic_2.png` | 탈출 엔딩의 남성 주인공 컷 2 |
| `public/assets/images/escape_comic_3.png` | 탈출 엔딩의 남성 주인공 컷 3 |
| `public/assets/images/escape_comic_4.png` | 탈출 엔딩의 남성 주인공 컷 4 |
| `public/assets/images/escape_female_1.png` | 탈출 엔딩의 여성 주인공 컷 1 |
| `public/assets/images/escape_female_2.png` | 탈출 엔딩의 여성 주인공 컷 2 |
| `public/assets/images/escape_female_3.png` | 탈출 엔딩의 여성 주인공 컷 3 |
| `public/assets/images/escape_female_4.png` | 탈출 엔딩의 여성 주인공 컷 4 |
| `public/assets/images/festival_hair.png` | 축제 음식에서 머리카락을 발견한 장면 |
| `public/assets/images/festival_meal.png` | 축제 식사 장면 |
| `public/assets/images/festival_meat.png` | 축제 고기 장면 |
| `public/assets/images/festival_stares.png` | 축제 주민들이 바라보는 장면 |
| `public/assets/images/hateslop-logo.png` | 서비스의 헤이트슬롭 로고 |
| `public/assets/images/jimmy_angry.png` | 화난 지미 |
| `public/assets/images/jimmy_anxiety.png` | 불안해하는 지미 |
| `public/assets/images/jimmy_basic.png` | 지미의 기본 모습 |
| `public/assets/images/jimmy_scared.png` | 겁먹은 지미 |
| `public/assets/images/jimmy_smile.png` | 웃는 지미 |
| `public/assets/images/karen_angry.png` | 화난 캐런 |
| `public/assets/images/karen_basic.png` | 캐런의 기본 모습 |
| `public/assets/images/karen_house.svg` | 캐런 집 배경 |
| `public/assets/images/karen_secret_room.png` | 캐런의 수상한 방 입구 배경 |
| `public/assets/images/karen_secret_room_angle2.png` | 캐런의 수상한 방 액자 쪽 배경 |
| `public/assets/images/karen_smile.png` | 웃는 캐런 |
| `public/assets/images/player_female.png` | 여성 주인공 선택·정보 그림 |
| `public/assets/images/player_house.svg` | 주인공 집 기본 배경 |
| `public/assets/images/player_house_evening.png` | 저녁에 지미를 기다리는 집 배경 |
| `public/assets/images/player_house_open.png` | 방문자에게 문이 열린 집 배경 |
| `public/assets/images/player_male.png` | 남성 주인공 선택·정보 그림 |
| `public/assets/images/pre-move-house.png` | 이사 전 집 배경 |
| `public/assets/images/props_charles_back.png` | 찰스 액자 뒷면 |
| `public/assets/images/props_charles_front.png` | 찰스 액자 앞면 |
| `public/assets/images/props_photo_back.png` | 지미 액자 뒷면 |
| `public/assets/images/props_photo_front.png` | 지미 액자 앞면 |
| `public/assets/images/salon.svg` | 미용실 배경 |
| `public/assets/images/square.svg` | 마을 광장 배경 |
| `public/assets/images/start/opening-background.png` | 시작 화면의 영상 대기 그림과 서비스 썸네일 |
| `public/assets/images/start/start-button.png` | 시작 화면의 START 버튼 그림 |
| `public/assets/images/start/village-logo.png` | 시작 화면의 마을 제목 그림 |
| `public/assets/images/the_end_cutout.png` | 결말의 THE END 글자에 넣는 그림 |
| `public/assets/images/ui-talk-bubble.svg` | 인물에게 말을 거는 말풍선 아이콘 |
| `public/assets/images/ui-village-wallpaper.svg` | 마을 화면의 장식 무늬 |
| `public/assets/images/wallet_closed.png` | 닫힌 지갑 조사 화면 |
| `public/assets/images/wallet_open.png` | 열린 지갑 조사 화면 |
| `public/assets/images/wallet_photo.png` | 지갑 속 사진 조사 화면 |

## 소리

| 파일 | 담당 일 |
| --- | --- |
| `public/assets/audio/after-basement-bgm.mp3` | 지하실을 나온 뒤 배경음악 |
| `public/assets/audio/bad-ending-bgm.mp3` | 사망 엔딩 배경음악 |
| `public/assets/audio/butcher-bgm.mp3` | 정육점 배경음악 |
| `public/assets/audio/cathy-minigame-bgm.mp3` | 미용실 바구니 조사 배경음악 |
| `public/assets/audio/doorbell.wav` | 집 방문 초인종 소리 |
| `public/assets/audio/festival-ambience-web.wav` | 축제 현장 소리 |
| `public/assets/audio/festival-escape-bgm.mp3` | 축제 마지막 선택의 긴박한 음악 |
| `public/assets/audio/frightened-jimmy-bgm.mp3` | 겁먹은 지미 장면의 배경음악 |
| `public/assets/audio/home-bgm.mp3` | 주인공 집 배경음악 |
| `public/assets/audio/karen-bgm.mp3` | 캐런 집 배경음악 |
| `public/assets/audio/monologue-typing.wav` | 독백 글자 출력 소리 |
| `public/assets/audio/salon-bgm.mp3` | 미용실 배경음악 |
| `public/assets/audio/square-bgm.mp3` | 광장 배경음악 |
| `public/assets/audio/sunny-little-waltz.mp3` | 시작 화면 배경음악 |
| `public/assets/audio/ui-click.wav` | 버튼 클릭 소리 |
| `public/assets/audio/urgent-bgm.mp3` | 긴급한 사건의 배경음악 |

## 영상

| 파일 | 담당 일 |
| --- | --- |
| `public/assets/videos/opening-loop.mp4` | 시작 화면 반복 영상 |
| `public/assets/videos/video_ending_die_boy.mp4` | 남성 주인공 사망 엔딩 영상 |
| `public/assets/videos/video_ending_die_girl.mp4` | 여성 주인공 사망 엔딩 영상 |
| `public/assets/videos/village-ad.mp4` | 이사 전 TV 광고 영상 |
