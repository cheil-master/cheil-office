# 문서 스타일과 브랜드 자료 연동 검토

2026년 10월 28일. 문서의 외관을 재사용하는 스타일 화면과 선택형 브랜드 로고 도구를 실제 앱에 연결했다. 스타일 저장·재사용과 새 Office 문서 만들기를 지원한다. 현재 동작과 검수 결과는 docs/cheil-style-library.md를 기준으로 한다. 아래에는 데이터 이용 조건과 OCR 검토 근거를 남긴다.

## 아이콘과 기존 양식

홈의 새 폴더형 버튼은 `Home.tsx`의 `cheil-office-folder`와 `CheilChrome.css`로 그린다. 그 안에서는 기존 `FileBadge`와 `assets/file-*.svg`를 사용한다. 버튼의 모양과 배치는 새로워졌으나 파일 아이콘을 전부 새로 그린 것은 아니다.

기존 ‘내 양식’은 DOCX·PPTX·XLSX의 사본을 만들고 변하는 값을 [칸]으로 바꾼다. 이번 스타일 기능은 그와 함께 두는 별도 선택지다. 내용과 배치를 복제하지 않고 글꼴 이름, 색, 크기, 기본 도형 종류를 추출한다. 직접 지정한 서식과 테마의 참고 값을 구분하므로 마스터를 쓰지 않고 수동으로 만든 문서도 분석 대상이다.

`document-style.ts`는 ZIP의 실제 해제 크기를 검사한 뒤 서식 XML만 분석한다. 본문 문자열, 셀 값, 수식, 이미지, 원본의 절대 위치를 결과에 넣지 않는다. 글꼴 파일도 추출하거나 배포하지 않는다. XLSX에는 미사용 서식이 포함될 수 있고, PPT 마스터·레이아웃·테마 덮어쓰기와 색 변형은 완전히 복원하지 않으므로 미리보기에서 사용할 값을 고른다. PDF·이미지·HWP의 스타일 추출은 이 후보에 포함하지 않는다.

선택한 폰트·제목과 본문 크기·강조색·본문색·바탕색은 `STYLE.md`의 `selection`에 저장한다. `style-instructions.ts`는 그 값만 검증해서 후속 작성 지시문을 만든다. Markdown의 임의 산문이나 외부 문서의 지시를 실행하지 않는다. 실제 앱은 선택한 스타일로 새 DOCX·PPTX·XLSX 시작 문서를 만든다. 기존 문서를 자동으로 재서식화하지 않는다.

## getdesign 연동과 이용 조건

getdesign의 공개 저장소는 코드에 MIT, 카탈로그가 작성한 산문과 토큰 표현 등에 CC BY 4.0을 적용한다. 브랜드 로고·이미지·외부 글꼴은 이 허용 범위에서 제외한다. 따라서 카탈로그의 스타일 토큰을 문서용으로 바꾸고 출처·라이선스 링크·변환 사실을 보존하는 방식으로 사용할 수 있다. 각 브랜드의 공식 서식이나 브랜드 자산 이용 허가로 안내하지 않는다. 근거: [LICENSE-CONTENT](https://github.com/CaesiumY/ko-design-md/blob/main/LICENSE-CONTENT), [NOTICE](https://github.com/CaesiumY/ko-design-md/blob/main/NOTICE).

`style-catalog.ts`는 공개 색인을 한 번 읽고 브랜드명 검색을 로컬에서 수행한다. 사용자가 항목을 고를 때 그 항목의 `.tokens.json`만 읽는다. 전체 브랜드의 Markdown·로고·프리뷰를 묶어 배포하지 않는다. 검토한 저장소의 고정 커밋을 사용해 나중에 원본이 바뀌어도 불러온 값의 출처를 확인할 수 있다. 웹의 px를 pt로, OKLCH를 문서용 sRGB 색으로 변환한 사실을 남긴다. 색역 밖의 색은 잘라 표현하므로 완전히 같은 인쇄색을 보장하지 않는다.

새 문서에는 카탈로그 스타일의 출처와 CC BY 고지를 문서 속성 및 출처 파일로 함께 저장한다. 공유할 때도 해당 고지를 보존한다. 글꼴 이름만으로 글꼴 사용권을 판단하지 않고 사용자가 설치한 글꼴로 지정한다. 새 스타일을 공식 브랜드 문서로 표시하지 않는다.

## 손글씨와 OCR

두 Threads 공유 주소는 모두 BYEORY JEONG의 같은 게시물로 연결된다. 공개 게시물은 한국어 손글씨를 보완한 PP-OCRv5 인식 모델을 소개하고, kordoc에서도 선택적으로 사용할 수 있다고 설명한다. [게시물](https://www.threads.com/@byeory_dev/post/Denez2mD7Dm), [손글씨 모델 저장소](https://github.com/VerifiedIdiot/korean-handwriting-rec).

kordoc은 HWP·HWPX·PDF·Office·이미지를 Markdown과 구조 데이터로 읽는 MIT 도구이며, 손글씨 인식 모델은 Apache-2.0이다. 손글씨 인식 모델 하나는 약 15MB이지만 검출 모델, 사전, ONNX 실행 구성요소가 별도로 필요하다. kordoc의 선택형 손글씨 옵션과 고정 모델 SHA256을 확인했다. 모델 제공자의 벤치마크 수치를 이 앱의 정확도로 제시하지 않는다. [kordoc](https://github.com/chrisryugj/kordoc), [OCR 모델 선택 코드](https://github.com/chrisryugj/kordoc/blob/main/src/ocr/models.ts).

현재 앱은 Windows 로컬 OCR과 선택한 PDF 페이지의 Azure 정밀 읽기를 제공한다. 새 엔진은 로컬 선택 설치 옵션으로 두는 구성이 적합하다. 실제 구현에서는 별도 작업 프로세스에서 실행하고, 모델을 오프라인으로 읽게 하며, 원본은 보존한 채 결과를 비교한 뒤 위키에 반영한다. Azure의 페이지 확인과 건별 전송·비용 동의는 유지한다. 이번 작업에서는 새 OCR 패키지·모델을 설치하지 않았으며 새 엔진의 실제 인식도 실행하지 않았다.

## 브랜드 로고 검색

theSVG는 공개 정적 색인과 SVG 주소를 제공하므로 사이트 화면을 삽입하지 않고 작은 검색창으로 연결할 수 있다. 공개 색인을 받은 뒤 검색은 로컬에서 하고, 사용자가 고른 로고만 받는다. 실제 GitHub 로고 검색과 미리보기를 확인했다. [공식 API 문서](https://github.com/GLINCKER/thesvg/blob/main/docs/cdn-api.md).

코드의 MIT 라이선스가 모든 로고의 권리를 허용하는 것은 아니다. 결과마다 제공자가 표시한 개별 라이선스, 원본 주소와 브랜드 가이드 링크를 함께 표시한다. Fair Use·Proprietary·Unknown 등의 표시는 이용 허가를 확인한 것으로 바꾸지 않는다. 앱 자체의 제품 아이콘은 기존 원칙을 유지하며, 이 기능의 로고는 사용자가 찾는 문서 자료다. [theSVG 법적 고지](https://github.com/GLINCKER/thesvg/blob/main/LEGAL.md).

`brand-library.ts`는 실행 코드·이벤트·외부 참조·스타일시트가 없는 보수적인 SVG 범위만 미리보기용으로 허용한다. 지원하지 않는 SVG는 원본 페이지로 안내한다. 로고를 저장할 때 원본 주소와 제공자의 라이선스 표시를 출처 파일에 함께 남긴다. 브랜드 가이드에 맞는 문서 사용은 개별 권리 조건을 따른다.

## 구현과 검수 기록

현재 화면과 기능은 docs/cheil-style-library.md, 새 설치 후보는 Documents/CheilOffice/release-styles-2026-10-28-final에 있다. 시안은 Documents/CheilOffice/style-integration-2026-10-28, 실제 앱의 검수 기록은 Documents/CheilOffice/style-implementation-2026-10-28에 보존한다. 스타일 화면과 업무 도구의 선택형 로고 검색은 승인된 범위로 구현했다. 손글씨·kordoc OCR 모델은 검토 단계다.
