# Cheil 기획 오피스 — 이음오피스에서 바꾼 것

이 저장소는 [이음오피스](https://github.com/pblsketch/openoffice)(Apache-2.0, 커밋 `5fda829`, v0.12.3)를 광고대행사 기획 문서용으로 고친 사본이다. 원본 규칙(`CLAUDE.md`의 "원본 규칙")은 그대로 지킨다. 고친 코드에는 `Cheil fork:` 주석을 단다. 원본과의 차이는 `git diff upstream/main`(원격 이름 `upstream`)으로 본다.

## 1. 이름과 모양

| 무엇                   | 원본                           | 포크                         | 파일                                                                    |
| ---------------------- | ------------------------------ | ---------------------------- | ----------------------------------------------------------------------- |
| 화면 이름(한국어)      | 이음오피스                     | Cheil 기획 오피스            | `packages/i18n/src/product.ts`                                          |
| 설치·폴더 이름         | IeumOffice                     | CheilOffice                  | 같은 파일, `apps/shell/package.json`, `apps/shell/electron-builder.cjs` |
| 설치 ID                | io.github.pblsketch.ieumoffice | com.cheil.planningoffice     | `electron-builder.cjs`                                                  |
| 파일 연결 이름(ProgId) | IeumOffice.*                   | CheilOffice.*                | `build/installer.nsh`, `src/main/default-app.ts`                        |
| 데이터 폴더            | %APPDATA%\IeumOffice           | %APPDATA%\CheilOffice        | 이름에서 따라옴                                                         |
| 아이콘·로고            | 이음 고리                      | 남색 바탕 기획서 한 장       | `apps/shell/build/brand/*.svg` → `node tools/gen-brand-assets.mjs`      |
| 강조색                 | #0f7fff                        | #1d4fb8(어두운 화면 #6f9bf5) | `apps/shell/src/renderer/src/*.css`                                     |

- 회사 로고는 쓰거나 흉내 내지 않았다. 회사 공식 로고·색으로 바꾸려면 위 SVG 세 개만 바꾸고 생성기를 돌린다.
- 그대로 둔 이름: 내부 이름(`@genoffice/*`, `GENOFFICE_*`), 터미널 명령어 `ieumoffice`와 `~/.ieumoffice`(도움말 925곳이 그 이름을 쓴다. 바꾸려면 따로 작업), 저장소 좌표·문의 메일(설정 → 정보, 도움말 메뉴가 원본을 가리킨다 — 배포 전에 정할 것).

## 2. AI 엔진: 사용자 자신의 API 키가 기본, 이 PC 의 Ollama 는 나중

### 2-0. 내 API 키로 연결 (2026-10-25, 배포 기준)

- 사용자 결정(10-25): **배포판은 사용자가 자기 Claude·GPT·Solar API 키를 넣어 쓴다. 로컬 LLM 은 나중 일.**
- 새 설정의 기본은 원본과 같은 `auto`(구독이 있으면 그것, 없으면 '연결 필요')다. Ollama 도 주소 칸을 비운 채 시작해서, Ollama 가 없는 PC 에 선택지로 뜨지 않는다. 쓰려면 고급 → Ollama 에 `http://127.0.0.1:11434`를 넣는다. 이미 Ollama 를 고른 설정 파일은 그대로 Ollama 다.
- 설정 → AI 맨 위와 첫 실행 안내의 연결 단계에 **'내 API 키로 연결'** 카드 3장: Claude(`anthropic`), GPT(`openai`), Solar(`upstage`, 새 제공자). 키를 넣고 '저장하고 쓰기'를 누르면 그 제공자가 쓰는 AI 가 된다(사용자가 고른 것 — 원본 규칙 '요금 경로는 사용자가 고를 때만'과 같다). '키 지우기'는 그 AI 를 쓰던 중이면 `auto`로 돌린다(다른 유료 키로 넘어가지 않음). 키는 원본처럼 설정 파일(`ai-settings.json`)에 저장되고 화면에는 앞뒤만 보인다(`up_…1234`). 홈 왼쪽 아래에 "Solar API · solar-pro3"처럼 보인다.
- Solar(`upstage`): OpenAI 호환 `https://api.upstage.ai/v1`, 모델 `solar-pro3`(기본)·`solar-pro2`·`solar-mini`, 그림 입력 없음. 모델 id 는 Upstage 가 내는 이름(Hermes Agent 의 Upstage 설정, 2026-08 기준) — 실제 키로는 아직 시험하지 않았다.
- 코드: 규칙 `apps/shell/src/renderer/src/cheil/api-keys.ts`, 화면 `ApiKeyCards.tsx`, 홈 표시 `local-engine.ts`, 제공자 `packages/ai-provider/src/{types,providers,registry}.ts`의 `upstage`. 시험 `apps/shell/tests/cheil-api-keys.test.ts`, `e2e/cheil-api-keys.spec.ts`(설정 카드·첫 실행 안내·OpenAI 호환 API 로 양식 채우기 — 이 PC 의 가짜 API 서버로, 실제 키 없이).
- **편집기 AI 창의 '연결 필요' 안내**(10-25): 아무것도 연결되지 않았을 때 원본 문장("이미 쓰고 있는 Claude 또는 Codex 구독으로 AI를 씁니다. API 키는 필요 없습니다.") 대신 "가지고 있는 Claude·GPT·Solar API 키를 넣으면 바로 씁니다"와 **[API 키 넣기]** 단추(설정 → AI 를 연다, 맨 위가 키 카드)를 먼저 보이고, 구독·무료 길은 그 아래에 남긴다. 모든 편집기와 홈의 질문 창이 같은 공용 부품(`packages/ui/src/AiSubscriptionCard.tsx`의 `AiConnectPrompt`, 문구 `cheil-connect.ts`)을 쓰므로 한 곳에서 바뀐다. 원본 문장 `connectBody`는 설정 → AI 의 '구독 연결' 제목 아래에서만 쓰인다(거기서는 맞는 말). 키 제공자를 골랐는데 키가 없을 때의 안내는 원본 그대로. 시험: `packages/ui/tests/ai-subscription-parts.test.ts`의 Cheil 항목, `e2e/cheil-api-keys.spec.ts`의 편집기 안내 시험.
- 금지선(3절)은 그대로다: API 서버는 이 PC 밖이므로 광고주 기밀·개인정보가 보이는 요청은 보내지 않는다. **Hermes Agent 같은 이 PC 의 중계 서버를 거치지 말 것**(HANDOVER 8절 11번).
- 빠른 채우기는 API 모델에서도 같은 한 번 호출로 돈다(`ai:chat`). `json` 옵션은 Ollama 만 쓰고(`format: json`), API 모델은 지시문("JSON 객체 하나로만")과 답에서 `{…}`를 꺼내는 해석으로 받는다. 답 길이 상한: Claude 8,192토큰, OpenAI 호환(GPT·Solar)은 서비스 기본값.

### 2-1. 이 PC 의 Ollama (나중에 쓸 엔진)

- 새 제공자 `ollama`: `packages/ai-provider/src/protocols/ollama.ts`. Ollama 의 네이티브 `/api/chat`을 쓴다. OpenAI 호환 `/v1`은 문맥 길이 지정을 무시해 4,096 토큰으로 잘렸기 때문이다(직접 시험).
  - `num_ctx` 16,384, 모델 30분 유지(`keep_alive`), qwen3 류는 생각 끔(`think: false`).
  - 첫 응답까지 최대 10분 기다린다. 이 PC(i5-1135G7, 외장 GPU 없음)는 지시문을 초당 약 35토큰으로 읽는다(측정: 4,107토큰 126초, 12,267토큰 325초).
  - 요청이 열려 있는 동안 15초마다 '일하는 중' 신호를 화면에 보낸다(화면 쪽 4분 무응답 감시가 끊지 않게). 진짜로 멈추면 뒷단 감시(첫 응답 10분, 이후 3분)가 끊는다.
- (10-25 까지) 새 설정의 기본 제공자는 `ollama`(주소 `http://127.0.0.1:11434`, 모델 `gemma4:e4b`)였다. 지금은 2-0 절처럼 `auto`이고 Ollama 는 주소를 넣어야 쓴다. 이미 있는 설정 파일은 그 값을 따른다. 알 수 없는 값은 원본처럼 '자동'.
- 등록: `types.ts`(AiProviderId), `providers.ts`(목록·기본값), `registry.ts`(프로토콜 `ollama`), `stream.ts`·`chat.ts`(분기).

## 3. 금지선: 기밀은 이 PC 밖으로 안 나간다

- `packages/ai-provider/src/cheil-grade.ts`: 예전 Cheil 문서 도구(`oce/src/js/30_grade.js`)의 규칙 판정을 옮겼다. 기밀 표지(대외비·사내 한정·confidential), 최고 기밀 표지(극비·엠바고·미출시), 코드명, 메일 머리, 가명화 흔적, 개인정보(전화·메일·주민번호·계좌), 숫자 표 모양, 신호 3종 조합.
- AI 요청이 모두 지나는 두 길목(`streamForProvider`, `chatForProvider`)에서, 받는 곳이 이 PC(127.x, localhost, ::1)가 아니면 대화의 사용자 글·문서 내용·도구 결과를 검사해 광고주 기밀 이상이거나 개인정보가 보이면 보내지 않고 이유를 보여 준다. 구독(Claude·Codex)도 '밖'으로 친다. 설정으로 열 수 없다.
- 한계: 규칙 판정이라 놓치는 것이 있다. 광고주 사전(이름 목록)이 없어 광고주명+숫자 조합은 못 잡는다. 검색(`search`)·이미지 생성 같은 도구가 밖으로 보내는 검색어는 이 검사를 지나지 않는다.

## 4. 광고대행사 양식 스킬 7종

`apps/shell/resources/builtin-skills/cheil-*` (기본 스킬, 켜진 채 시작). 양식 문서는 `python -I tools/cheil/make_templates.py`로 다시 만든다(맑은 고딕, 예시 숫자 없이 `[ ]` 자리만).

| 스킬                 | 화면 제목           | 양식                                                                  |
| -------------------- | ------------------- | --------------------------------------------------------------------- |
| cheil-house-rules    | Cheil 문서 원칙     | (없음) 숫자는 자료에 있는 것만, 출처, 헤드 메시지, 광고주용 마감 규칙 |
| cheil-proposal       | 캠페인 제안서       | PPT 12장                                                              |
| cheil-monthly-report | 월간 성과 보고서    | PPT 8장                                                               |
| cheil-brief          | 크리에이티브 브리프 | 워드                                                                  |
| cheil-meeting-notes  | 광고주 회의록       | 워드                                                                  |
| cheil-pitch-analysis | 경쟁 PT 분석        | 워드                                                                  |
| cheil-media-plan     | 미디어 플랜         | 엑셀(CPM·CPC·CTR·비중 계산식)                                         |

- **공통 칸 사전**(`packages/ui/src/cheil-fields.json`, 읽는 쪽 `cheil-fields.ts`): 양식마다 같은 정보는 같은 칸 이름을 쓴다. `[캠페인명] [광고주] [브랜드·제품] [캠페인 기간] [총예산] [타깃] [KPI] [팀명] [작성자] [작성일]` 10개. 별칭(`[광고주명]`, `[예산 합계]`, `[제출일]` 등)은 양식에 쓰지 않는다. `make_templates.py`가 사전을 읽어 양식을 만들고 다시 열어 확인한다(별칭을 쓰거나 공통 칸이 아닌 칸이 두 번 나오면 실패). `packages/ui/tests/cheil-fields.test.ts`도 들어 있는 양식 6종을 열어 같은 것을 본다. 사전의 `hint`(칸의 뜻)는 사람이 읽는 설명이고 **모델에게 보내지 않는다**: 붙여 보내 보니(10-25, gemma4:e4b, 제안서, 시드 2개씩) 핵심 메시지·컨셉 칸을 매번 `[확인 필요]`로 두었고 광고주·브랜드 혼동도 줄지 않았다(HANDOVER 3절). 캠페인 카드 값으로 공통 칸을 AI 없이 채우는 함수(`cheilFieldValues`, `cheilFieldValueFor`, 별칭도 읽음)도 여기 있다.
- 원본의 기본 스킬 5개(회의록 정리 등)도 그대로 있다. `builtin-skills.json`(외부 출처 목록)에는 넣지 않았다(우리 것이라 출처 기록이 필요 없음).
- 회사 공식 서식으로 바꾸려면 `assets/`의 파일만 바꾸면 된다. 사용자가 설정 → 스킬에서 자기 양식 스킬을 더할 수도 있다(원본 기능).

## 5. 홈 화면 '광고 문서 양식' 줄

- `apps/shell/src/renderer/src/cheil/AgencyTemplates.tsx`: 빠른 시작 아래에 6개 카드. 누르면 그 스킬의 양식 사본이 새 탭으로 열리고, AI 창에 스킬 칩과 요청 예문이 **보내지 않은 채** 채워진다. 자료를 첨부하고 보내면 그 문서에서 바로 돈다.
- 이를 위해 넘겨주기에 `prefill` 표시를 더했다: `user-skills-channels.ts`, `generate-handoff.ts`, `template-tabs.ts`, `skill-template-model.ts`, `use-skill-templates.tsx`. 칩에는 `inPlace`(이 문서가 양식 사본이니 새 탭을 또 열지 않음)를 더했다: `skill-picker-model.ts`, `use-composer-skills.tsx`. 연결은 워드·PPT·엑셀 편집기 세 곳.
- 문구는 한국어, 다른 언어는 영어(원본의 21개 언어 규칙에서 벗어남 — 사내용이라 받아들임).

## 5-1. 양식 빠른 채우기 (sLLM 한 번 호출)

- 왜: CPU 노트북의 작은 모델로 편집기 AI 의 범용 도구 반복(모델 → 도구 → 모델)을 돌리니, 브리프 하나에 24단계·28분을 쓰고도 문서가 그대로였다(2026-10-23 실측).
- 어떻게(`packages/ui/src/cheil-fill.ts`): ① 앱이 문서의 `[칸]`을 뽑는다(같은 칸은 한 번, 앞줄과 함께 문맥으로) ② 모델에게 요청·첨부 자료·칸 목록을 주고 JSON 하나(`{"S1": "...", ...}`)로만 답하게 한다(Ollama `format: json`) ③ 앱이 편집기의 `findReplace` 연산으로 바꾼다(되돌리기 가능, 변경 추적 켜져 있으면 추적). 자료에 없는 칸은 모델이 `[확인 필요]`로 둔다.
- 언제: AI 창 요청에 Cheil 양식 스킬 칩(`builtin:cheil-*`, 원칙 스킬 제외)이 붙어 있고 문서에 `[칸]`이 있을 때. 칸이 없으면 원래 도구 반복으로 돈다.
- 연결된 곳: 워드 편집기(브리프·회의록·경쟁 PT, `apps/docs/src/renderer/ai/AiPanel.tsx`의 `runCheilFill`)와 PPT 편집기(제안서·월간 보고, `apps/slides/src/renderer/ai/AiPanel.tsx`의 `runCheilFill`, 덱 연산 `findReplace`). 엑셀 편집기(미디어 플랜, `apps/sheets/src/renderer/App.tsx`의 `runCheilSheetFill`, 공용 `packages/ui/src/cheil-sheet-fill.ts`): A1:L40 을 읽어 셀 글 속 `[칸]`과 '입력 표'(머리 행 + 아래 빈 줄, 합계 행에서 멈춤)를 찾는다. 계산식이 든 열(CPM·CPC·CTR·비중)은 쓰지 않는다. 모델은 칸 값과 표 줄 배열(`T1: [{매체, 상품·지면, ...}]`)을 JSON 하나로 답하고, 앱은 `set_cell` 연산으로 쓴다(숫자는 숫자, YYYY-MM-DD 는 엑셀 날짜). 엑셀 채널 `aiChatRequestSchema`에 `json`을 더했다.
- 워드의 `findReplace` 연산은 최상위 문단만 훑어 표 안 칸을 못 바꾼다 → 남은 칸은 `cheil-fill-docs.ts`의 `replaceLeftoverBlanks`가 표 안까지 한 번에 바꾼다(원본 연산은 그대로 둠).
- PPT 편집기 preload 에 단발 호출(`slidesApi.aiChat`)을 더했다(공용 `ai:chat` 통로).
- 한계: 채우는 중 '중지'를 눌러도 이미 보낸 모델 호출은 끝까지 돈다. 채운 뒤 문장 다듬기·장 추가는 칩 없이 보통 요청으로(그때는 범용 도구 반복).
- 양식 문서는 칸 이름이 모두 달라야 한다(같은 `[ ]`가 여러 개면 찾아 바꾸기가 다른 칸까지 바꾼다). `make_templates.py`가 그렇게 만들고 확인한다. 예외: 공통 칸(4절)은 어디서나 값이 같으니 여러 번 나와도 된다.
- 단발 호출 통로: `ai:chat`에 `json` 옵션을 더했다(`AiChatRequest.json`, `chatForProvider`의 6번째 인자). Ollama 단발 호출은 내부적으로 흘려받아(stream) 토큰마다 감시 타이머를 깨운다.

## 5-2. 캠페인 이력 (공모전 수정 계획 2번)

- 무엇: 캠페인 정보(카드)를 한 번 넣으면 그 캠페인의 문서·메일·작업 기록이 한 폴더에 묶인다. 홈의 '광고 문서 양식' 아래 **'내 캠페인'** 줄에서 만들고 연다.
- 어디에: `문서\Cheil 캠페인\<광고주> - <캠페인명>\` 폴더 하나가 캠페인 하나다. 같은 이름이면 ` (2)`를 붙인다. 시험 실행(`GENOFFICE_USER_DATA`가 있을 때)은 그 임시 userData 아래 `Cheil 캠페인`, `CHEIL_CAMPAIGNS_DIR`로 바꿀 수 있다.
  - `campaign.json`: 카드(`campaign client brand start end budget target kpi team author` — 공통 칸 사전의 키와 같다), 만든 때·바꾼 때.
  - `timeline.jsonl`: 한 줄에 사건 하나(`at kind text`, 카드 수정이면 `changes`). 종류: 만듦·카드·메모, 그리고 3번 이후 쓸 채우기·문서·메일·점검·수정 반영·할 일. 깨진 줄은 건너뛰고 읽는다.
  - `캠페인 이력.md`: '이력 문서로 보기'를 누르면 카드 표와 타임라인을 써서 마크다운 탭으로 연다(인수인계용, 원본은 `timeline.jsonl`).
- 코드: 저장 `apps/shell/src/main/cheil/campaign-store.ts`(Electron 없음, 캠페인 하나에 쓰기는 차례로), 창구 `campaign-ipc.ts`(홈 화면만 부를 수 있음, 화면은 폴더 이름만 넘기고 경로는 받지 않음), 약속 `apps/shell/src/shared/cheil-campaign-api.ts`, preload `window.aiOfficeCheilCampaigns`, 화면 `apps/shell/src/renderer/src/cheil/MyCampaigns.tsx`(목록·카드 입력·캠페인 보기: 카드, 메모 남기기, 타임라인 최신순). 문구는 한국어 + 영어.
- 카드를 고치면 바뀐 칸만 타임라인에 남는다("카드 수정: 총예산 500,000,000원 → 600,000,000원"). 예산이 숫자만이면 쉼표와 '원'을 붙여 보인다(저장은 입력 그대로).
- 시험: `apps/shell/tests/cheil-campaign-store.test.ts`(만들기·다시 읽기·바뀐 칸만 기록·잘못된 카드·경로 거절·같은 이름·목록 순서·깨진 줄·동시 쓰기 순서·이력 문서·홈만 응답), 화면 `e2e/cheil-office.spec.ts`의 캠페인 시험(만들기 → 타임라인 → 메모 → 카드 수정 → 폴더 파일 → 이력 문서 탭).
- 아직 없는 것: 문서·채우기·메일이 끝날 때 저절로 남기기(3번), 캠페인 폴더 위치 바꾸기.

## 5-3. 문서 세트 채우기 (공모전 수정 계획 4번, 10-25)

- 무엇: 캠페인 보기의 **'문서 세트 만들기'**에서 양식을 고르고(기본: 브리프·제안서·미디어 플랜) '선택한 양식 열기'를 누르면, 양식마다 **캠페인 폴더에 파일**(`크리에이티브 브리프.docx`, `캠페인 제안서.pptx` …, 같은 이름이 있으면 ` (2)`)이 만들어져 새 탭으로 열리고 카드 값이 공통 칸에 **AI 없이** 바로 들어간다. AI 창 입력란에는 요청과 `[캠페인 카드]` 줄이 보내지 않은 채 기다리고, 나머지 칸은 자료를 붙여 보내면 빠른 채우기(5-1절)가 채운다. 타임라인에 "문서 세트를 캠페인 폴더에 만들어 엽니다: …" 한 줄이 남는다.
- 흐름: 화면은 양식 이름과 요청 글만 보낸다(`cheil:campaign-open-set`, 홈 화면만). 뒷단이 **저장된 카드**에서 공통 칸 값을 다시 만들고(`cheilFieldValues`, 작성일은 오늘), 홈 양식 카드와 같은 넘겨주기로 그 값을 `cheil` 칸에 싣는다. 다만 이름 없는 임시 사본 대신 캠페인 폴더에 쓴 파일을 연다(`templateTabs.openTemplateFile`, 10-26). 화면이 값을 지어 보낼 길은 없다(넘겨주기 IPC 는 `cheil`을 받지 않는다).
- 편집기: 넘겨받은 패널이 문서가 열릴 때까지 기다렸다가(250ms 간격, 최대 30초) 문서의 칸 가운데 공통 칸(별칭 포함, `cheilCardReplacements`)을 바꾼다. 워드 `replaceLeftoverBlanks`(표 안까지, 되돌리기 한 번), PPT 덱 `findReplace`(50개씩), 엑셀 `cheilCardSheetWrites` → `set_cell`(되돌리기 한 번). 패널에 "캠페인 '…' 카드로 공통 칸 N개를 채웠습니다(AI 없이)"가 남는다.
- 카드에 비어 있는 칸은 그대로 `[칸]`으로 남아 빠른 채우기가 채우거나 `[확인 필요]`로 둔다. 기간의 한쪽만 있으면 다른 쪽은 `[확인 필요]`.
- 코드: 규칙 `packages/ui/src/cheil-fields.ts`(`cheilCardFillOf` 넘겨주기 읽기, `cheilCardReplacements`, `cheilCardSummary`, `cheilCardFillNote`)·`cheil-sheet-fill.ts`(`cheilCardSheetWrites`), 넘겨주기 `packages/electron-utils/src/generate-handoff.ts`(`SkillHandoff.cheil`)·`packages/ui/src/skill-template-model.ts`·`use-skill-templates.tsx`(`prefill`의 세 번째 인자), 편집기 `fillFromCampaignCard`(워드·PPT `AiPanel.tsx`, 엑셀 `App.tsx`), 뒷단 `campaign-ipc.ts`(`campaignSetItemsOf`), 화면 `MyCampaigns.tsx`의 `DocumentSet`, 양식 목록 `apps/shell/src/renderer/src/cheil/templates.ts`(홈 카드와 함께 씀).
- 시험: `packages/ui/tests/cheil-card-fill.test.ts`, `skill-template-model.test.ts`의 Cheil 항목, `apps/shell/tests/cheil-campaign-store.test.ts`의 문서 세트 항목, 화면 `e2e/cheil-campaign-set.spec.ts`(브리프·제안서. 미디어 플랜은 엑셀 처리 프로그램이 있는 PC 에서만 돈다).
- 저장(10-26): 탭이 캠페인 폴더의 그 파일을 보여 주므로 저장하면 그 자리에 저장된다(다른 이름으로 묻지 않음). 저장하지 않고 닫으면 폴더의 파일은 채우기 전 양식 그대로 남는다.

## 5-4. 자동 기록 (공모전 수정 계획 3번, 10-26)

- **채우기 기록**: 캠페인의 문서 세트로 연 탭에서 카드 채우기·빠른 채우기가 끝나면 타임라인에 한 줄이 저절로 남는다("크리에이티브 브리프: 캠페인 카드로 공통 칸 10개를 채움", "…: 빠른 채우기 — 양식 칸 19개 중 17개를 자료로 채움, 2개는 [확인 필요]"). 문서 세트를 열 때는 "문서 세트를 캠페인 폴더에 만들어 엽니다: …"가 먼저 남고, 열지 못한 양식이 있으면 그 줄도 남는다.
  - 길: 편집기는 끝난 채우기의 숫자만 보낸다(`cheilRecordFill` → 공용 다리 `aiOfficeUserSkills.cheilRecord` → `cheil:campaign-record`). 뒷단은 **보낸 탭이 보여 주는 파일의 폴더**로 캠페인과 문서 이름을 찾는다(`apps/shell/src/main/cheil/campaign-files.ts`의 `campaignDocumentOf`: 캠페인 폴더 바로 안의 .docx·.pptx·.xlsx, 이름은 파일 이름에서 확장자를 뺀 것). 그래서 탭을 닫았다 다시 열어도, 앱을 다시 켜도, 탐색기에서 연 같은 파일도 그 캠페인의 문서다(10-26 전에는 문서 세트가 연 탭을 메모리에만 적었다). 탭이 캠페인을 지정할 수는 없고, 다른 탭의 보고는 무시한다. 문장은 뒷단이 만든다(`campaignRecordText`).
  - 열린 캠페인 보기는 3초마다 타임라인을 다시 읽어 탭이 남긴 줄을 보여 준다.
- **받은 메일 → 할 일**: 캠페인 보기의 '받은 메일 → 할 일'에 메일을 붙여넣고 '할 일 뽑기' → AI 한 번(공용 `ai:chat`, 금지선 검사를 거친다, `json`) → 할 일·담당·마감 목록 → **사람이 고치고 고른 것만** '선택한 할 일 기록'으로 타임라인 '할 일' 줄(마감 표시)이 된다. 기록 전에는 아무것도 남지 않는다. 지시문은 "메일에 적힌 것만, 날짜가 확실하지 않으면 빈칸"(`packages/ui/src/cheil-mail.ts`의 `buildCheilTaskPrompt`), 답은 앱이 다시 검사한다(`parseCheilTasks`: 한 줄, 실재하는 날짜만, 중복 제거, 20개까지). 뒷단도 다시 검사한다(`campaignTasksOf`).
- 메일 초안·보내기 전 점검·수정 반영(6~10번)의 기록은 그 기능과 함께 같은 길(`record`, 사건 종류 `mail check revise`)로 붙인다.
- 시험: `packages/ui/tests/cheil-mail.test.ts`, `apps/shell/tests/cheil-campaign-store.test.ts`(탭 보고·다른 탭 무시·잘못된 보고·할 일 기록), 화면 `e2e/cheil-auto-record.spec.ts`(이 PC 의 가짜 OpenAI 호환 서버로 빠른 채우기와 메일 읽기), `e2e/cheil-campaign-set.spec.ts`의 타임라인 줄.

## 5-5. 변경 전파 (공모전 수정 계획 5번, 10-26)

- 무엇: 캠페인 카드를 고쳐 저장하면(예: 총예산 5억 → 6억) **그 캠페인 폴더의 워드·PPT·엑셀 문서**에서 이전 값이 새 값으로 바뀐다(AI 없이, 문서마다 되돌리기 한 번).
  - 열린 탭은 바로 바뀐다.
  - 닫힌 파일은 이전 값이 들어 있을 때만 앱이 다시 열어 바꾸고, **저장은 하지 않는다**(사람이 보고 저장). 홈이 앞으로 돌아와 목록을 보인다.
  - 캠페인 보기에 **'카드 변경을 캠페인 문서에 반영했습니다'** 목록(문서마다 어떤 칸을 몇 곳, 다시 연 문서는 "— 닫혀 있던 문서를 열어 바꿨습니다. 확인하고 저장하세요"), 각 탭의 AI 창에 "캠페인 카드가 바뀌어 이 문서를 고쳤습니다: …", 타임라인에 "카드 변경 반영: 크리에이티브 브리프 — 총예산 … → … 1곳"(다시 연 문서는 끝에 "(닫혀 있던 문서를 열어 바꿈, 저장 전)")이 남는다.
  - 읽지 못했거나(암호·깨진 파일) 다시 열지 못한 문서는 "확인하지 못한 문서: …"로 목록과 타임라인에 남는다.
- 규칙(`packages/ui/src/cheil-fields.ts`의 `cheilCardChanges`): 저장된 카드의 앞뒤 값을 공통 칸 값으로 견준다(작성일은 옮기지 않음). 바뀐 칸마다 찾을 글은 이전 값, 이전에 비어 있었으면 그 칸 `[총예산]`(별칭 포함). **카드에서 비운 칸은 문서에서 지우지 않고** 목록에 따로 적는다. 두 글자 미만인 이전 값은 다른 낱말 안에서 걸리므로 찾지 않는다. 두 찾을 글이 겹치면(브랜드가 캠페인명 안에) 긴 쪽이 이긴다(`cheilReplaceText`, 워드 `replaceEverywhere`).
- 길: 뒷단(`campaign-ipc.ts`의 `update`)이 바뀐 칸을 짝(`find → to`)으로 만든다. 캠페인 폴더 바로 안의 문서(`index.ts`의 `cheilCampaignDocuments`) 가운데:
  - 탭에 열린 것(`campaignTabs`, 떨어진 창 포함)에는 짝을 `cheil:campaign-propagate`로 보낸다.
  - 닫힌 것(`closedDocuments`)은 `parseFileToText`로 글을 읽어 이전 값이 있는 것만 `openDocumentPath`로 다시 열고(한 번에 12개까지, 넘으면 '확인하지 못한 문서'), 열린 탭과 같이 보낸다.
  - 탭은 공용 다리 `onCheilPropagate`(`useCheilPropagate`)로 받아 자기 편집 연산으로 바꾸고 짝마다 바꾼 곳 수를 `cheil:campaign-propagated`로 답한다. 뒷단은 **보낸 탭이 맞을 때만** 답을 받는다.
  - 준비 신호: 편집기가 듣기 시작하면 `cheil:campaign-propagate-ready`로 알리고(그만두면 false), 뒷단은 그 신호를 받은 뒤에 보낸다. 받은 편집기는 문서가 다 열릴 때까지 기다렸다 바꾼다(워드는 글이 생길 때, PPT 는 슬라이드가, 엑셀은 시트가 생길 때, 최대 25초). 답을 기다리는 한도: 열린 탭 10초, 다시 연 문서 30초. 넘으면 '응답이 없어 확인하지 못했습니다'.
  - 워드: `replaceEverywhere`(표 안까지, 한 트랜잭션). PPT: 덱 글에서 곳 수를 센 뒤 `findReplace`(긴 글 먼저). 엑셀: A1:L40 의 글 칸만 다시 쓰고 계산식 칸은 건드리지 않는다(`set_cell`, 숫자로 든 예산 칸은 바뀌지 않는다).
- 한계: 캠페인 폴더 안의 하위 폴더는 보지 않는다. 저장하지 않고 닫은 문서는 파일에 남은 값으로 다음 변경을 찾는다. AI 가 다른 꼴로 쓴 값(예: "5억 원")은 찾지 못한다(목록에 0곳 또는 빠짐). 닫힌 파일을 미리 읽는 글(`parseFileToText`)과 편집기가 바꾸는 글의 범위가 다르면 다시 열고도 0곳일 수 있다. 엑셀 문서의 다시 열기는 이 PC 에 엑셀 처리 프로그램이 없어 시험하지 못했다.
- 시험: `packages/ui/tests/cheil-card-fill.test.ts`(바뀐 칸·비운 칸·짝·곳 수), `apps/shell/tests/cheil-campaign-store.test.ts`의 변경 전파 묶음(열린 탭만, 다른 캠페인 탭 제외, 남의 답 무시, 닿지 않는 탭, 탭 없음, 준비 신호를 기다림, 닫힌 문서 다시 열기·이전 값 없는 문서는 그대로·읽지 못한 문서와 열지 못한 문서는 '확인하지 못한 문서'), `apps/shell/tests/cheil-campaign-files.test.ts`(폴더로 캠페인 찾기, 겹치지 않는 파일 이름, 문서 세트가 폴더에 파일을 쓰고 그 파일을 엶), 화면 `e2e/cheil-campaign-set.spec.ts`(폴더에 파일이 생기고 탭이 그 파일을 보임, 열린 브리프·제안서의 예산 변경, 브리프를 저장하고 앱을 끈 뒤 다시 켜서 예산을 바꾸면 닫혀 있던 브리프가 다시 열려 바뀜).
  - 같은 실행 안에서 탭을 닫은 뒤의 변경: 시험 도구(Playwright)가 저장한 워드 탭이 닫힌 뒤 연결이 끊겨("Assertion error") 화면 시험으로 남기지 못했다. 앱 안 함수로 직접 확인한 한 번(10-26)은 닫힌 브리프가 다시 열려 1곳 바뀌었다(`reopened: true`).

## 5-6. 메일 초안 (공모전 수정 계획 6·7번, 10-26)

- 무엇: 캠페인 보기의 **'메일 초안'**에서 상황·받는 사람·강도를 고르고 '초안 쓰기'를 누르면 캠페인 이력을 바탕으로 제목과 본문이 나온다(AI 한 번). 고쳐서 '복사하고 기록'을 누르면 클립보드에 들어가고 타임라인에 "메일 초안(광고주용 · 자료 송부 · 단호하게): 제목"이 남는다.
  - 상황 6개: 자료 송부, 회신, 자료·확인 요청, 일정 조율·리마인드, 수정 반영 회신, 이슈 대응. 처음에는 타임라인의 마지막 일로 골라 둔다(채우기·문서 → 송부, 할 일 → 일정, 카드 수정 → 수정 반영, 메일 → 회신).
  - 받는 사람 2개: 광고주(합니다체, 문단, 서명 자리), 내부(개조식, 요청·담당·마감).
  - 강도 3단계: 부드럽게(완곡·부탁), 보통, 단호하게(마감과 영향, 회신 날짜를 못 박음, 무례한 말은 안 씀).
  - 사용자 결정(10-26): 계획의 '메일 양식 2종(스킬+문서 양식)' 대신 이 템플릿 방식으로 만듦.
- **사실은 AI 에 보내지 않는다.** AI 에는 상황·말투 지시와 자리표시 이름(`{캠페인명}` `{총예산}` `{받는분}` `{첨부문서}` …, 값이 빈 것은 뺌)만 보낸다. 최근 이력 8줄과 사람이 적은 '꼭 넣을 말' 속의 숫자·날짜는 앱이 `{값1}`처럼 바꿔 보낸다(`maskCheilValues`). 답이 오면 앱이 값을 되돌려 넣고, 모르는 자리표시는 `[확인 필요]`로 바꿔 몇 곳인지 알린다. 그래서 금액·비율·날짜·이름은 PC 밖으로 나가지 않고, 강도를 바꿔도 사실은 그대로다. 기밀 금지선(`cheil-grade.ts`)은 그대로 이 요청을 검사한다('대외비' 같은 표지가 있으면 막힘). 숫자가 그대로 든 같은 요청은 금지선에 막힌다는 것을 시험이 확인한다.
- 길: 화면 `MyCampaigns.tsx`의 `MailDraft` → 규칙 `packages/ui/src/cheil-mail-draft.ts`(`buildCheilMailPrompt`, `parseCheilMailDraft`, `suggestCheilMailSituation`) → 공용 `ai:chat`(JSON). 첨부 이름은 `cheil:campaign-documents`(캠페인 폴더의 워드·PPT·엑셀 파일 이름), 기록은 `cheil:campaign-mail-drafted`(상황·받는 사람·강도 코드를 뒷단이 다시 검사, `campaignMailText`, 사건 종류 `mail`). 둘 다 홈 화면만 부를 수 있다.
- 한계: 메일을 보내지는 않는다(복사까지). 편집기 안에서 채우기·수정·점검이 끝날 때 뜨는 단추는 아직 없다(캠페인 보기에서 쓴다). 실제 AI 로 쓴 초안의 품질은 확인하지 않았다(이 PC 의 가짜 서버로만 시험). 자리표시로만 쓰게 하므로 작은 모델이 자리표시를 빼먹거나 이름을 바꿔 쓸 수 있다(바꿔 쓴 것은 `[확인 필요]`).
- 시험: `packages/ui/tests/cheil-mail-draft.test.ts`(숫자 바꾸기, 보내는 글에 사실이 없음, 금지선 통과·원문은 막힘, 값 되돌리기, 상황 추천), `apps/shell/tests/cheil-campaign-store.test.ts`의 메일 기록·문서 이름 항목, 화면 `e2e/cheil-mail-draft.spec.ts`(가짜 OpenAI 호환 서버: 서버가 받은 글에 금액·광고주·이름·날짜가 없는지, 초안에 값이 들어갔는지, 복사·타임라인).

## 5-7. 내 양식 등록 ① 사본 + [칸] (공모전 수정 계획 13번, 10-26)

- 무엇: 홈 '내 양식' 줄의 **'내 양식 등록'**에서 예전에 쓴 보고서(워드·PPT·엑셀, **DRM 을 푼 파일**)를 고르면, 앱이 그 파일을 `문서\Cheil 양식\`에 그대로 복사하고 캠페인마다 바뀌는 값을 찾아 목록으로 보인다. 사람이 체크를 끄거나 칸 이름을 고치고, 직접 '찾을 글 → 칸 이름'을 더한 뒤 **'양식 만들기'**를 누르면 사본이 편집기 탭으로 열리며 그 값들이 모두 `[칸]`으로 바뀐다(AI 없이, 되돌리기 한 번, 저장은 사람이). **글꼴·위치·레이아웃·마스터는 원본 그대로**다(파일을 복사해 글자만 바꾸므로). 원본 파일은 건드리지 않는다.
  - 사용자 결정(10-26): 13번은 ① 사본 + [칸]과 ② 서식 뼈대 재사용만 만든다. 여러 문서에서 공통 서식 뽑기와 AI 모델 학습은 하지 않는다.
- 값 찾기 규칙(`packages/ui/src/cheil-my-template.ts`의 `findCheilTemplateBlanks`, AI 없음):
  - 항목·값 쌍: 표의 "광고주 | 가상전자", 줄의 "- 목표 KPI: 브랜드 인지도 30%". 항목 이름이 공통 칸(별칭 포함, "클라이언트" "집행 예산" "담당자" "작성일" 같은 보고서 말도)이면 그 칸 이름으로(`[광고주]` `[KPI]` …). 그래서 나중에 캠페인 카드가 그 칸을 채운다. 가운뎃점으로 나뉜 칸은 짝을 맞춘다("작성일 · 판 | 2026-10-26 · v2" → `[작성일]`, "작성 | 홍길동 · 비즈니스13팀" → `[작성자]`·`[팀명]`).
  - 그 밖의 금액·비율·날짜 → `[금액]` `[수치]` `[날짜]`. 항목 값 안에 든 숫자는 다시 내놓지 않는다. 여러 곳에 나오는 값은 모든 곳이 바뀌고(긴 값이 먼저), 몇 곳인지 보인다.
- DRM: 앱은 DRM 을 풀지 않는다. 글을 읽지 못하는 파일(DRM·암호·깨진 파일)은 사본을 남기지 않고 "DRM 이나 암호가 걸려 있으면 풀어서 다시 넣어 주세요"라고 알린다.
- 쓰기: 홈 카드는 양식 파일 자체를 연다(고칠 때). 캠페인의 **'문서 세트 만들기'에 내 양식이 함께 나오고**("내 양식" 표시), 고르면 그 양식의 사본이 캠페인 폴더에 만들어져 카드 값으로 공통 칸이 채워진다. 남은 칸은 공통 스킬 `cheil-my-template`(`apps/shell/resources/builtin-skills/cheil-my-template`)로 빠른 채우기가 된다. 한 번에 여는 양식은 10개까지.
- 길: 화면 `apps/shell/src/renderer/src/cheil/MyTemplates.tsx`, 저장소 `apps/shell/src/main/cheil/my-templates.ts`(파일 이름만 받고 경로는 받지 않음), 창구 `cheil:my-templates-list`·`-add`·`-apply`·`-discard`·`-open`(`campaign-ipc.ts`, 홈 화면만). 바꾸기는 5번의 카드 변경 길(`cheil:campaign-propagate`)을 그대로 쓰되 `purpose: 'template'`를 실어, 편집기 AI 창에 "내 양식으로 만들려고 값 N곳을 [칸]으로 바꿨습니다"가 남는다. 시험 실행은 `<userData>/Cheil 양식` 또는 `CHEIL_TEMPLATES_DIR`.
- 한계: 머리글·바닥글·도형 속 글처럼 편집기가 바꾸지 못하는 곳의 값은 남을 수 있다(목록에는 나와도 0곳). 엑셀 양식은 이 PC 에서 시험하지 못했다. 규칙이 못 찾은 본문 문장은 사람이 '찾을 글'로 더하거나 편집기에서 직접 비운다.
- 시험: `packages/ui/tests/cheil-my-template.test.ts`, `apps/shell/tests/cheil-my-templates.test.ts`(원본은 그대로·이름 겹침·읽지 못한 파일은 남기지 않음·홈만·경로 거절·바꾸기 요청), 화면 `e2e/cheil-my-template.spec.ts`(첫 실행에서 채운 브리프를 저장 → 다음 실행에서 내 양식 등록·직접 칸 더하기·[칸]으로 바뀐 사본·저장 → 문서 세트로 열면 카드 값이 다시 채워지고 직접 만든 칸은 남음).

## 5-7-2. 내 양식 ② 서식 뼈대 재사용 — PPT (공모전 수정 계획 13번, 10-26)

- 무엇: 내 PPT 양식을 캠페인 문서 세트로 열고 자료를 붙여 보내면, 양식의 **각 슬라이드를 견본**으로 써서 **내용에 맞는 장 수**의 덱을 만든다. 디자인(마스터·배치·글꼴·색)은 양식 그대로이고, AI 는 "몇 번 견본을 몇 번, 각 [칸]에 무슨 글"만 한 번에 답한다. 예: 12장 양식 → 표지·과제 2장·맺음, 4장.
  - 규칙(지시문): 견본 순서를 지키고, 내용이 많으면 같은 견본을 이어서 반복, 자료에 없는 견본은 건너뜀, 표지·맺음은 한 번, 30장까지, 칸의 글은 자료에 있는 사실만(없으면 `[확인 필요]`).
  - 앱(`packages/ui/src/cheil-deck-plan.ts`): 답을 견본과 그 견본의 칸으로만 걸러(`parseCheilDeckPlan`) 덱 연산을 만든다(`cheilDeckOps`): 견본 복제 → 끝으로 옮김 → **그 장 안에서만** 칸 바꾸기(`findReplace`의 `slideIndex`) → 마지막에 견본 지우기. PPT 연산 묶음은 실행 전 상태로 미리 검사하므로 복제와 옮기기는 다른 묶음으로 보낸다(마지막 견본의 복제본은 그 전에 없다). 모두 되돌리기 한 번.
  - 언제: 칩이 `cheil-my-template`(내 양식)인 PPT 탭의 빠른 채우기(`apps/slides/src/renderer/ai/AiPanel.tsx`의 `runCheilDeckPlan`). 내장 Cheil 양식은 예전처럼 칸만 채운다.
- 워드·엑셀: ①(사본 + [칸])만. 워드는 글이 흐르므로 길이가 달라도 서식이 그대로 이어지고, 표 행 반복 같은 뼈대 재사용은 만들지 않았다.
- 한계: 실제 AI 로 짠 덱의 품질은 확인하지 않았다(가짜 서버로만). 견본에 [칸]이 없는 고정 글(예: 목차 항목)은 그대로 복제된다. 슬라이드 노트는 복제되지 않는다(엔진의 복제 규칙).
- 시험: `packages/ui/tests/cheil-deck-plan.test.ts`, `apps/slides/tests/cheil-deck-plan-ops.test.ts`(실제 제안서 양식에 연산을 돌려 순서·채움·견본 지움 확인), 화면 `e2e/cheil-deck-skeleton.spec.ts`(문서 세트로 내 PPT 양식 → 보내기 → 12장 견본으로 4장, 같은 견본 두 번, 모델이 남긴 칸은 그대로).

## 5-8. 옵시디언 연계 (사용자 요청, 10-26)

- 무엇: '내 캠페인' 줄의 **'옵시디언 연결'**로 볼트 폴더를 고르면, 그 볼트의 `Cheil` 폴더에 캠페인이 노트로 쌓이고 캠페인이 바뀔 때마다 따라 바뀐다. 누르면 끊는다(이미 쓴 노트는 남음).
  - `Cheil/<캠페인>/<캠페인>.md`: 앞머리(광고주·기간·태그 `cheil/campaign`), 카드 표, 문서·메일 노트 링크(`[[Cheil/<캠페인>/문서/<제목>|<제목>]]`), 타임라인. 카드·타임라인이 바뀌면 0.8초 뒤 다시 쓴다(`campaign-store`의 `onChange`).
  - `Cheil/<캠페인>/문서/<제목>.md`: 캠페인 폴더의 워드·PPT·엑셀 문서 글을 마크다운으로(표 → 마크다운 표, 제목·항목 유지). 저장된 시각이 바뀐 문서만 다시 읽는다.
  - `Cheil/<캠페인>/주고받은 메일.md`: '받은 메일 → 할 일'에서 할 일을 기록한 메일 원문과, '메일 초안'에서 복사한 초안을 날짜 제목으로 이어 붙인다(덮어쓰지 않음).
  - `Cheil/내 양식/<제목>.md`: 내 양식으로 등록한 보고서의 원문(칸으로 바꾸기 전).
- 볼트는 이 PC 의 폴더다. 앱이 밖으로 보내는 것은 없다. 볼트를 클라우드로 동기화하면 그 서비스로 가는 것은 사람의 설정이다. 볼트 위치는 `<userData>/cheil-settings.json`의 `obsidianVault`.
- 캠페인·문서 노트는 통째로 다시 쓰므로 사람이 그 노트에 적은 것은 다음 변경 때 사라진다(메일 노트는 이어 붙이기만). 노트 모양은 일반 옵시디언 형식이다. 사용자의 `wiki` 스킬(협의 단위 노트)과 맞추려면 그 예시 노트를 받아 고친다(확인 필요).
- 길: `apps/shell/src/main/cheil/obsidian.ts`(Electron 없음), 창구 `cheil:obsidian-get`·`-pick`·`-clear`, 화면 `MyCampaigns.tsx`의 `ObsidianLink`. 시험: `apps/shell/tests/cheil-obsidian.test.ts`, `e2e/cheil-my-template.spec.ts`의 볼트 확인(내 양식 원문 노트, 문서 세트 뒤의 캠페인 노트와 문서 노트).

## 5-9. 업무 도구 (사용자 요청, 10-26)

- 무엇: 홈 왼쪽 메뉴의 **'업무 도구'** 묶음. 캠페인과 상관없이, 다른 웹사이트에 들어가서 하던 일을 앱 안에서 한다. 누르면 홈 본문이 그 도구로 바뀐다(다른 메뉴를 누르면 돌아감).
  - **메일 초안**: 5-6절의 메일 초안을 캠페인 없이도. '캠페인'에서 고르면 카드 값·최근 이력이 들어가고 복사하면 그 타임라인에 남는다. '캠페인 없이 쓰기'는 보내는 사람·받는 분·오늘 날짜와 '꼭 넣을 말'만으로 쓰고 기록하지 않는다.
  - **맞춤법·글자수**: 입력하는 대로 공백 포함·제외 글자 수, 바이트(한글 2, 마우스를 올리면 UTF-8), 원고지 200자 매수(줄바꿈 한 칸). 맞춤법은 ① 이 PC 의 규칙(`tools/text-tools.ts`: 어디서나 틀린 말만 — 몇일→며칠, 됬→됐, 드릴께→드릴게, 검토후→검토 후, 할수 있→할 수 있 등, 뜻에 따라 다른 결재/결제·로서/로써는 넣지 않음)을 바로 표시하고 '모두 고치기', ② 'AI로 자세히 보기'(AI 한 번, 숫자·날짜는 `{값N}`으로 바꿔 보냄, 원문에 실제로 있는 구절만 고치기 후보로).
  - **금액·부가세**: "5억 2,000만원"·"520,000,000" 같은 금액 → "일금 오억이천만원정 (₩520,000,000)"(십·백·천 앞의 일을 남기는 견적서 표기). 부가세: 공급가액이면 10%(원 미만 버림), 합계(VAT 포함)면 공급가액 = 합계÷1.1 반올림, 나머지가 부가세(셋의 합이 늘 맞음).
  - **날짜 계산**: D-day와 요일, 몇 주차(ISO·월), 기간의 일수·영업일(주말·공휴일 제외, 뺀 공휴일 목록), 영업일 더하기·빼기. 공휴일 표는 **2025·2026년만**(대체공휴일·선거일 포함, `tools/number-tools.ts`의 `HOLIDAYS`). 표가 없는 해는 주말만 빼고 화면에 "공휴일 표가 없어 주말만 뺐습니다"라고 알린다. 2027년 이후는 정부 발표를 보고 표에 더할 것(확인 필요).
  - **번역**: 한국어·영어·일본어·중국어(간체), 업무 문체/자연스럽게. AI 한 번, 숫자·날짜는 앱이 지킨다.
  - **PDF 도구**: 원본의 PDF 도구 창을 연다.
- 보안: 글자 수·규칙 맞춤법·금액·날짜는 PC 밖으로 아무것도 보내지 않는다. AI 를 쓰는 셋(메일·AI 맞춤법·번역)은 공용 `ai:chat`이라 기밀 금지선을 지나고, 숫자·날짜는 보내지 않는다. 그래도 '대외비' 같은 표지가 있으면 막힌다.
- 코드: 화면 `apps/shell/src/renderer/src/cheil/WorkTools.tsx`(`WorkToolsNav`, `WorkToolView`), 규칙 `cheil/tools/text-tools.ts`·`number-tools.ts`·`ai-tools.ts`, 홈 배선 `Home.tsx`의 `toolMode`. 메일 부품은 `MyCampaigns.tsx`의 `MailDraft`(캠페인 `null` 허용)를 같이 쓴다. 문구는 한국어 + 영어.
- 한계: 규칙 맞춤법은 전문 맞춤법 검사기만큼 잡지 못한다(나머지는 AI 몫, 실제 AI 품질은 확인 필요). 원고지 매수는 대략값이다.
- 시험: `apps/shell/tests/cheil-work-tools.test.ts`(글자 수, 규칙이 맞는 글을 건드리지 않음, 금액 읽기·한글 금액·부가세, 2026 추석 낀 영업일, 표 없는 해 알림, AI 도구의 숫자 가리기), 화면 `e2e/cheil-work-tools.spec.ts`(왼쪽 메뉴의 6개를 차례로: 맞춤법 규칙·AI, 금액·부가세, 영업일, 번역, 캠페인 없는/있는 메일, PDF 창. 가짜 AI 서버가 받은 글에 금액·날짜·이름이 없는지).

## 6. 자동 업데이트 끔

- 설치본이 원본 릴리스를 업데이트로 받으면 이음오피스로 바뀐다. `apps/shell/src/main/cheil-update-policy.ts`가 끈다. '업데이트 확인'은 원본 내려받기 쪽을 열지 않는다. 새 판은 새 설치 파일로 나눈다.

## 7. 빌드와 시험 (이 PC 기준)

- 도구(2026-10-23 설치): Rust 1.99.1(rustup, 기본 `stable-x86_64-pc-windows-msvc`, `~/.cargo`), Visual Studio 2022 Build Tools(C++ 도구 MSVC 14.44 + Windows SDK 10.0.26100). Rust 만으로는 안 된다: IronCalc 가 bzip2·zstd 를 C 소스로 끌어와 C 컴파일러가 필요하고, Rust GNU 도구 묶음의 `dlltool`은 어셈블러가 없어 동작하지 않았다.
- `cargo`가 PATH 에 없으면 `$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`(새로 연 터미널에는 들어 있다).
- 엑셀 처리 프로그램: `npm run native:build -w @genoffice/sheets` → `apps/sheets/native/xlsx-engine/target/release/xlsx-sidecar.exe`(약 9MB, 첫 빌드 5분 반). 설치 파일 설정은 `target/x86_64-pc-windows-gnu/release/`에서 찾으므로 그리로 복사해 둔다(원본 `docs/engineering-notes.md`와 같은 방법).
- 전체 빌드: `npm run build:all`. 설치 파일: `npm run dist:win -- -- --publish never` → `apps/shell/release/CheilOffice-Setup-<판>.exe`. 서명 없음.
- 실행(개발판): `oce/Cheil기획오피스_실행.cmd` 또는 `npx electron apps/shell`.
- 포크 시험:
  - `packages/ai-provider/tests/cheil-ollama.test.ts`, `cheil-grade.test.ts`
  - `apps/shell/tests/updater.test.ts`의 "Cheil fork" 묶음
  - 화면: `npx playwright test --config e2e/playwright.config.ts e2e/cheil-office.spec.ts`(홈 카드·브리프 채워 두기·미디어 플랜 엑셀 열기)
  - 실제 Ollama(느림): `CHEIL_REAL_OLLAMA=1`로 `e2e/cheil-ollama-real.spec.ts`
- 원본 시험 중 '새 설정 = 자동'을 전제로 한 공용 AI 창 시험은 `packages/ui/tests/cheil-upstream-defaults.ts`의 원본 기본값으로 돌린다.
