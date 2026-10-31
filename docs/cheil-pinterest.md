
## 2026-10-28 Pinterest 무드보드 → 스타일 MD

실제 최신 개발판 UI에서도 내 보드 새로고침 → 선택 보드 이미지 5개 → 보드 스타일 MD로 저장 → 편집기 미리보기 적용을 확인했다. 생성 MD는 개발판 프로필 document-styles에 저장됐고, 전달본은 Documents/CheilOffice/하반기 구독캠페인_STYLE.md다. 마지막 리디렉션 수정 후 Electron E2E 2개, typecheck, ESLint, build도 통과했다.

실제 Electron session.fetch의 manual redirect는 응답을 주기 전에 “Redirect was cancelled”로 실패했다. net.request의 redirect 이벤트에서 허용된 Pinterest www/kr HTTPS 호스트만 최대 3회 followRedirect하고, 전용 세션·60초 제한·스트림 용량 제한을 유지하도록 수정했다. 실제 계정 보드와 선택한 보드 이미지 5개를 이 서비스로 읽고 로컬 분석이 성공했다.

로그인 후 계정 식별은 인증된 context.user와 initialReduxState.session.userId → users 연결을 지원한다. 보드/핀 요청에 실제 웹 화면의 요청 헤더와 source URL을 포함하며 앱 버전은 현재 HTML에서 읽는다. 고정 배포 해시·브라우저 쿠키 복사·외부 스크래퍼 의존성을 넣지 않는다. resource_response.bookmark와 기존 resource.options.bookmarks 모두 처리한다. 응답 대기 상한은 60초다.

선택한 보드에서 받은 최대 30개 이미지 중 읽을 수 있는 이미지를 nativeImage로 48×48로 줄여 로컬에서 대표색 8개까지 추출한다. 그림·본문·계정 비밀값은 MD에 넣지 않는다. 색상은 근사값이며 글꼴(맑은 고딕), 크기(28/12pt), 밝은 배경, 읽기 쉬운 강조색과 여백 지침은 문서 추천값이다. 구도·레이아웃·원본 글꼴을 자동 인식했다고 표시하지 않는다. 강조색/본문색은 기본 배경 대비 4.5:1 이상으로 제안한다.

‘보드 스타일 MD로 저장’은 기존 UUID 기반 document-styles 라이브러리에 MD를 저장하고 편집기에 선택한다. 이름·색·글꼴 수정, MD 열기/내보내기/다시 불러오기, 스타일 적용 새 Word/PPT/Excel 문서 경로를 재사용한다. MD에는 출처 보드 URL, 분석/미리보기/전체 핀 수, 기준 시각과 일부 이미지 실패 여부를 남긴다. 외부 AI 호출이나 유료 API가 없다. 원본 이미지 재배포 권한을 부여하는 기능은 아니다.

관련 검사: cheil-pinterest, cheil-moodboard, cheil-style-library, cheil-style-integration 단위 검사 39개 통과. 가상 Pinterest Electron E2E는 연결·리디렉션·탐색 제한·MD 저장/재읽기를 검증한다. 가상 검사는 실제 서비스 검증과 구분한다. 실제 계정 보드/선택한 보드 핀 조회 성공을 별도로 확인했다. 설치본 교체·커밋·푸시 없음.

# Pinterest 계정 연결

## 2026-10-28 Pinterest 연결 개발판

내 양식 → 스타일만 추출 화면에 Pinterest 연결, 보드 목록/더 보기, 선택한 보드의 이미지 미리보기(최대 30개), 연결 해제를 추가했다. API 키나 Python 패키지 없이 Electron 전용 persistent session으로 동작한다. 일반 Chrome/Edge 쿠키를 읽지 않는다. 로그인은 Pinterest 자체 페이지에서 직접 하며 Node/preload 없이 sandbox/contextIsolation을 켠다. 외부 로그인 팝업은 차단하므로 Pinterest 자체 로그인 경로를 사용한다. 5분 후 로그인 창을 닫는다.

세션은 앱 userData의 persist:cheil-pinterest 파티션에 Chromium이 보관한다. 쿠키 값/비밀번호/원문 오류를 홈 IPC나 로그에 보내지 않는다. 연결 해제는 해당 파티션의 저장소와 캐시만 지운다. 홈 화면만 기존 style IPC로 접근할 수 있다. 명시적인 연결·새로고침·보드 선택 때만 Pinterest와 i.pinimg.com에 요청하며 외부 AI 요청은 없다. 보드 메타데이터는 메모리만 사용하고, 이미지는 제한된 MIME/용량의 data URI로 전달한다. 기존 CSP를 넓히지 않는다.

Pinterest 비공식 웹 응답의 session.user 및 Boards/BoardFeed 리소스를 사용하는 독립 구현이다. 외부 스크래퍼 코드를 복사하거나 배포 의존성으로 넣지 않았다. 응답 스키마/로그인 흐름 변경, CAPTCHA, 외부 소셜 로그인은 실제 계정으로 확인해야 한다. 단위/가상 서버 테스트는 실제 서비스 연결의 증명이 아니다. 자동 스타일 분석·스타일 후보 생성·저장된 스타일 연결은 이번 연결 기능에 포함하지 않는다.

코드: apps/shell/src/main/cheil/pinterest-{service,data}.ts, shared/cheil-pinterest-api.ts, renderer/src/cheil/PinterestPanel.tsx. 테스트: apps/shell/tests/cheil-pinterest.test.ts, e2e/cheil-pinterest.spec.ts. 기존 설치본 교체·커밋·푸시 없음. 검수 자료와 개발판 실행기는 Documents/CheilOffice/pinterest-dev.


## 2026-10-28 Pinterest 로그인 창 즉시 종료 수정

실제 빈 프로필에서 www.pinterest.com/login/ → kr.pinterest.com/login/ 리디렉션 직후 창이 닫힘을 재현했다. 허용 호스트가 www 하나였고 loadURL 실패 때 창을 닫는 코드가 원인이었다. 로그인 창에 한해 www/kr의 HTTPS 탐색을 허용하고 로컬 SPA용 전역 will-navigate 리스너를 엄격한 로그인 전용 규칙으로 교체했다. 다른 창의 공통 탐색 잠금은 변경하지 않았다. HTTP 리디렉션도 최대 4회, 같은 Pinterest 허용 호스트만 따라간다. 외부/로컬 주소·새 창·다운로드·권한 허용은 계속 차단한다.

로드 실패는 원문 URL/개인정보 없이 오류 코드와 재시도/취소 창을 표시한다. ERR_ABORTED는 새 탐색에 의해 생길 수 있어 자동 종료하지 않는다. _auth 쿠키만으로 성공 처리하지 않고 로그인된 사용자 메타데이터 확인 후 자동으로 닫는다. 쿠키 변경 시에도 검증한다. 테스트에 한국 리디렉션, 같은 사이트 탐색, 외부 탐색 차단, 오래된 인증 쿠키를 추가했다. 기존 첫 테스트는 지역 리디렉션을 재현하지 못했으므로 실제 로그인 검증을 대체할 수 없었다.
