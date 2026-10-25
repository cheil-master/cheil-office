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

- 무엇: 캠페인 보기의 **'문서 세트 만들기'**에서 양식을 고르고(기본: 브리프·제안서·미디어 플랜) '선택한 양식 열기'를 누르면, 양식마다 새 탭이 열리고 카드 값이 공통 칸에 **AI 없이** 바로 들어간다. AI 창 입력란에는 요청과 `[캠페인 카드]` 줄이 보내지 않은 채 기다리고, 나머지 칸은 자료를 붙여 보내면 빠른 채우기(5-1절)가 채운다. 타임라인에 "문서 세트를 열었습니다: …" 한 줄이 남는다.
- 흐름: 화면은 양식 이름과 요청 글만 보낸다(`cheil:campaign-open-set`, 홈 화면만). 뒷단이 **저장된 카드**에서 공통 칸 값을 다시 만들고(`cheilFieldValues`, 작성일은 오늘), 홈 양식 카드와 같은 양식 열기 길(`templateTabs.openTemplate`)에 그 값을 넘겨주기의 `cheil` 칸으로 싣는다. 화면이 값을 지어 보낼 길은 없다(넘겨주기 IPC 는 `cheil`을 받지 않는다).
- 편집기: 넘겨받은 패널이 문서가 열릴 때까지 기다렸다가(250ms 간격, 최대 30초) 문서의 칸 가운데 공통 칸(별칭 포함, `cheilCardReplacements`)을 바꾼다. 워드 `replaceLeftoverBlanks`(표 안까지, 되돌리기 한 번), PPT 덱 `findReplace`(50개씩), 엑셀 `cheilCardSheetWrites` → `set_cell`(되돌리기 한 번). 패널에 "캠페인 '…' 카드로 공통 칸 N개를 채웠습니다(AI 없이)"가 남는다.
- 카드에 비어 있는 칸은 그대로 `[칸]`으로 남아 빠른 채우기가 채우거나 `[확인 필요]`로 둔다. 기간의 한쪽만 있으면 다른 쪽은 `[확인 필요]`.
- 코드: 규칙 `packages/ui/src/cheil-fields.ts`(`cheilCardFillOf` 넘겨주기 읽기, `cheilCardReplacements`, `cheilCardSummary`, `cheilCardFillNote`)·`cheil-sheet-fill.ts`(`cheilCardSheetWrites`), 넘겨주기 `packages/electron-utils/src/generate-handoff.ts`(`SkillHandoff.cheil`)·`packages/ui/src/skill-template-model.ts`·`use-skill-templates.tsx`(`prefill`의 세 번째 인자), 편집기 `fillFromCampaignCard`(워드·PPT `AiPanel.tsx`, 엑셀 `App.tsx`), 뒷단 `campaign-ipc.ts`(`campaignSetItemsOf`), 화면 `MyCampaigns.tsx`의 `DocumentSet`, 양식 목록 `apps/shell/src/renderer/src/cheil/templates.ts`(홈 카드와 함께 씀).
- 시험: `packages/ui/tests/cheil-card-fill.test.ts`, `skill-template-model.test.ts`의 Cheil 항목, `apps/shell/tests/cheil-campaign-store.test.ts`의 문서 세트 항목, 화면 `e2e/cheil-campaign-set.spec.ts`(브리프·제안서. 미디어 플랜은 엑셀 처리 프로그램이 있는 PC 에서만 돈다).
- 아직: 저장 위치는 지금처럼 첫 저장 때 묻는다(캠페인 폴더로 바로 저장은 5번 '변경 전파'와 함께).

## 5-4. 자동 기록 (공모전 수정 계획 3번, 10-26)

- **채우기 기록**: 캠페인의 문서 세트로 연 탭에서 카드 채우기·빠른 채우기가 끝나면 타임라인에 한 줄이 저절로 남는다("크리에이티브 브리프: 캠페인 카드로 공통 칸 10개를 채움", "…: 빠른 채우기 — 양식 칸 19개 중 17개를 자료로 채움, 2개는 [확인 필요]"). 문서 세트를 열 때는 "문서 세트를 엽니다: …"가 먼저 남고, 열지 못한 양식이 있으면 그 줄도 남는다.
  - 길: 편집기는 끝난 채우기의 숫자만 보낸다(`cheilRecordFill` → 공용 다리 `aiOfficeUserSkills.cheilRecord` → `cheil:campaign-record`). 뒷단은 **보낸 탭의 webContents** 로 캠페인과 양식 이름을 찾는다(`index.ts`의 `cheilCampaignTabs`, 문서 세트가 연 탭만, 탭이 닫히면 지움). 탭이 캠페인을 지정할 수는 없고, 다른 탭의 보고는 무시한다. 문장은 뒷단이 만든다(`campaignRecordText`).
  - 열린 캠페인 보기는 3초마다 타임라인을 다시 읽어 탭이 남긴 줄을 보여 준다.
- **받은 메일 → 할 일**: 캠페인 보기의 '받은 메일 → 할 일'에 메일을 붙여넣고 '할 일 뽑기' → AI 한 번(공용 `ai:chat`, 금지선 검사를 거친다, `json`) → 할 일·담당·마감 목록 → **사람이 고치고 고른 것만** '선택한 할 일 기록'으로 타임라인 '할 일' 줄(마감 표시)이 된다. 기록 전에는 아무것도 남지 않는다. 지시문은 "메일에 적힌 것만, 날짜가 확실하지 않으면 빈칸"(`packages/ui/src/cheil-mail.ts`의 `buildCheilTaskPrompt`), 답은 앱이 다시 검사한다(`parseCheilTasks`: 한 줄, 실재하는 날짜만, 중복 제거, 20개까지). 뒷단도 다시 검사한다(`campaignTasksOf`).
- 메일 초안·보내기 전 점검·수정 반영(6~10번)의 기록은 그 기능과 함께 같은 길(`record`, 사건 종류 `mail check revise`)로 붙인다.
- 시험: `packages/ui/tests/cheil-mail.test.ts`, `apps/shell/tests/cheil-campaign-store.test.ts`(탭 보고·다른 탭 무시·잘못된 보고·할 일 기록), 화면 `e2e/cheil-auto-record.spec.ts`(이 PC 의 가짜 OpenAI 호환 서버로 빠른 채우기와 메일 읽기), `e2e/cheil-campaign-set.spec.ts`의 타임라인 줄.

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
