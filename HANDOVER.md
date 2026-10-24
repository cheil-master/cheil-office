# 인수인계 — Cheil 기획 오피스 (2026-10-25 기준)

다음 개발자(Codex 등)가 이 파일 하나로 이어받을 수 있게 정리했다. 바꾼 것의 상세 목록은 `CHEIL.md`, 원본 규칙은 `AGENTS.md`(= `CLAUDE.md`), 분석·시험 기록은 `../자료/Cheil기획오피스_분석과_변경_20261023.md`.

## 1. 무엇을 만드는가

- 광고대행사(제일기획) 기획 AE 가 쓰는 데스크톱 오피스. 오픈소스 **이음오피스**(https://github.com/pblsketch/openoffice, Apache-2.0, GenOffice 포크, Electron)를 고친 사본이다.
- 사용자가 원하는 것: **목적에 맞는 서식(양식)을 고르면, 그 서식대로 AI 가 문서를 채워 주는 오케스트레이터.** 문서는 실제 워드·PPT·엑셀 파일이고, AI 는 이 PC 의 sLLM(Ollama)이 기본이다.
- 이 폴더의 위쪽(`../src`, `../dist`, `../site` = v0.5.0, `../platform` = Next.js PRD 판)은 **멈춘 이전 시도**다. 지우지 말고 건드리지 않는다.

## 2. 사용자(요청하는 사람)

- 기획 AE, AI TF. 비개발자. **한국어로 직설적으로.** 코드 설명보다 "뭐가 되고 뭐가 안 되는지".
- **지어내기를 매우 싫어한다.** 확인 못 한 건 "확인 필요". 시험을 안 돌렸으면 "됐다"고 하지 않는다.
- 보고는 맨 위에 **된 것 · 안 된 것 · 사용자가 할 일 하나**, 자세한 건 파일로.
- 기본값은 직접 정하고 진행하길 원한다(질문지 방식 싫어함). 다만 설치·약관 동의·밖으로 보내는 일은 먼저 묻는다.
- 오케스트레이션(흐름) 변경은 그림·클릭 시안으로 먼저 보여 주는 것을 좋아한다.
- 시험 자료는 가상 이름만: 가상전자, 에어린, 블루윈드, 오로라7. 실제 회사·광고주·제품 이름 금지.

## 3. 지금 상태

### 된 것 (시험으로 확인함)

| 항목                                                                                                                                                                                                            | 확인 방법                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 'Cheil 기획 오피스'로 이름·아이콘·색 바꿈, 이음오피스와 데이터 폴더·설치 ID·파일 연결이 안 겹침                                                                                                                 | `apps/shell/tests/product-identity.test.ts` 등 통과         |
| 기본 AI = 이 PC 의 Ollama(새 제공자 `ollama`)                                                                                                                                                                   | `packages/ai-provider/tests/cheil-ollama.test.ts`           |
| 이 PC 밖 AI(구독 포함)로 광고주 기밀·개인정보가 나가면 막음                                                                                                                                                     | `cheil-grade.test.ts`                                       |
| 홈 '광고 문서 양식' 카드 6장 → 양식 사본이 새 탭으로 열리고 AI 창에 요청이 **보내지 않은 채** 채워짐                                                                                                            | `e2e/cheil-office.spec.ts`                                  |
| **양식 빠른 채우기**(sLLM 한 번 호출) — 워드 브리프 5분 27초(25칸 중 18칸 + 7칸 `[확인 필요]`), PPT 제안서 13분 43초(68칸 중 44칸 + 24칸), 엑셀 미디어 플랜 3분 57초~5분 51초(견적 3줄 → 표 3줄, 계산식 그대로) | `e2e/cheil-ollama-real.spec.ts`(실제 Ollama, 3개 모두 통과) |
| 엑셀 처리 프로그램(Rust `xlsx-sidecar`) 빌드, 엑셀 양식 열기                                                                                                                                                    | 엑셀 처리 프로그램 시험 32개, `e2e/cheil-office.spec.ts`    |
| Windows 설치 파일 `apps/shell/release/CheilOffice-Setup-0.12.3.exe`(188MB, 서명 없음)                                                                                                                           | `e2e/cheil-packaged.spec.ts`(설치본 내용물로 홈·엑셀 열기)  |
| 자동 업데이트 끔(원본 릴리스로 바뀌는 것을 막음)                                                                                                                                                                | `apps/shell/tests/updater.test.ts`의 "Cheil fork" 묶음      |

### 안 된 것·주의

- **설치 파일이 낡았다.** 10-23 04:25 에 만든 것이라 엑셀 미디어 플랜 빠른 채우기(10-23 오전)가 **없다.** 다시 만들기(`npm run dist:win -- -- --publish never`)를 돌리다 세션이 끊겼다. 그 여파로 워드 편집기 빌드가 깨졌던 것은 10-25 에 다시 빌드해 고쳤다.
- 2026-10-25 까지의 모든 변경은 `cheil` 갈래의 **기준선 커밋 하나**(`feat: Cheil 기획 오피스 …`, 원본 `upstream` 의 `5fda829` = v0.12.3 위)에 들어 있다. 원본과의 차이는 `git diff 5fda829 HEAD`. 푸시한 원격은 없다(원격 `upstream`은 원본 저장소라 푸시 금지).
- 설치 파일 서명 없음 → 회사 PC 정책(스마트 앱 컨트롤, AppLocker)에 막히는지 **확인 필요**. 이 PC 에 설치해 보지도 않았다.
- PPT 실제 시험 중 한 번, 시작 40초쯤 PPT 화면이 닫혔다. 원인 못 찾음(충돌 기록 없음). 다시 돌리면 통과.
- 채운 내용의 흠(모델 품질): 표지 제목에 "캠페인명 [확인 필요]"처럼 칸 이름까지 붙임, '가상전자'를 광고주 칸이 아닌 브랜드 칸에 넣음, 메모 날짜를 작성일로 씀. 같은 입력에도 실행마다 결과가 조금 다르다.
- 빠른 채우기 중 '중지'를 눌러도 이미 보낸 모델 호출은 끝까지 돈다.
- 아직 원본 이름이 남은 곳: 명령어 `ieumoffice`(설치하면 사용자 PATH 에 들어감 → 이음오피스와 같이 깔면 겹침), `~/.ieumoffice`, 설정 → 정보의 저장소 주소·문의 메일(원본을 가리킴), `README.md`·`PRIVACY.md`·`docs/` 대부분(원본 설명 그대로). 판 번호도 원본의 0.12.3.
- 새 화면 문구(홈 양식 카드, 채우기 요약)는 한국어 + 영어만. 원본 규칙(21개 언어)에서 벗어남 — 사내용이라 받아들임.
- 기밀 검사는 규칙 판정이라 놓치는 것이 있고, 웹 검색처럼 밖으로 나가는 도구의 검색어는 검사하지 않는다.

## 4. 핵심 설계 (어디를 보면 되나)

### 4-1. AI 엔진: Ollama

- `packages/ai-provider/src/protocols/ollama.ts` — 네이티브 `/api/chat`. OpenAI 호환 `/v1`은 `num_ctx`를 무시해 4,096 토큰으로 잘렸다(직접 시험). `num_ctx` 16384, `keep_alive` 30m, qwen3 류는 `think:false`. 첫 응답까지 최대 10분 대기, 열려 있는 동안 15초마다 `onActivity`(화면 쪽 4분 무응답 감시 대응). 단발 호출(`chatOllama`)은 내부적으로 흘려받고 `json:true`면 `format:'json'`.
- 등록: `types.ts`(AiProviderId), `providers.ts`(기본 제공자 `ollama`, 주소 `http://127.0.0.1:11434`, 모델 `gemma4:e4b`), `registry.ts`, `stream.ts`, `chat.ts`(6번째 인자 `{ json }`).
- 홈 왼쪽 아래 표시: `apps/shell/src/renderer/src/cheil/local-engine.ts`("이 PC의 AI · Ollama · gemma4:e4b").

### 4-2. 금지선: 기밀은 이 PC 밖으로 안 나감

- `packages/ai-provider/src/cheil-grade.ts` — 예전 v0.5.0 의 `../src/js/30_grade.js` 규칙을 옮김(대외비·극비·코드명·메일 머리·가명화·개인정보·숫자 표·신호 조합). `streamForProvider`·`chatForProvider` 에서 받는 곳이 127.x/localhost/::1 이 아니면 사용자 글·문서 내용·도구 결과를 검사하고 광고주 기밀 이상·개인정보면 거절. **설정으로 열 수 없게** 둔다(사용자 금지선).

### 4-3. 양식 스킬과 홈 카드

- 스킬 7종: `apps/shell/resources/builtin-skills/cheil-*`(원칙 1 + 양식 6). 양식 문서는 `python -I tools/cheil/make_templates.py`로 다시 만든다(맑은 고딕, 예시 숫자 없이 `[칸]`만). **칸 이름은 문서 안에서 모두 달라야 한다**(같은 글이면 찾아 바꾸기가 엉뚱한 칸까지 바꿈). 예외: 제안서 표지·맺음의 `[팀명]`.
- 홈 카드: `apps/shell/src/renderer/src/cheil/AgencyTemplates.tsx`. 넘겨주기에 `prefill` 표시를 더해 새 탭이 보내지 않고 기다리게 했다(`packages/electron-utils/src/{user-skills-channels,generate-handoff}.ts`, `apps/shell/src/main/user-skills/template-tabs.ts`, `packages/ui/src/{skill-template-model.ts,use-skill-templates.tsx}`). 칩의 `inPlace`(`skill-picker-model.ts`, `use-composer-skills.tsx`)는 "이 문서가 양식 사본이니 새 탭을 또 열지 말라"는 뜻.

### 4-4. 양식 빠른 채우기 (오케스트레이션의 중심)

범용 도구 반복(모델→도구→모델)은 CPU 노트북의 작은 모델로 24단계·28분을 돌고도 문서를 못 바꿨다. 그래서 **오케스트레이션은 앱이, 글은 sLLM 이** 하도록 바꿨다.

1. 앱이 문서에서 칸을 뽑는다.
2. 모델에게 요청·첨부 자료·칸 목록을 주고 JSON 하나로만 답하게 한다(자료에 없으면 `[확인 필요]`).
3. 앱이 편집기 자신의 연산으로 쓴다(되돌리기 가능).

| 편집기 | 공용 모듈                             | 연결 지점                                                | 쓰는 방법·주의                                                                                                                                                                                                                                               |
| ------ | ------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 워드   | `packages/ui/src/cheil-fill.ts`       | `apps/docs/src/renderer/ai/AiPanel.tsx` `runCheilFill`   | `executeOps` 의 `findReplace` + 표 안 칸은 `cheil-fill-docs.ts` `replaceLeftoverBlanks`(원본 `findReplace`가 최상위 문단만 훑기 때문)                                                                                                                        |
| PPT    | 같은 모듈                             | `apps/slides/src/renderer/ai/AiPanel.tsx` `runCheilFill` | `slidesApi.applyTxn` 의 `findReplace`. **한 트랜잭션 최대 50개** → 50개씩 나눠 보냄. preload 에 `aiChat` 추가                                                                                                                                                |
| 엑셀   | `packages/ui/src/cheil-sheet-fill.ts` | `apps/sheets/src/renderer/App.tsx` `runCheilSheetFill`   | A1:L40 을 읽어 셀 글 속 `[칸]` + '입력 표'(머리 행 아래 빈 줄, 합계 행에서 멈춤)를 찾음. 계산식 열(CPM 등)은 안 씀. 모델은 `T1:[{열이름:값}]`. `set_cell`로 쓰고 숫자는 숫자, YYYY-MM-DD 는 엑셀 날짜. 엑셀 채널 스키마(`aiChatRequestSchema`)에 `json` 추가 |

발동 조건: 요청에 Cheil 양식 스킬 칩(`builtin:cheil-*`, 원칙 스킬 제외)이 있고 문서에 칸이 있을 때. 칸이 없으면 원래 도구 반복으로 돈다.

### 4-5. 그 밖

- 자동 업데이트 끔: `apps/shell/src/main/cheil-update-policy.ts`(시험에서는 모듈을 가짜로 바꿔 원본 경로도 검사).
- 원본 시험 중 '새 설정 = 자동'을 전제로 한 것은 `packages/ui/tests/cheil-upstream-defaults.ts`, `apps/shell/tests/cheil-upstream-defaults.ts` 의 원본 기본값으로 돌린다.
- 고친 코드에는 `Cheil fork:` 주석이 있다. `git grep -n "Cheil fork"`로 전부 찾을 수 있다.

## 5. 이 PC 환경 (2026-10-25)

- Windows 11 Enterprise, i5-1135G7, 메모리 16GB, **외장 GPU 없음 → Ollama 가 CPU 로만 돈다.** 지시문 읽기 초당 약 35토큰, 글쓰기 약 8토큰.
- Node 24.19.0, npm 11.17.0, Python 3.12.10(python-pptx·python-docx·openpyxl 있음), Git.
- Rust 1.99.1(rustup, `~/.cargo`, 기본 `stable-x86_64-pc-windows-msvc`, GNU 묶음도 깔려 있음). 새 터미널이 아니면 `$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`.
- Visual Studio 2022 Build Tools(MSVC 14.44, Windows SDK 10.0.26100). 설치 후 재부팅은 안 했다(빌드는 됨).
- Ollama 0.40.8: `gemma4:e4b`(기본), `qwen3:4b`, `bge-m3`.
- `npm ci` 때 npm 11 의 allow-scripts 로 esbuild·protobufjs·electron-winstaller 설치 스크립트가 건너뛰어졌지만 빌드·실행에 문제 없었다.

## 6. 명령

```powershell
cd cheil-office
# 편집기 하나 빌드 (docs, sheets, slides, pdf, markdown, html, mindmap, hwp, cli)
npm run build -w @genoffice/docs
# 편집기 뒷단(apps/*/src/main)·공용 패키지를 고쳤으면 껍데기도 다시
npm run build -w @genoffice/shell
# 전부 (엑셀 처리 프로그램 포함)
npm run build:all
# 엑셀 처리 프로그램만
npm run native:build -w @genoffice/sheets
# 설치 파일 (먼저 target/release/xlsx-sidecar.exe 를 target/x86_64-pc-windows-gnu/release/ 로 복사)
npm run dist:win -- -- --publish never
# 개발판 실행
npx electron apps/shell        # 또는 ..\Cheil기획오피스_실행.cmd
```

시험:

```powershell
npm run typecheck -w @genoffice/<이름>
cd packages/ui; npx vitest run            # 작업 공간별로 (npm test 는 첫 실패에서 멈춤)
npx playwright test --config e2e/playwright.config.ts e2e/cheil-office.spec.ts
$env:CHEIL_REAL_OLLAMA='1'; npx playwright test --config e2e/playwright.config.ts e2e/cheil-ollama-real.spec.ts   # 실제 Ollama, 합쳐 30분 안팎
$env:CHEIL_PACKAGED='1'; npx playwright test --config e2e/playwright.config.ts e2e/cheil-packaged.spec.ts        # dist:win 뒤
```

마지막 결과: AI 연결 패키지 1,223개 중 1,222 통과, 공용 UI 812개 통과, 엑셀 처리 프로그램 시험 32개 통과, Cheil 화면 시험·실제 Ollama 시험 모두 통과.
알려진 실패(이번 변경과 무관해 보이나 원본에서도 나는지는 확인 안 함): `ai-settings-guard`(Windows 경로 이어 붙이기), 껍데기의 `file-index-scan`·`folder-tree`(Windows 심볼릭 링크 권한), `headless-export` 16개(리눅스식 경로), `default-app`의 리눅스 앱 이름 1개, 부하 중 시간 초과(`detached-windows`, `mcp-http-surface`, `third-party-notices`).

## 7. 걸리기 쉬운 것

- 중단된 빌드는 `out/preload` 를 비운 채 남길 수 있다 → 편집기 화면이 하얗다. 그 앱을 다시 빌드.
- preload 를 고치면 그 앱을, 편집기 뒷단을 고치면 껍데기까지 다시 빌드해야 반영된다(원본 `docs/engineering-notes.md`).
- 엑셀 화면은 격자와 수식 입력줄이 캔버스라 글자로 읽을 수 없다. 화면 시험은 이름 상자(`input[class*="univer"]`)에 범위를 넣고 Ctrl+C → `app.evaluate(({clipboard}) => clipboard.readText())`로 셀을 읽는다.
- 설치본은 `GENOFFICE_USER_DATA`를 무시한다 → 시험할 때 `--user-data-dir=<임시 폴더>`.
- 셸 명령 안에 파이썬·heredoc 으로 TS 코드를 넣으면 `'\n'` 같은 이스케이프가 실제 줄바꿈으로 바뀐 적이 여러 번 있다. 코드 수정은 편집 도구로 직접 하는 편이 안전하다.
- 원본 규칙: 내부 이름(`@genoffice/*`, `GENOFFICE_*`)을 바꾸지 않는다. 문서 엔진 패키지(`docx-engine`, `pptx-*`, `xlsx-gateway`, `xlsx-engine` 등)는 고치지 않는다(필요하면 사람에게 먼저 묻기). LICENSE·NOTICE·"GenOffice/이음오피스를 바탕으로" 고지를 지우지 않는다. NOTICE 에 Cheil 고지를 더해 두었다.
- 구독(Claude Code·Codex)으로 가는 시험은 사용자 한도를 쓴다. 화면 시험은 기본이 Ollama 라 괜찮지만, 구독을 고르는 시험을 만들면 `e2e/helpers.ts`의 `stubAiReady`를 쓴다.

## 8. 다음 할 일 (추천 순서)

1. **설치 파일 다시 만들기**(엑셀 빠른 채우기 포함) → `CHEIL_PACKAGED=1` 시험 → 동료 PC 한 대에 깔아 회사 보안 정책에 막히는지 확인(사용자 몫).
2. (끝남, 10-25) 기준선 커밋. 앞으로의 변경은 작게 나눠 커밋하고, 푸시는 사용자에게 묻는다(이 PC 에는 git 작성자 설정이 없어 첫 커밋은 `-c user.name/-c user.email`로 그 커밋에만 넣었다).
3. 이름 마무리: 명령어 `ieumoffice`→`cheiloffice`(+`~/.cheiloffice`, 도움말 925곳, 설치 PATH), 설정 → 정보의 저장소·문의 메일, `README.md`.
4. 빠른 채우기 품질: 칸 이름을 값에 붙이지 않기, 광고주/브랜드 구분, 날짜 추정 금지를 지시문(`buildCheilFillPrompt`)에 넣거나 후처리. 실행마다 흔들리는 정도를 2~3번 돌려 비교.
5. 빠른 채우기 '중지'(AbortSignal 을 `ai:chat`까지).
6. 속도: 지시문 줄이기(스킬 본문 길이), 다른 모델 비교, GPU PC 에서 측정.
7. PPT 화면이 닫힌 일 재현 감시(`e2e/cheil-ollama-real.spec.ts`에 닫힘·충돌 기록을 남기게 해 둠).
8. 엑셀 스캔 범위 A1:L40 고정 → 큰 양식이면 늘리기.
9. 사용자가 좋아하는 '그림 먼저': 문서마다 어떤 단계·엔진이 도는지 보여 주는 오케스트레이션 화면(아직 없음).
