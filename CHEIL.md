## 2026-10-29 Pinterest 레퍼런스 → 의미 기반 PPT 생성 연결

사용자가 거부한 OCR 영역 채우기 방식을 새 생성 흐름의 기본 경로에서 제외했다. 홈 스타일 화면 위에 DesignStudio를 추가하고, 기존 로컬 추출 UI는 접힌 영역으로 보존했다. 보드에서 선택한 1~2개 이미지와 초안을 Slides의 기존 전송 관문에 넘긴다. 이미지 이해 모델은 define_reference_style로 위계·여백·도형 역할·표지/비교/과정 레시피를 MD로 저장하고, 선택된 스타일을 generate_deck에 전달한다. 저장 목록 재사용과 MD 가져오기/열기를 지원한다. 문서 엔진 변경·외부 스크래퍼·새 Pinterest API 없음.

개발 검증용 프로필에 AI 제공자가 없어 실제 모델의 Pinterest 분석 품질은 아직 미검증이다. 직접 작성한 3장 샘플은 네이티브 PPT 생성·앱 PDF 렌더링으로 시각 검수했으며 AI 자동 생성 결과와 구분한다. 설계·사용법·파일 형식·제한은 docs/cheil-design-studio.md를 따른다. 설치·커밋·푸시 없음.

## 2026-10-29 레퍼런스 이미지 → 실행 가능한 구조 MD

사용자의 목적은 색상표나 원본 이미지 복제가 아니라 텍스트 위계·도형·배치 관계를 재사용하는 문서 규칙이다. 첫 버전으로 로컬 시스템 OCR 위치와 단색 도형 연결 영역을 분석해 구조 MD를 만드는 기능을 추가했다. 외부 모델 호출·계정/키 변경·새 의존성은 없다. 의미 이해나 원본 글꼴 판별은 하지 않는다.

홈 → 내 양식 → 스타일만 추출에서 **이미지에서 구조 추출**을 사용하거나, 연결한 Pinterest 보드의 이미지별 **이 이미지로 구조 MD 만들기**를 누른다. 보드 전체 색상 추출 기능도 별도로 남아 있다. Pinterest 미리보기는 736px/474px를 우선 선택하고 기존 2MB 요청 제한을 유지한다.

MD의 검증된 JSON `template`에 화면 비율, 영역 역할(title/body/label/decoration), 0~1 상대 좌표, 도형, 정렬, 배율, 채우기, 추정 근거, reading-order/continue-page/flow-cards 규칙을 저장한다. 원본 텍스트·사진·로고·이미지 바이트는 저장하지 않는다. 설명문은 사람이 읽는 가이드이며 실제 실행 규칙은 JSON이다. 기존 색상형 MD도 계속 읽는다.

구조 편집기에서 영역과 역할·도형·정렬·크기를 수정하고 저장한다. 초안을 직접 입력하거나 TXT/MD/DOCX/PPTX의 텍스트를 가져와 적용할 수 있다. 기존 파일의 표·사진·서식·문서 내 위치를 보존하며 덮어쓰는 기능은 아니다. 결과를 새 파일로 저장한다. 새 문서 시작 버튼은 같은 템플릿에 편집용 기본 내용을 배치한다.

미리보기와 PPT 출력은 동일한 계획 함수를 사용한다. 입력 문단은 읽기 순서의 영역에 배치하고 긴 문단은 다음 영역/페이지로 이어진다. 3만 자·100페이지 상한 초과는 실패하며 잘라 저장하지 않는다. 글자가 영역을 넘으면 크기를 줄이고, 8pt 미만이면 영역 수정이 필요하다. PPT는 네이티브 텍스트/도형, Word는 같은 위계의 문단·카드 표로 변환한다. Word는 절대 좌표를 복제하지 않는다. 구조 MD의 Excel 출력은 지원하지 않는다.

구현: shared/reference-template.ts, main/cheil/reference-{analysis,image,worker,office}.ts, renderer/src/cheil/ReferenceEditor.tsx 및 기존 스타일 저장·IPC·생성 흐름. 문서 엔진 패키지는 수정하지 않았다. OCR은 격리 작업자에서 기존 OS OCR 도우미를 실행하며 40초 상한, 종료 시 작업자 정리를 적용한다. 이미지 이름·원문에서 실행 지시문을 생성하지 않는다. MD 형식/좌표/역할/열거값·중복 ID를 검증한다.

검증: 관련 단위 51개 통과(장문·한글·이모지 내용 보존, MD 왕복, 도형 및 배치 변경, 잘못된 규칙 거부, 네이티브 Office XML, 실제 PPT 엔진 읽기 포함). 셸 타입 검사·빌드 통과. 실제 Windows OCR→MD 저장→앱 재시작→다른 초안 적용→PPT/Word 생성 및 탭 열기 E2E 1개 통과. 첫 E2E의 Electron evaluate GC/시간 초과는 편집기 확인을 실제 탭 표시로 바꿔 해결했다. 합성 이미지 검사는 실제 Pinterest 이미지의 인식 품질 검증과 구분한다.

제한: 로컬 기하 추정이며 의미 기반 디자인 분석은 아니다. 선명한 텍스트와 단순 도형에 적합하다. 사진·복잡한 장식·회전 글자·과도하게 많은 텍스트 영역은 미인식하거나 수정이 필요하다. 복수 레퍼런스의 스타일 합성, 열린 문서 전체의 객체를 보존한 재서식화는 아직 구현하지 않았다.

사용 중인 기존 개발판에 사용자 입력이 감지돼 종료하지 않았다. 별도 프로필의 새 개발판을 `Documents/CheilOffice/reference-template-work/launch-structure.ps1`로 띄우고 구조 MD 데모를 표시했다. 기존 Pinterest 로그인 프로필은 보존되며 새 검수 프로필에는 로그인 정보를 복사하지 않았다. 기존 앱을 나중에 정상 재시작하면 같은 로그인 프로필에서 최신 기능을 사용할 수 있다. 설치·커밋·푸시 없음. 검수 산출물은 같은 작업 폴더 result/에 있다.


## 2026-10-28 Pinterest 무드보드 → 스타일 MD

실제 최신 개발판 UI에서도 내 보드 새로고침 → 선택 보드 이미지 5개 → 보드 스타일 MD로 저장 → 편집기 미리보기 적용을 확인했다. 생성 MD는 개발판 프로필 document-styles에 저장됐고, 전달본은 Documents/CheilOffice/하반기 구독캠페인_STYLE.md다. 마지막 리디렉션 수정 후 Electron E2E 2개, typecheck, ESLint, build도 통과했다.

실제 Electron session.fetch의 manual redirect는 응답을 주기 전에 “Redirect was cancelled”로 실패했다. net.request의 redirect 이벤트에서 허용된 Pinterest www/kr HTTPS 호스트만 최대 3회 followRedirect하고, 전용 세션·60초 제한·스트림 용량 제한을 유지하도록 수정했다. 실제 계정 보드와 선택한 보드 이미지 5개를 이 서비스로 읽고 로컬 분석이 성공했다.

로그인 후 계정 식별은 인증된 context.user와 initialReduxState.session.userId → users 연결을 지원한다. 보드/핀 요청에 실제 웹 화면의 요청 헤더와 source URL을 포함하며 앱 버전은 현재 HTML에서 읽는다. 고정 배포 해시·브라우저 쿠키 복사·외부 스크래퍼 의존성을 넣지 않는다. resource_response.bookmark와 기존 resource.options.bookmarks 모두 처리한다. 응답 대기 상한은 60초다.

선택한 보드에서 받은 최대 30개 이미지 중 읽을 수 있는 이미지를 nativeImage로 48×48로 줄여 로컬에서 대표색 8개까지 추출한다. 그림·본문·계정 비밀값은 MD에 넣지 않는다. 색상은 근사값이며 글꼴(맑은 고딕), 크기(28/12pt), 밝은 배경, 읽기 쉬운 강조색과 여백 지침은 문서 추천값이다. 구도·레이아웃·원본 글꼴을 자동 인식했다고 표시하지 않는다. 강조색/본문색은 기본 배경 대비 4.5:1 이상으로 제안한다.

‘보드 스타일 MD로 저장’은 기존 UUID 기반 document-styles 라이브러리에 MD를 저장하고 편집기에 선택한다. 이름·색·글꼴 수정, MD 열기/내보내기/다시 불러오기, 스타일 적용 새 Word/PPT/Excel 문서 경로를 재사용한다. MD에는 출처 보드 URL, 분석/미리보기/전체 핀 수, 기준 시각과 일부 이미지 실패 여부를 남긴다. 외부 AI 호출이나 유료 API가 없다. 원본 이미지 재배포 권한을 부여하는 기능은 아니다.

관련 검사: cheil-pinterest, cheil-moodboard, cheil-style-library, cheil-style-integration 단위 검사 39개 통과. 가상 Pinterest Electron E2E는 연결·리디렉션·탐색 제한·MD 저장/재읽기를 검증한다. 가상 검사는 실제 서비스 검증과 구분한다. 실제 계정 보드/선택한 보드 핀 조회 성공을 별도로 확인했다. 설치본 교체·커밋·푸시 없음.


## 2026-10-28 Pinterest 연결 개발판

내 양식 → 스타일만 추출 화면에 Pinterest 연결, 보드 목록/더 보기, 선택한 보드의 이미지 미리보기(최대 30개), 연결 해제를 추가했다. API 키나 Python 패키지 없이 Electron 전용 persistent session으로 동작한다. 일반 Chrome/Edge 쿠키를 읽지 않는다. 로그인은 Pinterest 자체 페이지에서 직접 하며 Node/preload 없이 sandbox/contextIsolation을 켠다. 외부 로그인 팝업은 차단하므로 Pinterest 자체 로그인 경로를 사용한다. 5분 후 로그인 창을 닫는다.

세션은 앱 userData의 persist:cheil-pinterest 파티션에 Chromium이 보관한다. 쿠키 값/비밀번호/원문 오류를 홈 IPC나 로그에 보내지 않는다. 연결 해제는 해당 파티션의 저장소와 캐시만 지운다. 홈 화면만 기존 style IPC로 접근할 수 있다. 명시적인 연결·새로고침·보드 선택 때만 Pinterest와 i.pinimg.com에 요청하며 외부 AI 요청은 없다. 보드 메타데이터는 메모리만 사용하고, 이미지는 제한된 MIME/용량의 data URI로 전달한다. 기존 CSP를 넓히지 않는다.

Pinterest 비공식 웹 응답의 session.user 및 Boards/BoardFeed 리소스를 사용하는 독립 구현이다. 외부 스크래퍼 코드를 복사하거나 배포 의존성으로 넣지 않았다. 응답 스키마/로그인 흐름 변경, CAPTCHA, 외부 소셜 로그인은 실제 계정으로 확인해야 한다. 단위/가상 서버 테스트는 실제 서비스 연결의 증명이 아니다. 자동 스타일 분석·스타일 후보 생성·저장된 스타일 연결은 이번 연결 기능에 포함하지 않는다.

코드: apps/shell/src/main/cheil/pinterest-{service,data}.ts, shared/cheil-pinterest-api.ts, renderer/src/cheil/PinterestPanel.tsx. 테스트: apps/shell/tests/cheil-pinterest.test.ts, e2e/cheil-pinterest.spec.ts. 기존 설치본 교체·커밋·푸시 없음. 검수 자료와 개발판 실행기는 Documents/CheilOffice/pinterest-dev.

# Cheil 기획 오피스 — 제품 개발 기록

## 2026-10-27 자체 위키 구현·검수 마무리

자체 위키·캠페인 자료 통합·문의처 champ.lee@samsung.com 적용 완료. 관련 단위 145개+양식 필드 6개, 화면 8개, 최종 패키지 편집기 8종, 가상 자료 실제 AI 1회, PDF 출력 6건(29쪽) 확인. 미디어브리프 인쇄 메타데이터만 수정해 불필요한 빈 페이지 제거(2쪽).

시험용 별도 설치 및 교체는 성공했으나 정상 삭제는 Windows 액세스 거부로 미완료. 시험 설치 경로/고유 등록만 수동 정리했고 원래 프로그램 등록·PATH·자료는 보존했다. 정상 삭제·회사 보안 정책·사용자 API 키별 품질은 확인 필요. 상세: docs/cheil-wiki-release-check.md. 최종 검수 후보 설치 파일은 Documents/CheilOffice/release-wiki-2026-10-27/CheilOffice-Setup-0.12.3.exe, SHA256 3c5672b1b4ec4a6761f27d48193d4c8b7a9b697c2d1c6d19841bd208afae3dec. 커밋·푸시·의존성 설치 없음.


## 2026-10-27 승인된 UI 디자인 실제 적용

사용자가 클릭 시안에서 확정한 UI를 적용했다. 홈·캠페인·지식·업무 도구·파일의 주 탐색, 폴더형 오피스 앱 8개(4개씩 2줄), 서류 보관함형 캠페인, 제공받은 Cheil 원본 로고, 중립색·라임 포인트와 둥근 탭·설정 스타일을 반영했다. ‘워크스페이스’ 대신 ‘홈’을 사용한다. 기존 앱 실행·파일/폴더·템플릿·캠페인·지식·독립 수식 도구·보조 탐색 기능을 보존했다. Pretendard Variable 1.3.9를 로컬 UI 폰트로 포함하고 OFL과 고지를 추가했다. 문서 엔진과 저장 서식은 변경하지 않았다. 설치·커밋·푸시는 하지 않았다. 상세: `docs/cheil-ui-redesign.md`.

## 2026-10-27 독립 수식 도우미 6기능 확장

사용자가 승인한 구성으로 수식 도우미를 확장했다. 수식 만들기·데이터로 만들기·수식 설명·오류 해결·수식 개선·함수 사전의 여섯 작업과 왼쪽 입력/오른쪽 결과 배치를 적용했다. 열린 엑셀과는 연결하지 않는 독립 도구다. 추가 질문에 답한 뒤 이어서 요청, 대안 수식의 선택 이유·장단점·버전 비교, 실제 수식에 포함된 구문 강조, 로컬에서 계산한 수정 전후 문자 범위 표시를 제공한다.

데이터 입력은 수동 입력과 Excel TSV 붙여넣기를 지원한다(최대 20행·8열, 셀당 256자). 기본 AI 요청에는 열 이름·셀 위치·행 수만 포함한다. 사용자가 체크할 때만 샘플 값을 포함한다. 함수 사전 28종은 로컬 검색하며 Excel 2016·2019·2021·365의 선택 버전에 따라 지원 여부와 호환 수식 요청 입구를 표시한다. 미디어 효율은 접힌 보조 예시로 유지한다.

검증: 타입 검사·변경 코드 ESLint·개발 빌드와 단위 시험 25개 통과. 최종 가짜 API 앱 시험 5개가 통과했으며 여섯 기능, 질문 재요청, 대안 복사, 수식 구문 강조, 수정 전후 비교, 샘플 값 전송 선택, 붙여넣기, 함수 사전과 기존 업무 도구를 확인했다. 복사 시험은 비동기 완료를 기다리도록 고친 뒤 통과했다. 사용자의 실행 앱도 정상 종료·재실행 후 새 6기능 화면까지 확인했다. 실제 Solar/OpenRouter 생성 품질은 확인 필요. 설치·커밋·푸시는 하지 않았다. 상세: `docs/cheil-formula-assistant.md`. 아래 4기능 설명은 확장 이전 기록이다.

## 2026-10-27 엑셀 수식 도우미

사용자 요청으로 홈 왼쪽 업무 도구에 **엑셀 수식 도우미**를 추가했다. 일반 엑셀 작업이 중심이며 수식 만들기·설명·오류 해결·개선의 네 기능을 선택한다. 요청 아래에 제안 수식, 설명, 작동 순서, 적용 시 확인 사항, 버전 호환을 표시하며 수식을 복사할 수 있다. Excel 365·2021·2016/2019 선택을 AI 지시문에 반영한다. 기본 예시는 조건 합계·값 찾기·텍스트 정리·날짜 계산·중복 확인·조건 분류. 미디어 지표는 접힌 광고 업무 예시에 클릭률 한 건으로 제공한다.

기존 설정의 AI와 공용 `ai:chat` 및 외부 전송 판단을 사용한다. 셀 참조·상수는 수식 작성에 필요하므로 그대로 전달한다. 예시는 입력만 채우며 AI 요청은 사람이 누를 때만 한다. 입력 변경 후 이전 수식의 복사를 막고, 정보 부족 시 추가 질문을 표시한다. 실제 파일 읽기·수식 실행 기능은 없으며 실제 엑셀에서 계산 결과를 확인해야 한다.

구현: `apps/shell/src/renderer/src/cheil/FormulaTool.tsx`, `FormulaTool.css`, `tools/formula-tools.ts`, 메뉴 연결 `WorkTools.tsx`. 참고 도구의 소스·문구를 복사하지 않았으며 메뉴 선택, 단일 입력 화면과 아래쪽 결과로 별도 구성했다.

검증: shell 빌드·타입 검사·변경 TS 코드 ESLint 통과. 수식 도우미와 기존 업무 도구 단위 시험 16개 통과. 가짜 API를 사용한 앱 시험 3개(네 기능·복사·입력 변경, 추가 질문·깨진 응답 재요청, 기존 업무 도구) 통과. 실제 앱 화면 캡처 검토 완료. 실제 Solar/OpenRouter 응답 품질은 확인 필요. 설치·커밋·푸시는 하지 않았다. 실행 중인 기존 앱은 재시작해야 새 메뉴가 나타난다.

## 2026-10-26 Codex 양식 전면 개편

사용자 요청으로 기존 Cheil 내장 양식 6종을 새 4종으로 교체했다. OT 및 킥오프(PPT 12장), 컨택리포트(Word), 미디어브리프(Excel 한 시트), 결과보고서(PPT 11장). 기존 캠페인 제안서·경쟁 PT 분석은 내장 목록과 스킬에서 제거했다. 사용자 개인 문서와 원본 샘플은 변경하지 않았다. 상세 구성 근거는 `docs/cheil-template-redesign.md`. 아래 이전 날짜의 6종·14장·미디어 플랜 설명은 이 변경 이전 기록이다. 재생성은 `tools/cheil/make_templates.py`로 하며 artifact-tool 런타임 경로가 필요하다. 실제 API 품질은 확인 필요.

검증 완료: shell 빌드·타입 검사, 변경 코드 ESLint, 단위 시험 49개(UI 24·shell 24·slides 1), 새 양식 열기·캠페인 정보 채우기·변경 전파·내 양식 등록 등 통합 시험 17개 통과. API 미연결 안내 시험 1개는 이 PC의 구독 상태를 격리한 뒤 별도 재실행하여 통과했다. 원본 샘플과 실제 API 키는 시험에 사용하지 않았다.

이 저장소는 광고대행사의 캠페인 문서 작성과 지식 재사용을 위한 CheilOffice 개발 저장소다. 기반 소프트웨어의 출처·라이선스·수정 배포 관계는 NOTICE에 보존하며, 이 문서는 제품에 추가·변경한 기능을 기록한다.

## 1. 이름과 모양

| 무엇                   | 원본                           | 포크                         | 파일                                                                    |
| ---------------------- | ------------------------------ | ---------------------------- | ----------------------------------------------------------------------- |
| 화면 이름(한국어)      | 기반 프로젝트                     | Cheil 기획 오피스            | `packages/i18n/src/product.ts`                                          |
| 설치·폴더 이름         | 기반 프로젝트                     | CheilOffice                  | 같은 파일, `apps/shell/package.json`, `apps/shell/electron-builder.cjs` |
| 설치 ID                | io.github.pblsketch.ieumoffice | com.cheil.planningoffice     | `electron-builder.cjs`                                                  |
| 파일 연결 이름(ProgId) | 기반 프로젝트.*                   | CheilOffice.*                | `build/installer.nsh`, `src/main/default-app.ts`                        |
| 데이터 폴더            | %APPDATA%\기반 프로젝트           | %APPDATA%\CheilOffice        | 이름에서 따라옴                                                         |
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
- **OpenRouter 모델 직접 입력·목록**(10-26, 사용자 요청: OpenRouter 를 거친 Solar Pro 4): 설정 → AI → 고급 → OpenRouter 의 모델 칸이 고정 드롭다운이 아니라 글 칸 + 목록(datalist)이다. 설정에서 OpenRouter 를 보이면 `https://openrouter.ai/api/v1/models` 목록을 **키 없이** 한 번 받아(원본 custom 의 `getCustomModels` 재사용) 내장 목록 뒤에 붙인다. 받지 못하면 내장 목록만, 목록에 없는 이름도 친 그대로 저장한다. 10-26 이 PC 에서 467개를 받았고 `upstage/solar-pro4`·`upstage/solar-mini4`·`upstage/solar-pro-3`이 있었다. 금지선은 그대로 걸린다(받는 곳이 이 PC 밖). 코드 `apps/shell/src/renderer/src/SettingsModal.tsx`(`OPENROUTER_BASE_URL`), 시험 `apps/shell/tests/cheil-openrouter-models.test.ts`. 실제 키로 Solar Pro 4 에 보내 본 적은 없다(확인 필요).
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

| 스킬                 | 화면 제목       | 양식                                                                  |
| -------------------- | --------------- | --------------------------------------------------------------------- |
| cheil-house-rules    | Cheil 문서 원칙 | (없음) 숫자는 자료에 있는 것만, 출처, 헤드 메시지, 광고주용 마감 규칙 |
| cheil-proposal       | 캠페인 제안서   | PPT 12장                                                              |
| cheil-monthly-report | 결과보고서      | PPT 12장 (10-26 현업 결과 리포트 구성)                                |
| cheil-brief          | 캠페인 OT       | PPT 14장 (10-26 워드 브리프 → 현업 킥오프·제작 OT 구성)               |
| cheil-meeting-notes  | 컨택 리포트     | 워드 (10-26 현업 컨택 리포트 구성)                                    |
| cheil-pitch-analysis | 경쟁 PT 분석    | 워드                                                                  |
| cheil-media-plan     | 미디어 플랜     | 엑셀 (10-26 현업 미디어 브리프 구성, CPM·CPV·CTR·비중·구분별 요약)    |

- **현업 문서로 다시 만든 4종(10-26, 사용자 요청: "지금 잡은 내용이 진짜 다 별로")**: 사용자가 모아 준 현업 문서 17개(킥오프·제작 OT 3, 결과보고 4, 미디어 브리프 5, 컨택 리포트 5 — 실제 광고주 문서, 이 PC 의 `바탕화면\제일오피스\샘플`, 저장소에 넣지 않음)의 **구성만** 따랐다. 양식에는 실제 이름·숫자를 하나도 옮기지 않았다(`[칸]`만). 스킬 이름은 그대로 두고 화면 제목·양식 파일·스킬 설명만 바꿨다.
  - 캠페인 OT(PPT 14장): 표지 → 오늘 공유할 이야기 → 지난 캠페인 성과와 현황(+ 리뷰 → 이번에 가져갈 것 표) → 시장·경쟁 → 이번 캠페인 과제(과제 / 캠페인 구조·광고주 예시 컨셉) → 타깃(누구에게 / 인사이트) → 메시지와 RTB(+ RTB 표) → 크리에이티브 가이드(번호, 피할 것) → 소재 운영 구조(통합·개별 소재 표) → 산출물·일정·예산 → 레퍼런스와 아이디어 단초 → 확인할 것과 Next. 캠페인 카드 공통 칸 9개.
  - 결과보고서(PPT 12장): 표지 → Summary → 캠페인 개요 → 미디어 운영 방향(표) → 정량: KPI 달성 / 매체별 집행 결과(집행비용·노출·조회·클릭·CTR·CPM·CPV) / 검색량·인게이지먼트 전후 → 정성(세일즈 연계·기사·소비자 반응·기타) → 소재별 결과 → 인사이트 → 다음 캠페인 제안 → 데이터 출처.
  - 미디어 플랜(엑셀): 1. 캠페인 개요(브랜드·캠페인명·배경 및 목적·Comm. 타깃·기간·목표·예산·집행 매체·운영 소재) → 2. 매체별 집행 계획(구분·매체·상품·타깃팅·기간·예산·노출·조회·클릭 입력, CPM·CPV·CTR·비중 계산식, 합계) → 3. 매체 구분별 예산 요약(지상파·케이블·디지털·CTV·OOH·기타, SUMIF, 집행 계획 합계와 맞는지 표시) → 4. 소재 운영(입력 표) → 5. 매체별 운영 메모 + '가정·출처' 시트. 이 양식이 53행까지 가서 **엑셀 빠른 채우기가 읽는 범위를 A1:L40 → A1:L60** 으로 늘렸다(`packages/ui/src/cheil-sheet-fill.ts`의 `SHEET_SCAN_ROWS`). 사람이 넣는 열은 A~~J, 계산식 열은 K~~N.
  - 컨택 리포트(워드): CONTACT REPORT 머리표(Project명/회의명, 광고주·캠페인, Date | Place, 참석자 광고주/우리) → 요약(핵심 피드백·결정·다시 해 올 것) → 상세 피드백(주제마다 광고주 발언 인용 + 요지 + 요청, AE 의견 칸) → NEXT 표(우리/광고주, 기한) → 남은 쟁점 → - END -.
  - 칸 수: 캠페인 OT 100, 결과보고서 126, 컨택 리포트 38, 미디어 플랜 16(+ 입력 표 2개). **빠른 채우기 한 번의 답이 길어진다** — Ollama 단발 호출 상한이 4,096토큰(`ollama.ts`의 `chatOllama`)이라 이 PC 의 작은 모델로는 PPT 2종의 답이 잘릴 수 있다(제안서 70칸에 2,700~3,300토큰이었다). API 키 모델은 상한이 더 커서 괜찮을 것으로 보지만 실제 키로는 확인 필요.
  - 공용 PPT 도우미(`_page_title`)로 본문 장 제목을 왼쪽 정렬·24pt 로 바꿨다 → 캠페인 제안서도 같이 바뀌었다(칸은 그대로).
  - 화면 시험: `e2e/cheil-templates-look.spec.ts`가 4종을 각 편집기로 열고 PPT 는 장마다 찍는다(`e2e/artifacts/screenshots/cheil-look-*`). 브리프가 워드에서 PPT 로 바뀌어, 워드 문서로 하던 화면 시험(문서 세트·변경 전파·재시작 뒤 전파·내 양식·API 키 채우기·자동 기록)은 컨택 리포트·경쟁 PT 분석으로 옮겼다.

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
  - **발신자 태도** 3단계(10-26 저녁 이름 바꿈, 예전 이름 '강도'): 공손하게(정중히 부탁·양해, 날짜는 희망으로), 보통(용건 먼저, 요청·날짜 분명히), 단호하게(마감과 지연 시 영향, 회신 날짜를 못 박음, 무례한 말은 안 씀). 고른 단계의 뜻이 그 아래 한 줄로 보인다. 내부 코드는 `soft normal firm` 그대로.
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
  - **금액·부가세**: "5억 1,000만원"·"520,000,000" 같은 금액 → "일금 오억이천만원정 (₩520,000,000)"(십·백·천 앞의 일을 남기는 견적서 표기). 부가세: 공급가액이면 10%(원 미만 버림), 합계(VAT 포함)면 공급가액 = 합계÷1.1 반올림, 나머지가 부가세(셋의 합이 늘 맞음).
  - **날짜 계산**: D-day와 요일, 몇 주차(ISO·월), 기간의 일수·영업일(주말·공휴일 제외, 뺀 공휴일 목록), 영업일 더하기·빼기. 공휴일 표는 **2025·2026년만**(대체공휴일·선거일 포함, `tools/number-tools.ts`의 `HOLIDAYS`). 표가 없는 해는 주말만 빼고 화면에 "공휴일 표가 없어 주말만 뺐습니다"라고 알린다. 2027년 이후는 정부 발표를 보고 표에 더할 것(확인 필요).
  - **번역**: 한국어·영어·일본어·중국어(간체), 업무 문체/자연스럽게. AI 한 번, 숫자·날짜는 앱이 지킨다.
  - **PDF 도구**: 원본의 PDF 도구 창을 연다.
- 보안: 글자 수·규칙 맞춤법·금액·날짜는 PC 밖으로 아무것도 보내지 않는다. AI 를 쓰는 셋(메일·AI 맞춤법·번역)은 공용 `ai:chat`이라 기밀 금지선을 지나고, 숫자·날짜는 보내지 않는다. 그래도 '대외비' 같은 표지가 있으면 막힌다.
- 코드: 화면 `apps/shell/src/renderer/src/cheil/WorkTools.tsx`(`WorkToolsNav`, `WorkToolView`), 규칙 `cheil/tools/text-tools.ts`·`number-tools.ts`·`ai-tools.ts`, 홈 배선 `Home.tsx`의 `toolMode`. 메일 부품은 `MyCampaigns.tsx`의 `MailDraft`(캠페인 `null` 허용)를 같이 쓴다. 문구는 한국어 + 영어.
- 한계: 규칙 맞춤법은 전문 맞춤법 검사기만큼 잡지 못한다(나머지는 AI 몫, 실제 AI 품질은 확인 필요). 원고지 매수는 대략값이다.
- 시험: `apps/shell/tests/cheil-work-tools.test.ts`(글자 수, 규칙이 맞는 글을 건드리지 않음, 금액 읽기·한글 금액·부가세, 2026 추석 낀 영업일, 표 없는 해 알림, AI 도구의 숫자 가리기), 화면 `e2e/cheil-work-tools.spec.ts`(왼쪽 메뉴의 6개를 차례로: 맞춤법 규칙·AI, 금액·부가세, 영업일, 번역, 캠페인 없는/있는 메일, PDF 창. 가짜 AI 서버가 받은 글에 금액·날짜·이름이 없는지).

## 5-10. 내 지식 베이스 (사용자 요청, 10-26 저녁)

- 사용자 정의: 앱은 **개인 지식 베이스의 허브 창**이다. 관련 자료를 넣으면 알아서 md 로 바뀌어 옵시디언 볼트에 분류되고, 그 지식 베이스 안에서 찾는다. 시안 `../자료/시안/knowledge_hub.html`(단순판을 사용자가 고름).
- 무엇: 홈 왼쪽 '업무 도구'의 맨 위 **'내 지식 베이스'**.
  - 넣기: 가운데 칸에 파일을 끌어다 놓기(홈 전체의 '끌어다 놓아 열기'보다 먼저 받음), '파일 고르기'(여러 개), 화면 어디서나 메일·메모 붙여 넣기(Ctrl+V, 검색 칸 제외). 형식: 워드·PPT·엑셀·CSV·PDF·한글·ODT·md·txt·HTML. 한 번에 50개, 붙여 넣기는 20만 자까지.
  - 변환·분류(AI 없음, 이 PC 에서): 원본의 `parseFileToText`로 글을 읽어 `obsidianText`로 md(표 → 마크다운 표). `Cheil/지식/<광고주>/<종류>/<제목>.md`. 광고주는 **캠페인 카드의 광고주 + 사람이 볼트의 `Cheil/지식` 아래에 만든 폴더 이름** 중 자료에 가장 많이 나온 것(파일 이름은 두 배로 침, 긴 이름 먼저), 없으면 `미분류`. 옵시디언에서 노트를 새 광고주 폴더로 옮기면 다음부터 그 이름을 안다. 종류는 파일 이름 → 본문 앞 4천 자의 낱말 순: 메일·회의록·견적·보고서·제안서·분석·계약·정산, 없으면 기타. 붙여 넣은 글의 제목은 '제목:' 줄, 없으면 첫 줄. 같은 원본을 다시 넣으면 그 노트를 다시 쓰고, 다른 원본이 같은 이름이면 "(2)".
  - 노트 앞머리: `source`(원본 경로 또는 "붙여 넣은 글 <시각>"), `advertiser`, `kind`, `added`, 태그 `cheil/knowledge`·`cheil/<종류>`. 원본 파일은 건드리지 않고 복사하지도 않는다.
  - 찾기: **볼트 전체**의 .md(점으로 시작하는 폴더 `.obsidian`·`.trash` 제외, 5천 개·한 개 2MB까지)를 이 PC 에서 읽어, 검색어 낱말을 많이 가진 노트 → 제목에 든 것 → 많이 나온 것 순으로 30개. 발췌에 검색어를 칠한다. 누르면 마크다운 편집기 탭으로 연다(볼트 안의 .md 만).
  - **AI 요약**(누를 때만): 찾은 노트 위 6개의 발췌와 질문을 공용 `ai:chat`으로 한 번 보낸다 → 기밀 금지선이 걸린다(대외비·개인정보 표지가 있으면 이 PC 밖 AI 로 안 나감). 지시문: 발췌에 있는 사실만, 항목마다 근거 `[[노트 제목]]`, 노트끼리 다르면 알림.
- 볼트가 없으면 '볼트 고르기'(5-8절의 `obsidianPick`과 같은 창구)부터 보인다.
- 길: 뒷단 `apps/shell/src/main/cheil/knowledge.ts`(Electron 없음), 창구 `cheil:knowledge-overview`·`-add-files`·`-pick-files`·`-add-text`·`-search`·`-open`(`campaign-ipc.ts`, 홈만; 끌어다 놓은 경로는 절대 경로·50개까지만 받고 형식은 뒷단이 다시 봄), 배선 `main/index.ts`의 `cheilKnowledge`, 화면 `renderer/src/cheil/KnowledgeBase.tsx`(+ `WorkTools.tsx`의 `knowledge`), 스타일 `home.css`의 `.cheil-kb-*`. 문구는 한국어 + 영어.
- 한계: 분류는 낱말 규칙이라 틀릴 수 있다(광고주가 둘 이상 나오면 많이 나온 쪽, 광고주 이름이 캠페인·폴더에 없으면 미분류). 찾기는 낱말 그대로 찾기(형태소·뜻 검색 아님, '예산'은 '예산을'을 찾지만 '버짓'은 못 찾음). 이미지 파일·스캔 PDF(글 없는 것)는 넣지 못한다. 실제 끌어다 놓기는 화면 시험이 하지 못해 사람이 확인해야 한다(파일 고르기·붙여 넣기는 시험함). 실제 AI 로 쓴 요약 품질은 확인 필요(가짜 서버로만).
- 시험: `apps/shell/tests/cheil-knowledge.test.ts`(분류·같은 원본 다시 쓰기·"(2)"·못 읽은 파일·볼트 없음·메일 제목·볼트 전체 찾기 순서와 `.obsidian` 제외·볼트 밖 열기 거절·목록·지시문), 화면 `e2e/cheil-knowledge.spec.ts`(실제 워드 회의록 양식 + 글 파일을 파일 고르기로, 메일 붙여 넣기 → 가상전자 › 회의록·메일, 미분류 › 견적, 볼트의 파일 확인 → '오로라7 예산' 찾기 → AI 요약이 찾은 발췌만 보냄 → 노트가 마크다운 편집기로 열림).

## 6. 자동 업데이트 끔

- 설치본이 원본 릴리스를 업데이트로 받으면 기반 프로젝트로 바뀐다. `apps/shell/src/main/cheil-update-policy.ts`가 끈다. '업데이트 확인'은 원본 내려받기 쪽을 열지 않는다. 새 판은 새 설치 파일로 나눈다.

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

검증(2026-10-27): 셸 타입 검사 통과, 변경 코드 ESLint 오류 0(기존 Home.tsx quickLookPayload 의존성 경고 1), Prettier·테마 색 검사·git diff --check 통과. 셸 및 8개 편집기 빌드 통과. 관련 단위 시험 48개 통과(고지 생성 시험은 부하로 제한 시간 초과 후 60초 제한 단독 실행에서 12개 통과). 최종 화면 시험 4개 통과: 오피스 앱 8개와 2줄 배치, 실제 Word 진입, 로컬 UI 폰트, 라이트·다크·시스템 테마와 로고, 업무 도구·지식·파일 전환, 캠페인 카드 생성/열기, 기존 OT PPT와 미디어브리프 Excel 열기. 실제 AI는 호출하지 않았다. 전체 주석 검사 도구는 이전 템플릿 개편에서 삭제된 추적 파일 cheil-pitch-analysis/SKILL.md를 읽으려다 중단됐다(이번 UI 코드 오류 아님). 모든 편집·인쇄·내보내기 조합의 수동 검증은 확인 필요.

## 2026-10-27 최종 UI 배치 및 Windows 배포 파일 검수

사용자가 최종 시안을 승인하고 배포 파일을 요청해 실제 앱에 반영했다. 홈 앱 4×2 왼쪽/검색·최근 문서 오른쪽, PDF 바로가기 텍스트 삭제, 오른쪽 라임 업무 도구 드로어(7종), 지식베이스의 도구 목록 제거·자료 추가 접기, 날짜 계산 상단 2열, 캠페인 서류 보관함 유지, 다크모드 라임 hover/선택을 적용했다. native dialog로 초점 가두기·Esc·닫기·바깥 클릭을 지원한다. 코드: Home.tsx, cheil/WorkToolsDrawer.tsx, WorkTools.tsx, KnowledgeBase.tsx, CheilChrome.css.

검증: shell 타입 검사·변경 코드 ESLint 오류 0(기존 hook 경고 1)·테마 색·라이선스 검사 통과. 관련 단위 66개, 개발 화면 시험 10개, 패키지 실행 시험 1개 통과. 패키지 시험은 임시 프로필로 8개 편집기와 미디어브리프, UI 글꼴을 확인했다. Windows의 편집기 CDP 캡처 시간 초과로 해당 캡처만 분리하고 실제 DOM·URL·글꼴 검사는 유지했다. 앱 리소스/라이선스/필수 엔진 누락 없음. 개인 설정/키/문서는 배포 파일에 추가하지 않았다.

배포 파일: C:\Users\CHEIL\Documents\CheilOffice\release-2026-10-27\CheilOffice-Setup-0.12.3.exe (206,847,924 bytes). SHA256 61fba0d77bc8ef9f89c82fad2a1ab2a859fdb1248275ed6a7a40cee87c212a9f. 검수결과.md와 SHA256.txt를 같은 폴더에 제공. 디지털 서명 없음. 실제 설치·삭제·업그레이드·회사 정책·실제 API 품질·모든 내보내기 조합은 확인 필요. 설치·커밋·푸시·게시 안 함. 패키징은 --publish never, 기존 Electron 배포본 사용. 전체 저장소 검수 통과를 주장하지 않는다.

## 2026-10-27 제품 안내·설정·운영 경로 정비

사용자의 원본 중복 정비 요청에 따라 Cheil용 첫 실행·완료 안내, 21개 언어 제품 문구, AI 연결 화면 통합과 추가 연결 접기, 개발자 옵션 접기, 실제 수동 배포에 맞는 업데이트 안내, 제품 정보의 접힌 라이선스 고지, 새 공통 AI 그림을 적용했다. 저장소·피드·패키지 홈페이지는 cheil-master/cheil-office, 의견 보내기는 해당 프로젝트 이슈로 변경했다. 원본 제작자의 문의 메일은 제품 지원 주소에서 제거하고 주소 미지정 시 메일 버튼/IPC 동작을 막았다. README와 시작·홈·연결·설정 도움말도 재작성했다.

NOTICE에 CheilOffice 배포 설명을 앞세웠으며 LICENSE와 원본 저작권·변경·라이브러리·글꼴 고지는 보존했다. 내부 @genoffice 식별자, 문서 엔진/저장 형식과 호환용 ieumoffice 명령어는 유지했다. 자체 MD 위키·캠페인 단일 자료 저장소는 여전히 설계 단계다.

검증: 관련 단위 시험 140개, 개발 화면 시험 5개 통과. 이후 고지 접기 수정의 관련 단위 8개·화면 1개 재실행 통과. 타입·변경 코드 ESLint·형식·라이선스·테마 색·21개 언어 도움말 구성 검사 통과. 모든 편집기와 shell 빌드 완료. 전체 저장소 시험 통과를 주장하지 않는다. 세부: docs/cheil-product-cleanup.md.

최종 출력은 C:\Users\CHEIL\Documents\CheilOffice\release-2026-10-27-final 이다. 앞선 r2 폴더는 출력 파일 잠금으로 최종 덮어쓰기에 실패했으므로 최신본으로 안내하지 않는다. 새 폴더에서 재패키징한다. 설치·커밋·푸시·외부 게시 안 함. 실제 API 품질·회사 설치 정책·설치/삭제/업그레이드·온라인 이슈 접수 가능 여부는 확인 필요.

최종 배포 검수 완료(2026-10-27): release-2026-10-27-final/CheilOffice-Setup-0.12.3.exe, 216,882,228 bytes. SHA256 3b0b24981f0af6f665043f0dbaebf6a388a87f0ae0dc1d2183ed36df73c65815. 패키지 실행 시험 1개 통과: 정비된 AI 설정/지원 경로와 편집기 8종. 필수 리소스와 고지 누락 없음. 디지털 서명 없음. 자세한 검수결과.md, 변경내용.md, SHA256.txt를 final 폴더에 제공. 설치·커밋·푸시·게시 안 함. r2가 아닌 final 폴더의 파일이 최신본이다.


## 2026-10-27 자체 MD 위키·캠페인 자료 통합 구현

사용자 승인 설계와 5시간 작업 요청에 따라 자체 위키를 구현했다. 파일/붙여넣기→일반 MD, 로컬 검색·읽기·편집·이력 복원, 중복 자료 재사용, 새 원본 버전, 원본 연결 끊김 표시, 저장 경로 선택, 외부 수정 충돌 보호를 제공한다. 캠페인 자료는 같은 MD의 ID 연결이며 범위 검색·AI 근거 선별은 메인에서 제한한다. Obsidian은 선택 열기/기존 내보내기 옵션이다. 사용자 지정 문의처 champ.lee@samsung.com을 제품 상수·정보 화면·README·NOTICE에 반영했다. 상세와 제한: docs/cheil-wiki.md. 설치/배포 검증 결과는 최종 검수 문서에 기록한다. 커밋·푸시·의존성 설치는 하지 않는다.

최종 PDF 검수에서 미디어브리프의 불필요한 우측 빈 페이지를 발견해 인쇄 영역 A1:H48·가로 1쪽 맞춤만 보완했다. 셀·수식·서식은 보존했고 최종 PDF는 2쪽이다. 재생성 도구 tools/cheil/template_print.py에도 반영했다.


## 2026-10-28 위키 검색·로컬 OCR·건별 전송 동의 보완

- 위키 전용 PDF 추출은 별도 utilityProcess에서 PDFium과 기존 운영체제 OCR 도우미를 사용한다. 문자 수가 적은 페이지에 OCR을 적용하고 페이지 위치·OCR 여부·미인식 쪽·상한 초과를 MD 메타데이터에 남긴다. 최대 250쪽, 본문 100만 자이며 초과는 표시한다. 원본은 수정하지 않는다. OCR이 의미나 숫자를 정확히 읽었다는 보장은 없으므로 원문 대조가 필요하다.
- 위키 파일 상한을 128 MiB로 변경했다. 파일 파서의 압축 안전 제한은 유지한다. 기존 자료는 ‘원본 다시 읽기’로 재색인하고, 이전 MD는 이력에 보존한다. 엑셀은 위키 경로에서만 실제 XML 행 번호를 함께 추출하며 일반 파일 파서의 기본 출력은 그대로다.
- 검색은 한국어 조사 정리, 구절 빈도·검색어 구체성 기반 점수, 겹치는 문단과 시트 머리행을 사용한다. 최대 6개 구절과 위치를 전달한다. 의미 임베딩 검색은 아니다. 알려지지 않은 긴 식별자를 포함한 질문은 공통 단어만으로 답하지 않는다.
- 위키 질문은 `prepareAnswer`로 정확한 발췌문·제공자·검사 결과를 먼저 보여준다. 외부 AI는 사용자가 해당 질문의 발췌문에 동의한 뒤 `answer`에서 실행한다. 질문 변경 시 미리보기를 무효화한다. 드래프트는 5분·1회이며 발췌문 버전과 제공자를 다시 확인한다. 외부 전송 동의를 설정이나 전역 허용 목록으로 저장하지 않는다.
- 사용자 지시에 따라 위키의 검토한 발췌문에 한해 광고주 기밀 등급(2) 전송을 건별 허용한다. 개인정보·최고 기밀 등급(3)은 동의로 열리지 않는다. 일반 `ai:chat`·스트림에는 이 예외를 열지 않는다. 런타임의 WeakMap에만 있는 역량 토큰은 정확한 system/user 본문에 묶이며 재사용·위조·5분 만료를 거절한다. UI가 토큰을 만들 수 없다.
- 원래 인수인계 문서의 실제 자료 외부 전송 금지에 대해 사용자가 2026-10-28에 필요한 발췌문의 GPT 전송을 허용했고, 이후 보완 개발을 지시했다. 실제 검증 자료·응답·해시는 저장소가 아닌 Documents/CheilOffice의 비공개 시험 폴더에만 보관한다. 커밋·푸시·설치 없음.


## 2026-10-28 클라우드 PDF OCR 보완

사용자가 배포 용량 때문에 새 로컬 OCR 모델 대신 클라우드를 선택했다. PaddleOCR와 모델은 설치하지 않았다. 기존 기본 추출은 유지하고, 위키에서 PDF를 선택한 뒤 ‘클라우드로 PDF 정밀 읽기’를 열어 선택 페이지를 Azure Document Intelligence prebuilt-layout(2024-11-30)으로 처리한다. 최대 5쪽씩 전체 페이지 이미지를 확인한 뒤 건별 전송·비용 동의를 받는다. 기존 GPT/Claude 구독 키와 별개인 Azure 주소·키가 필요하다. 키는 메인 메모리에만 보관하며 종료 시 사라진다. 설정 저장은 연결 성공 판정이 아니다.

선택 쪽은 PDFium으로 최대 긴 변 3600px의 PNG로 렌더링하며 원본 PDF·숨은 객체·다른 페이지를 전송하지 않는다. 정상 텍스트가 일부 있는 페이지도 사용자가 보완할 수 있다. 표·문단 구조의 서비스 Markdown 결과를 해당 쪽에만 반영하고 이전 MD는 이력에 남긴다. 결과는 needsReview 상태이며 원문과 대조해야 한다. 전체 문서 자동 전송·자동 과금·다른 제공자로의 자동 대체는 없다.

초안은 5분·1회이고 파일 해시·위키 버전·캠페인 범위를 확인한다. 입력/연결 변경과 닫기로 초안을 취소한다. 알려진 개인정보·최고 기밀은 막지만, 이미지 속 내용을 모두 사전 검출할 수 없으므로 페이지 이미지와 전송 권한을 사람이 확인하도록 명시한다. Azure의 지정된 HTTPS 호스트만 허용하고 리다이렉트와 타 호스트 폴링을 거절한다. 요청 실패 시 유료 제출을 자동 재시도하지 않는다. 일부 요청 접수 후 실패 시 비용이 생길 수 있다. 실패 시 MD는 교체하지 않는다.

코드: apps/shell/src/main/cheil/{azure-ocr,wiki-cloud-ocr,wiki-extract, wiki-extract-worker,wiki-store,wiki-ipc}.ts, renderer/src/cheil/WikiOcr.tsx. 새 의존성·모델 없음. 실제 Azure 키·계정이 없어 실제 서비스 인식률·요금·회사 이용 허용은 확인 필요. 실제 광고주 자료 외부 전송 없음. 상세 검증은 Documents/CheilOffice/ocr-cloud-dev에 기록한다.


## 2026-10-28 UI/UX 정리

사용자 요청으로 홈 검색·캠페인 버튼·테마 전환·폭 조절 탐색기, 가로형 캠페인 상세, 위키 옵션 팝업과 목록/문서 삭제·편집 동선을 정리했다. 긴 제목·경로·표·이미지·날짜 입력의 좁은 화면 넘침을 보완했다. 기존 삭제의 버전 확인·휴지통·원본 보존을 유지하며 문서 엔진은 변경하지 않았다. 상세: docs/cheil-ui-ux-2026-10-28.md. 최신 설치 후보는 Documents/CheilOffice/release-ui-ux-2026-10-28-final이며 실제 설치·커밋·푸시·게시 없음.

## 2026-10-28 문서 스타일과 공개 자료 연동 후보

문서 스타일 추출·선택형 getdesign 토큰·theSVG 메타데이터 검색 후보 모듈과 관련 단위 시험을 추가했다. 새 모듈은 아직 메뉴·IPC에 연결하지 않았다. 기존 양식과 설치본은 유지한다. 기존 인계의 클릭 시안 사전 확인 요청에 따라 별도 검토 화면을 만들고 새 동선 확인을 요청했다. 손글씨/OCR 링크는 같은 게시물이며 kordoc과 한국어 손글씨 모델의 라이선스·선택 모델 구조를 확인했다. 새 OCR 엔진·모델 설치와 실제 인식은 미실행이다. 상세는 docs/cheil-style-integration-review.md. 후보 코드·실행 시안·검수 자료는 Documents/CheilOffice/style-integration-2026-10-28. 시안 확인 후 UI·IPC·새 문서 스타일 적용과 출처 고지 보존을 연결하고 OCR 모델 배포·인식 비교를 검수한다. 새 Setup·설치·커밋·푸시는 하지 않았다.

## 2026-10-28 스타일 화면과 선택형 로고 도구 적용

사용자가 시안을 보고 ‘스타일 화면 적용, 브랜드 로고는 옵션 수준으로 업무 도구에 추가’를 승인했다. 홈의 내 양식 → 스타일만 추출은 전용 콘텐츠 영역으로 열리며 DOCX·PPTX·XLSX의 폰트·색·크기 등을 로컬 격리 작업자로 읽는다. 선택 값을 Markdown으로 저장·재사용하고 MD 가져오기/내보내기/열기와 서식 지시문 복사를 지원한다. 외부 MD 수정은 버전 확인으로 보존한다. 새 문서 만들기는 스타일을 적용한 DOCX·PPTX·XLSX 시작 문서를 저장해 해당 편집기에서 연다. 공개 스타일은 getdesign의 선택 토큰만 읽고 출처를 문서 속성·출처 파일에 보존한다. 브랜드 로고는 업무 도구에 접힌 검색 옵션으로 추가했고, 실제 검색·미리보기·출처 및 라이선스 표시·SVG/출처 파일 저장을 지원한다. 기존 양식·문서 엔진은 유지한다. 손글씨/kordoc OCR 모델은 이번 승인 범위에서 추가하지 않았다.

관련 단위 28개+기존 양식/캠페인 회귀 35개=63개, 개발/배포 실행본 각 12개 동작 검수 통과. 실제 편집기 3종에서 새 문서 내용과 스타일을 확인했고 Word 렌더링의 맑은 고딕·선택 강조색을 대조했다. 재시작 후 재사용·외부 MD 수정 충돌·실제 getdesign 선택 저장과 로고 연동도 확인했다. 셸 타입·ESLint 오류 0·Prettier·영어 주석·diff 검사 통과. Home.tsx의 기존 quickLookPayload 경고 1개 유지. 전체 테마 검사는 기존 WikiPanel.css:186의 #777 fallback 1건으로 실패했으며 이번에 변경하지 않았다. 새 스타일 CSS에는 위반 없음. 상세는 docs/cheil-style-library.md. 가상 자료만 사용했고 실제 AI 요청은 없었다.

최신 설치 후보: C:/Users/CHEIL/Documents/CheilOffice/release-styles-2026-10-28-final/CheilOffice-Setup-0.12.3.exe (206,981,125 bytes, NotSigned), SHA256 2dcf7c02d136cbbc5df99a0a51913a69a53af3f48635618fcf83d66a8b447961. 같은 폴더의 win-unpacked 전체가 실행본이다. Setup 추출 2,798파일과 실행 검수본 SHA256이 모두 일치하고 필수 엔진/고지·프로필 제외·latest.yml 해시도 확인했다. 검수 자료는 Documents/CheilOffice/style-implementation-2026-10-28. 버전은 0.12.3으로 이전 후보와 같으므로 폴더·해시로 구분한다. 이전 release-ui-ux-2026-10-28-final은 이번 기능 이전 후보다. 실제 설치/기존 앱 교체·커밋·푸시·게시 없음. 실제 설치/교체는 별도 사용자 요청을 따른다.

## 사용자 지침: 주요 변경 후 실행 화면 자동 표시 (2026-10-28)

- 기능 추가나 눈에 띄는 UI 변경을 반영하면, 필요한 검사와 빌드 후 사용자가 따로 요청하지 않아도 최신 실행 가능한 앱을 연다. 설치파일 제작 전에도 동일하게 적용한다.
- 앱을 켜는 데서 끝내지 않고 변경된 기능 화면으로 이동하여 창을 앞으로 표시한다. 실제로 최신 화면이 보이는지 확인한 뒤 사용자에게 위치와 검증 범위를 짧게 알린다.
- 기존 설치본 교체 없이 확인할 수 있는 개발판/실행본을 우선 사용하며, 기존 문서와 로그인 정보를 보존한다. 저장하지 않은 작업이 있는 앱을 강제로 종료하지 않는다.
- 사용자 로그인이나 입력이 필요한 경우 준비된 해당 화면까지 열고 필요한 조작만 안내한다. 테스트 화면을 실제 서비스 연결 성공으로 보고하지 않는다.
- 실행 또는 화면 이동이 실패하면 실패 이유와 실행 경로를 알린다. 실행기 링크만 전달하고 작업을 끝내지 않는다.



## 2026-10-28 Pinterest 로그인 창 즉시 종료 수정

실제 빈 프로필에서 www.pinterest.com/login/ → kr.pinterest.com/login/ 리디렉션 직후 창이 닫힘을 재현했다. 허용 호스트가 www 하나였고 loadURL 실패 때 창을 닫는 코드가 원인이었다. 로그인 창에 한해 www/kr의 HTTPS 탐색을 허용하고 로컬 SPA용 전역 will-navigate 리스너를 엄격한 로그인 전용 규칙으로 교체했다. 다른 창의 공통 탐색 잠금은 변경하지 않았다. HTTP 리디렉션도 최대 4회, 같은 Pinterest 허용 호스트만 따라간다. 외부/로컬 주소·새 창·다운로드·권한 허용은 계속 차단한다.

로드 실패는 원문 URL/개인정보 없이 오류 코드와 재시도/취소 창을 표시한다. ERR_ABORTED는 새 탐색에 의해 생길 수 있어 자동 종료하지 않는다. _auth 쿠키만으로 성공 처리하지 않고 로그인된 사용자 메타데이터 확인 후 자동으로 닫는다. 쿠키 변경 시에도 검증한다. 테스트에 한국 리디렉션, 같은 사이트 탐색, 외부 탐색 차단, 오래된 인증 쿠키를 추가했다. 기존 첫 테스트는 지역 리디렉션을 재현하지 못했으므로 실제 로그인 검증을 대체할 수 없었다.


## 2026-10-28 오프라인 QR 생성

업무 도구에 QR 생성을 추가했다. GitHub soldair/node-qrcode 1.5.4(MIT)를 번들에 포함하며 URL·일반 텍스트를 PC에서만 처리한다. 256/512/1024px PNG, SVG, 이미지 복사, 4모듈 여백과 오류 복원 M을 지원한다. UTF-8 1,000바이트 제한, 홈 전용 IPC와 파일 저장 대화상자를 적용한다. 입력 내용과 생성 이력은 저장하지 않고 외부 요청도 하지 않는다. 사용자의 최종 요청에 따라 URL 단축·방문 추적·외부 서비스·서버 구성은 제외했다. QR에 인코딩된 주소를 사용자가 스캔해 여는 동작은 별개다. 기존 설치본을 교체하지 않는 개발판으로 검수한다.


## 2026-10-29 URL 단축 추가

사용자의 후속 적용 요청으로 업무 도구에 URL 단축을 추가했다. 별도 서버 설치·계정·API 키 없이 is.gd의 무료 HTTPS API를 사용한다. URL 줄이기를 누를 때만 입력 URL을 고정된 is.gd/create.php에 POST하며 logstats 옵션을 보내지 않아 상세 방문 통계 기능은 켜지 않는다. 제공자의 운영상 로그까지 없다고 보장하는 기능은 아니다. 공개 가능한 URL만 쓰도록 전송 안내를 표시한다. 기존 QR 생성은 계속 로컬 처리한다. API 응답·주소 검사, 20초 제한, 리디렉션 차단, 16KB 응답 한도, 1분 요청 제한 대기, 세션 내 캐시 100개와 홈 전용 IPC를 적용한다. URL과 응답 오류 원문을 로그·디스크에 기록하지 않는다. 서비스 API 연동은 자체 구현이며 새 오픈소스 라이브러리를 추가하지 않는다.


## 2026-10-29 is.gd 연동 철회

사용자가 GitHub 오픈소스의 앱 내 적용을 요청했으며 외부 URL 단축 서비스 연동은 의도한 방향이 아니라고 명확히 했다. 직전 is.gd 연동을 철회하고 URL 단축 메뉴·API 호출·관련 UI·번역·테스트를 제거했다. 오프라인 node-qrcode 기능만 유지한다. 다른 외부 서비스로 대체하지 않는다. 앞 절의 is.gd 기능 설명은 철회된 작업 이력이다.

## 2026-10-29 Cloudflare URL 단축
제작자 Cloudflare Workers/KV로 365일 만료 링크를 제공한다. 업무 도구 URL 단축과 PC별 최근 500개 목록을 추가했다. Turnstile 및 생성 요청 제한을 사용하고 방문 통계는 기록하지 않는다. 관리자 API/비밀키는 앱에 없다. 구현 및 운영 제한: services/short-links/README.md. QR 기능은 계속 오프라인이다.


## 2026-10-29 My Wiki 화면 위계 개선

지식 메뉴·위키 제목·업무 도구의 명칭을 My Wiki로 통일했다. 자료 목록과 읽기 영역을 구획하고, 빈 위키에는 첫 자료 추가 안내를 표시한다. 자료 추가는 대화상자로 열리며 질문은 자료가 있을 때 읽기 영역 아래 별도 카드에 표시한다. 검색 결과 없음과 자료 없음 상태를 구분하며 좁은 컨테이너에서는 세로로 배치한다. 저장·검색·AI 동의 로직은 유지한다.

## 2026-10-29 URL 단축·브랜드 로고 기능 제거
사용자 요청으로 업무 도구의 URL 단축과 브랜드 로고 메뉴 및 실행 연결을 제거했다. URL 단축 preload/IPC와 로고 조회 IPC를 제거했다. QR 생성은 유지한다. 이전 추가 기록은 현재 기능 상태가 아니다.

Cloudflare의 cheil-short-links Worker, 전용 LINKS_KV 저장소, 전용 Turnstile 위젯도 삭제 완료했다. 계정 자체는 유지한다.


## 2026-10-29 홈 기능 정리

홈의 캠페인 옵션 버튼을 제거했다. 내 양식 등록·저장된 양식 열기·내 스타일 진입은 화면에 남기고 native disabled로 비활성화했다. 저장된 양식·스타일 데이터는 보존한다. 캠페인 전용 화면의 옵션은 유지한다.


## 2026-10-29 My Wiki 기반 1~3단계

기존 MD/ID/이력은 그대로 읽는다. 첫 로드 시 .migration-v1에 sources/pages/.history/.trash의 MD를 해시와 함께 보존한 뒤 운영 DB(.catalog/wiki.sqlite)를 구축한다. 이전 도중 실패하면 원본은 그대로이며 완료 표식 없이 재시도한다. DB는 본문이 아닌 분류·별칭·관계·처리 상태와 메타데이터 이력의 기준이다. MD 편집 이력 및 DB 변경 이력은 별도로 보존된다.

새 파일은 raw/<sha256>.<ext>에 수집 당시 바이트를 보존하고 그 사본에서 추출한다. extracted에는 본문·위치 마커·추출 상태를 남긴다. 실패 작업은 가져오기 기록에서 사본으로 재시도하며 같은 파일 중복 및 원본 경로의 새 버전 연결을 유지한다. 과거 자료에 사본이 있었던 것으로 소급 표시하지 않는다.

업무 지식 만들기/분류·연결에서 광고주·브랜드·제품·캠페인·의사결정·인사이트·업무 방법, 별칭, 관련 지식, 재사용 범위를 수동 지정한다. 지식의 근거는 선택 자료의 버전과 연결하며 본문의 위치 인용을 보존한다. 모든 신규 지식은 초안이고 자동 확정/자동 병합은 없다. 기존 캠페인 카드와 이름만으로 자동 병합하지 않는다. 지식 목차 및 양방향 관련 링크로 접근 가능하다.

이 범위는 수집·수동 지식 구성 기반이며 AI 변경안·승인 흐름·자동 수집·카카오 연결은 후속 단계다. 운영 DB도 관계와 분류의 원본이므로 백업 시 위키 폴더 전체(.catalog 포함)를 앱이 쓰지 않는 상태에서 복사해야 한다. 기존 MD만으로 분류 DB를 완전히 복구할 수 있다고 안내하지 않는다.


## 2026-10-29 My Wiki 변경안 검토 4~5단계
새 자료와 기존 지식 페이지를 사용자가 선택해 로컬 행/항목명 비교를 실행한다. 동일 문장·같은 항목명과 검토/확정 표현으로 새 정보, 보완, 결정 변경 후보, 충돌 후보, 중복을 분류한다. 의미 이해형 LLM 비교는 아직 연결하지 않았고 외부 호출은 없다. UI에 이 제한을 명시한다. 10만 자/200개 비어 있지 않은 비제목 행을 초과하면 비교를 거절한다.
변경안은 SQLite reviews에 출처/대상 버전, 원문 행, 이전/제안 내용, 판단 이력을 보존한다. 반영·수정 후 반영·보류·거절은 항목별이며 반영만 MD를 수정한다. 동일 항목의 확정/충돌 후보는 해당 행만 교체하고 보완/새 정보는 추가한다. 모든 반영은 사용자의 명시적 판단이며 기존 MD는 .history에 보존한다. 근거 버전 또는 대상 버전 변경 시 재비교가 필요하다. 반영 ID를 MD에 함께 기록해 파일 저장 후 DB 완료 전 중단된 작업의 재시도를 복구한다. 적용된 지식의 기존 의존 페이지는 기존 stale 계산으로 갱신 필요가 된다. 카카오 연동 없음.


### My Wiki 의미 비교 (2026-10-29)
- 기존 AI 제공자/설정과 정확한 전송 내용 동의를 재사용하여 선택한 새 자료와 지식을 의미 비교한다. AI 비교 전 두 본문 전체를 확인하며 외부 전송은 건별 동의, 5분 만료, 1회 사용이다. 민감정보 차단을 유지한다.
- 표현만 같은 내용/보완/명시적 결정 변경/미해결 충돌/새 정보로 변경안을 작성하고 판단 이유와 원문을 보여준다. 모델이 생성한 본문 대신 검증된 원문 줄만 변경안에 사용한다. 확정 전 제안은 결정 변경으로 분류하지 않도록 요청한다.
- 기존 항목별 반영·보류·거절과 원문/이력 보존을 유지한다. AI는 직접 저장하지 않는다. 분석 전후 버전/저장 위치 검증과 내부 저장 요청의 IPC 차단을 추가했다.
- 현재 두 본문 합계 40,000자, 100항목 이내의 줄 단위 비교다. 실제 제공자 의미 판별 정확도는 별도 실자료 확인이 필요하다. 카카오톡 연동은 후속 단계다.


### My Wiki 검토 단위 개선 (2026-10-29)
의미 분석은 표제·보고 일시·구획 제목을 제외하고 같은 결정의 원문 여러 줄을 한 항목으로 묶는다. 업무 마감일은 유지한다. sourceLines로 정확한 근거 줄을 검증하며 기존 단일 줄 변경안도 호환한다. 기존 변경안·이력은 수정하지 않고 별도 검토 대기본을 만든다. 반영은 기존 항목별 수동 흐름을 유지한다.


### My Wiki 검토본 탐색 개선 (2026-10-29)
최근 검토본 3개를 생성일시 최신순 요약 카드로 표시하고 이전 검토본은 접힌 목록으로 제공한다. 검토본 번호·날짜/시간·자료명·처리 상태 건수를 표시하며 하나를 선택하면 그 검토본의 항목 요약만 표시한다. 항목을 펼쳐 반영/보류/거절한다. 처리 상태를 변경해도 생성 순서를 유지한다. 비교 생성 폼은 접어서 검토 이력을 먼저 볼 수 있게 했다. 저장 데이터·이력 변경 없음.


### My Wiki 목록 구획 (2026-10-29)
원자료를 기본 펼침, 반영 대기/변경 로그를 기본 접힘으로 목록 내부에 배치한다. 반영 대기는 동일 자료/대상 쌍의 최신 제안 중 대기·보류 항목만 집계하며 이전 제안은 별도 진입으로 보존한다. 변경 로그는 실제 apply/apply-recovered 이벤트만 날짜순 표시한다. 위키 페이지와 분류 도구도 접힌 구획으로 접근 가능하다. 저장 데이터나 기존 검토본을 수정하지 않는 표시 변경이다.


### 위키 질문 상단 배치 (2026-10-29)
질문 영역을 My Wiki 제목 바로 아래, 자료 목록과 읽기 본문보다 앞에 배치했다. 넓은 화면에서는 입력과 질문 버튼을 나란히, 좁은 화면에서는 세로로 표시한다. 기존 질문 범위·전송 동의·답변 저장 기능은 유지한다.


### My Wiki 지식 명칭과 순서 (2026-10-29)
한국어에서 위키 페이지를 정리된 업무 지식, 지식 분류·연결을 지식 관리로 부른다. 목록은 원자료 → 정리된 업무 지식 → 반영 대기 → 변경 로그 → 지식 관리 순서이며 지식이 없어도 구역과 설명을 보여준다. 지식 관리의 중복 목록을 제거하고 생성·분류 도구의 역할을 안내한다. 저장 내용과 이력은 변경하지 않는다.


### My Wiki 카카오 나챗방 연결 (2026-10-29)
PlayMCP 일회용 토큰 교환으로 MCP 게이트웨이에 연결한다. 토큰은 OS 암호화가 가능하면 앱 데이터에 암호화해 저장하고 그 외에는 세션에만 보관한다. 위키 질문 답변, 변경 제안, 반영 로그에서 사용자가 내용을 확인·수정하고 명시적으로 보내기를 누른 경우에만 나챗방 도구를 호출한다. 원문·이력은 수정하지 않는다. 실제 카카오 인증과 전송은 사용자 연결 후 검증해야 한다.

카카오 연결 검증: 별도 보조 프로세스와 My Wiki 프로필의 safeStorage 키가 달라 읽기 실패한 인증 정보를 프로필 키로 재암호화했다. 개발판의 연결 상태와 MCP 나챗방 도구 목록 조회를 확인했다. 실제 메시지 전송은 수행하지 않았다. 인증은 해당 개발판 프로필에 저장되어 설치본과 별개다.

2026-10-29 사용자 요청으로 CheilOffice 설치본을 새 설치 파일로 업그레이드했다. 기존 설치본·사용자 프로필·기존 위키 백업은 Documents/CheilOffice/wiki-semantic/installation-1793236289197. 원본 설치 위키가 비어 있음을 확인한 뒤 개발판 위키 자료와 SQLite 일관 사본을 복사했다. 설치본에서 자료 8건, 검토본 17/45건, Markdown 해시와 카카오 연결 및 MCP 도구 조회를 확인했다. 카카오 전송은 설치본에서 재발송하지 않았다.


### CheilOffice 제품 안내 통일 (2026-10-29)
설치 도움말의 릴리스 링크·개인정보 문의·개발 참여 안내를 이 배포본 기준으로 수정했다. 기본 개발자 명령과 새 MCP/스킬 이름은 cheiloffice이며 기존 ieumoffice 런처와 사용자 기록 위치는 호환용으로 유지한다. 기존 에이전트 설정이나 사용자 이력은 일괄 변경하지 않는다. 법적 출처와 라이선스는 NOTICE에 유지한다.


### PDF 작업 화면 재구성 (2026-10-29)
광고대행사 보고서 작업 목적별 왼쪽 탐색과 오른쪽 작업 영역으로 재구성했다. 모든 도구 카드를 한꺼번에 나열하지 않고 선택한 분류만 표시한다. 파일 선택/실행/결과 열기 흐름을 안내한다. 사용자 명시 요청으로 인쇄준비 구역(양면 맞추기·모아찍기·쪽 크기·페이지 분할)을 도구 홈과 시작 요청 진입에서 제외했다. PDF 처리 엔진과 다른 편집기 기능은 유지한다.


### 사용자 제공 아이콘 적용 (2026-10-29)
검정·파랑 패널 심볼과 Cheil Office 워드마크를 새 제품 아이콘으로 적용한다. 작업표시줄/창/파비콘은 텍스트 없는 심볼을 사용하고 앱 헤더는 심볼과 워드마크를 함께 표시한다. 플랫폼 아이콘은 tools/gen-brand-assets.mjs로 생성한다. 사용자 참조 이미지와 생성 소스는 apps/shell/build/brand에 보존한다.

아이콘 색상 후속 변경: 사용자 요청으로 파란 전면 패널을 테마의 네온 라임(#BAFF66 기준)으로 변경했다. 심볼 형태·검정 후면 패널을 유지하고 앱·창·작업표시줄 아이콘 자산을 라임 버전으로 재생성했다. 설치본 재배포 전 개발판 적용이다.

2026-10-29 사용자 승인 라임 심볼을 기존 설치본에 적용했다. 새 PDF 작업 분류·인쇄준비 구역 제거·제품 안내 및 CLI 명칭 변경도 포함했다. 설치본 실행 파일과 app.asar가 패키지와 일치하며 원본 Markdown 해시·검토 이력·카카오 연결·자료 8건 보존을 확인했다. 백업: Documents/CheilOffice/wiki-semantic/installed-lime-1793242375608. Windows 아이콘 표시 갱신 완료.


### 질문 범위와 설정 위치 구분 (2026-10-29)
별표 파일 묶음을 검색하는 기존 AI 질문을 파일에 질문으로 명명했다. My Wiki는 원자료·정리된 지식·변경 검토·이력을 관리하는 주 메뉴로 유지한다. 상단 앱 메뉴는 우측 창 제어 영역 앞에 배치하고 에이전트 진입은 설정으로 옮겼다. 좌하단에 설정 아이콘·연결 제공자/모델과 잔여량 조회 미지원 상태를 표시한다. 실제 잔액/소진율 데이터가 없어 게이지를 만들지 않는다.


### AI 설정과 폴더 작업 역할 재편 (2026-10-29)
설정의 AI/에이전트 별도 메뉴를 AI 설정 및 작업으로 통합했다. 문서·위키용 AI 연결과 폴더 작업을 선택 카드로 구분한다. 폴더 작업은 Claude Code/Codex 프로그램 연결 필요와 파일 읽기·생성·수정 범위를 안내한 후 별도 작업 창으로 진입한다. API 키만으로 준비 완료라고 표시하지 않으며 기존 연결/자료/이력은 변경하지 않는다. 한국어 작업 창 제목도 폴더 작업으로 통일한다.


### 共通 AI 연결 센터와 업무 환경 (2026-10-29)
문서/위키와 폴더별 연결 선택 카드를 제거하고 실제 선택 AI·설정/연결 상태·기능별 사용 가능 범위를 공통 AI 연결 센터에 표시한다. API의 성공 응답은 설정만으로 보장하지 않는다. 현재 폴더 런타임은 구독 프로그램만 지원하며 API 폴더 실행은 구현되지 않았으므로 지원한다고 표시하지 않는다. 일반/정보/개발자 도구는 업무 환경/CheilOffice 안내/업무 확장 설정으로 재편하고 업무 맥락과 레이아웃을 변경했다. 라이선스와 기반 고지 및 사용자 데이터는 보존한다.


### 공통 연결 기반 폴더 자료 작업 (2026-10-29)
문서/위키와 같은 executeCheilChat 제공자 해석과 외부 전송 보호를 사용하는 폴더 자료 작업 추가. 최상위 정규 파일 최대20개/10만 자의 추출 본문을 미리 보고 명시 요청 후 실행한다. 작업마다 설정 사본을 고정해 동시 요청을 분리하고 결과는 새 MD로만 저장한다. 원자료를 수정하거나 셸 명령을 실행하지 않는다. 고급 구독 에이전트는 기존대로 별도 진입 유지. Gemini API 등록 추가, 기본 AI와 건별 AI 선택 구분, 웹 로그인/API/구독 프로그램 차이 안내. 기존 키와 위키 이력 보존.


### 공식 인증 안내와 공통 AI 목록 (2026-10-29)
기존 로그인 감지/개인 구독/회사 계정·SSO/API 연결 경로를 구분했다. 회사 SSO 자체를 앱이 구현하거나 완료로 추정하지 않으며 제공자의 공식 프로그램 인증·권한 확인을 안내한다. 문서의 aiProviderPickerGroups 목록 생성기를 위키 질문·비교·폴더 작업에서도 재사용한다. 셸 작업별 선택은 기본 설정을 덮어쓰지 않고 실행 시 사본을 전달한다. 폴더 동시 작업 결과는 설정창을 닫아도 앱 세션 동안 보존한다. 기존 로그인 정보·자료·이력 변경 없음.


### 내부 업무용 CheilOffice 안내 (2026-10-29)
안내 화면의 상표·저작권 문의와 공개 프로젝트/의견 제출 진입을 제거했다. 광고대행사 내부 캠페인 문서·My Wiki·연결형 AI 활용 목적을 설명한다. 설치 버전과 수동 업데이트, 라이선스 열기 및 기반/상표 고지는 보존했다. 사용자 자료·설정 변경 없음.


### 홈 계정 한도와 업무 확장 화면 (2026-10-29)
Codex 공식 account/rateLimits/read 메타데이터를 모델 호출 없이 읽어 계정별 한도 버킷·사용/잔여 비율·초기화·확인 시각을 홈에 표시한다. 1분/포커스/수동 갱신. 조회 실패는 실패로 표시하고 이전 계정 수치를 디스크에 저장하지 않는다. 앱 내 요청·제공된 스트리밍 토큰·Claude 최근 한도는 세션 집계로 분리한다(일부 호출이므로 계정 총량 아님). 스킬은 업무 절차·스킬로 개편하고 사용 중/양식 필터를 제공한다. 외부 도구는 Drive/작업 스킬/MCP 영역으로 구분하고 내부 AI 연결과 차이를 명시한다. 사용자 키·자료·기존 스킬 보존.


### 사용량 상세 닫기 (2026-10-29)
사용량 확인 버튼은 열기만 수행한다. 상세 우측 상단 닫기 버튼, Escape, 바깥 클릭으로 닫으며 닫기/Escape 뒤 열기 버튼으로 초점을 돌린다. 사용량 조회·로그인·자료 동작 변경 없음.


## 2026-10-29 업무 관련 문서 양식 추가

홈의 광고 문서 양식을 업무 관련 문서 양식으로 변경했다. 같은 영역의 문서 양식 추가에서 DOCX·PPTX·XLSX(50MB 이하)를 선택하면 사용자 프로필의 work-templates에 원본 바이트를 복사하고 카드로 표시한다. 재시작 후 재사용하며, 카드는 등록 파일을 보존한 채 새 제목 없는 편집 문서를 연다. 같은 이름의 파일은 번호를 붙여 보존한다. 취소·읽을 수 없는 파일·과대 파일·잘못된 요청과 홈 이외 IPC를 처리하며 새 AI 호출은 없다. 기존 내 양식·내 스타일의 비활성화 상태는 유지한다. 새 홈 문구는 21개 언어에 제공한다. 설치본 교체·게시·커밋 없음.


## 2026-10-29 등록 문서 양식 이름 변경·삭제

업무 관련 문서 양식의 사용자 등록 카드에 이름 변경·삭제를 추가했다. 이름 변경은 확장자와 내용을 유지하고 중복·예약어·잘못된 경로를 거부한다. 삭제는 확인창에서 영향 범위를 알린 후 등록 사본만 시스템 휴지통으로 이동한다. 원본과 생성 문서는 보존하며, 카드에서 본 수정 시각이 달라졌으면 다시 확인하도록 한다. 21개 언어 문구를 추가했다. 현재 등록은 기존 문서의 내용·서식을 그대로 보관해 새 사본으로 재사용하는 기능이며 LLM 구조 분석·변경 필드 추출은 수행하지 않는다. 사용자에게 이 차이를 명확히 설명했다. 설치본 교체·AI 호출·커밋·푸시 없음.


## 2026-10-29 웹 LLM 업무일지

사용자가 hstry 재사용과 기존 Chrome의 ChatGPT·Claude 웹 유지, 기록 모드 이후 Q/A의 짧은 MD 누적, 실제 확장 연결 검증을 요청했다. hstry c7ea955878223abb11dbdc91ddcdc2428b280a1b의 ChatGPT/Claude 수집기와 공용 헬퍼를 MIT 고지와 함께 resources/llm-journal-extension에 넣었다. 기록 시작 cutoff, 안정적인 메시지 ID, 비표시 메시지 제외, 요청 제한시간을 보완했다. 확장은 별도 웹 로그인·쿠키 반출 없이 기존 Chrome 세션으로 요청하고, 질문/답변 본문만 로컬 수신기에 전달한다. 최초 확장 추가와 로컬 연결값 입력이 필요하다.

홈의 LLM 업무 일지와 업무 도구에 ON/OFF, 연결 안내, 날짜별 기록·MD 열기·폴더 열기를 추가했다. 21개 언어 문구를 제공한다. 수신기는 127.0.0.1:41871, 로컬 페어링 토큰·Host·Origin 검사로 보호한다. 기록은 userData/llm-journal/days/YYYY-MM-DD.md와 짧은 구조 데이터에 저장된다. 기록 이전·OFF 구간 질문은 제외하고 재수집은 갱신한다. 요지는 로컬 발췌이며 의미 요약·사실 검증을 수행하지 않는다. 추가 AI 호출·설치본 교체·계정 파일 접근 없음.

검증: 핵심 단위/실제 루프백 검사 6개 통과, hstry 수정 수집기의 가상 cutoff/메시지 ID 검사 통과. 빌드 통과. Chrome 실행 후 Computer Use가 현재 브라우저 URL을 정책 확인에 충분한 확신으로 판별하지 못해 중단됐다. 그 뒤 UI 자동화는 진행하지 않았다. 따라서 확장 설치/페어링, 실제 두 계정 수집, 최신 앱 화면 검수는 미완료다. 이 상태를 실제 수집 성공으로 보고하면 안 된다. 후속 실행에서 확장 연결과 계정별 새 질문 한 건씩으로 확인할 것. 작업·백업: Documents/CheilOffice/llm-journal-work. 기존 Home.tsx의 미사용 AiMark import와 quickLookPayload 훅 경고는 이번 변경 전 백업에도 있다.



## 2026-10-29 업무일지 최초 연결 0.1.2 보완

사용자는 Chrome에 확장을 로드했으나 최초 연결에서 CONFIG를 보고했다. JSON 복사·붙여넣기 입력을 없애고, 확장이 로컬 요청/완료 경로로 임시 nonce와 6자리 코드를 교환한 뒤 오피스 홈에서 같은 코드를 승인해야 연결키가 한 번 전달되도록 바꿨다. 승인 전/다른 nonce/다른 확장/만료/재사용은 거절한다. 기존 인증 수집 경로는 유지하며 새 확장이나 권한을 추가하지 않았다. 확장 아이콘은 전체 설정 탭을 열고 연결 완료 후 즉시 한 번 동기화한다. 21개 언어 안내도 갱신했다.

검증: 기록·승인 핵심 검사 9개와 실제 임시 루프백 HTTP 승인 흐름 1개 통과(총 10개), 변경 코드 ESLint·셸 타입 검사·최종 빌드 통과. 테스트 데이터만 사용했으며 이 결과는 실제 ChatGPT/Claude 계정 수집 성공을 뜻하지 않는다.

현재 업무일지 개발 실행본은 Documents/CheilOffice/llm-journal-work/profile을 쓰고, 기록 ON은 2026-10-29 17:52:36 KST부터 유지된다. 0.1.2 실행본의 실제 홈 → LLM 업무 일지 화면을 열어 확인했다. 사용자가 같은 확장을 새로고침하고 연결을 눌러 표시되는 6자리 코드를 알려주기를 기다리고 있다. 실제 확장 페어링/두 웹 Q&A 수집은 아직 미확인이다. 브라우저 UI는 현재 URL 판별 오류로 자동 제어가 중단됐던 이력이 있어, 사용자 Chrome 프로필이나 쿠키 파일을 읽거나 우회 제어하지 않는다.

주의: 기본 샌드박스의 Get-Process와 루프백 조회는 실제 데스크톱 프로세스/소켓을 보지 못할 수 있다. Sky의 창 목록과 승인된 비샌드박스 응답 코드로 실행 여부를 확인한다. 검증용 GUI는 launch.ps1의 Normal 창 모드로 열고, 프로세스 준비 직후에는 창의 모니터/좌표가 아직 없을 수 있어 새 창 객체와 상태를 다시 구한다. 브라우저 실제 결과를 가상/루프백 검증과 구분할 것.

## 2026-10-29 업무일지 실제 확장 연결 확인

같은 Chrome 확장 0.1.2의 6자리 코드를 사용자가 전달했고, 오피스 개발 실행본의 같은 코드를 대조해 UI에서 승인했다. 18:42:47 KST 확장 연결 시각, ChatGPT 수집 완료, Claude 로그인 필요 상태를 실제 오피스 화면에서 확인했다. ChatGPT 인증 수집 요청은 정상 완료됐으나 당시 기록 시작 이후 저장된 Q/A는 0건이었다. Claude 상태는 수집기의 401/403 분류 결과이며 실제 로그인·접근 상태는 사용자가 Chrome에서 확인해야 한다.

실제 MD 생성 검증은 아직 미완료다. 사용자에게 각 웹에서 짧은 새 질문 한 건씩과 확장의 지금 수집을 요청했다. 이 상태를 두 제공자의 실제 Q/A 저장 성공으로 표현하지 말 것. 기록 ON과 기존 시작 시각은 유지된다. 상세 증거는 Documents/CheilOffice/llm-journal-work/runtime-verification.json에 비밀값 없이 저장했다.

## 2026-10-29 ChatGPT 실제 Q/A → MD 저장 확인 / 수집 결과 표시 보완

사용자가 Chrome ChatGPT 웹에서 보낸 업무일지 연결 확인 질문과 답변 2가 실제 수집됐다. 2026-10-29.json 1건, 질문 27자·답변 1자, MD 470바이트를 확인했고 기록 시작 이후 시각·길이 제한·원본 링크·MD 본문 일치를 검사했다. 실제 오피스 업무일지 화면에서도 ChatGPT 수집 완료(18:53:05 KST)와 해당 Q/A 카드를 확인했다. 기록 ON은 유지한다. 사용자는 Claude를 테스트하지 않았다고 밝혔으며 Claude 실제 수집은 미검증이다.

확장 0.1.3은 hstry 파서와 재시도를 유지하며 가능한 경우 같은 제공자의 열린 탭에서 같은 출처의 허용된 GET 경로만 요청한다. 쿠키 저장소나 Chrome 프로필 파일을 읽지 않고, 인증값은 브라우저 안에 머문다. 기존 호스트 권한을 유지하고 정적 content script만 추가했다. 탭 경로가 실제로 선택됐는지 별도 계측은 없으므로 실제 저장 성공과 해당 전송 경로의 사용 여부를 구분한다.

사용자가 지금 수집 오류를 보고했다. 기존 작업자는 Claude 로그인 필요를 포함한 제공자별 실패를 전체 ok:false로 묶어 ChatGPT 성공도 일반 WORKER 오류로 보였다. 0.1.4에서 제공자 결과를 따로 반환·번역해 ChatGPT 수집 완료와 Claude 로그인 필요를 각각 표시하고, 수신기 자체 오류는 원래 코드로 보존했다. 실제 작업자에 가상 수집기를 연결한 회귀 검사 3종 및 전송 경로 검사 3종·수집기 cutoff 검사·변경 JS 문법 검사를 통과했다. 이 마지막 표시 수정은 사용자의 기존 확장 새로고침으로 적용되며 실제 확장 화면 재검증은 아직 아니다. 새 설치나 재페어링은 불필요하다.

현재 검증 대상은 열어둔 개발 실행본과 Documents/CheilOffice/llm-journal-work/profile이다. 기존 설치본 교체는 하지 않았다. 최신 근거는 같은 작업 폴더의 runtime-verification.json. MD 열기 버튼 클릭은 사용자 입력 감지로 실행되지 않았으므로 편집기 열기 성공으로 기록하지 않는다. 실제 저장 파일과 업무일지 카드는 검증됐다.

## 2026-10-29 사용자 요청 설치·배포 패키지 ★진짜 최종

사용자가 현 기능까지 포함한 설치·배포 패키지와 폴더명 ★진짜 최종을 요청했다. 수집은 추가 LLM 호출 없이 로컬 발췌로 수행하므로 토큰 사용은 없고, 사용자의 6시간 제안은 비용이 클 때의 조건부 허용으로 해석해 검증된 5분 간격을 유지했다. 현재 0.12.3의 로컬 보완 빌드이며 버전·태그 변경이나 GitHub 공개는 하지 않았다.

전체 8개 편집기·엑셀 엔진·CLI·셸 빌드, 업무일지·연결·제품 식별 단위 28개, 셸 타입 검사, npm 라이선스 검사 통과. 최신 엑셀 엔진을 패키징 경로에 복사했고 엄격한 전체 라이선스 고지를 생성했다. 기존 Electron 배포본으로 Windows x64 NSIS를 publish:never로 만들었다. 실제 설치 파일을 실행하지 않고 압축 해제해 2,815개 파일이 win-unpacked 원본과 SHA-256까지 일치함을 확인했다. 필수 리소스·확장 0.1.4·hstry 고지·개인 프로필 제외·latest.yml SHA-512 일치 확인.

실제 패키지 EXE를 별도 빈 프로필로 실행해 업무일지 화면·preload API, 8개 편집기와 번들 미디어브리프 Excel 열기를 확인했다. 검수 프로필의 일지 수신 포트는 사용 중인 개발 실행본과 충돌하므로 ready:false였고 이 검사를 패키지의 실계정 수집 성공으로 표현하지 않는다. ChatGPT 실제 MD 수집은 앞선 개발 실행본에서 확인한 결과이며 Claude 실수집은 사용자 선택으로 미검증이다. 디지털 서명 상태는 NotSigned. 기존 설치본 교체·설치/제거/업그레이드 시험은 하지 않았다.

최종 위치: C:/Users/CHEIL/Documents/CheilOffice/★진짜 최종. 설치 EXE·같은 빌드의 latest.yml·압축해제된 Chrome 확장과 ZIP·설치안내.md·검수결과.md·라이선스·SHA256.txt를 넣었다. 개인 일지·연결키·검수 프로필은 배포 폴더에 넣지 않았다. 개발 검증 프로필은 원래 위치에 보존하며 설치본으로 자동 이주하지 않는다. 개발 실행본 종료 뒤 설치본에서 최초 연결하도록 안내했다.

설치 파일: CheilOffice-Setup-0.12.3.exe (210,087,829 bytes)
SHA256: 89d43192d1bfeb2908ee0ce01bb31da5a7b5d6319e1815655e8b13ec9c67f040
중간 빌드: Documents/CheilOffice/release-final-2026-10-29-build
검수 로그·스크립트: Documents/CheilOffice/llm-journal-work

