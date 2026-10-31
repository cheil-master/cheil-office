/** Cheil fork: work-template catalog text. */
import type { zh } from './zh'

export const ko = {
  label: '업무 관련 문서 양식',
  add: '문서 양식 추가',
  adding: '추가하는 중…',
  hint: 'Word·PPT·Excel 파일(최대 50MB)의 내용과 서식을 그대로 보관해 새 문서 사본으로 재사용하세요.',
  own: '내가 추가',
  use: '새 문서 만들기',
  loading: '저장된 양식을 불러오는 중…',
  retry: '다시 시도',
  added: '문서 양식을 추가했습니다. 카드를 누르면 새 문서 사본이 열립니다.',
  failed: '양식을 불러오지 못했습니다. 파일과 저장 폴더를 확인한 뒤 다시 시도해 주세요.',
  unreadable: '파일을 읽지 못했습니다. DRM·암호를 해제하고 정상적으로 열리는 문서를 선택해 주세요.',
  tooLarge: '50MB 이하의 파일을 선택해 주세요.',
  rename: '이름 변경',
  remove: '삭제',
  renameTitle: '문서 양식 이름 변경',
  nameLabel: '양식 이름',
  nameHint: '확장자는 유지됩니다. 새 이름만 입력하세요.',
  save: '저장',
  cancel: '취소',
  deleteTitle: '문서 양식을 삭제할까요?',
  deleteHint:
    '등록된 양식 사본을 휴지통으로 이동합니다. 원본 파일과 이 양식으로 만든 문서는 유지됩니다.',
  confirmDelete: '휴지통으로 이동',
  renamed: '양식 이름을 변경했습니다.',
  deleted: '등록된 양식을 휴지통으로 이동했습니다.',
  invalidName: '사용할 수 없는 이름입니다. 경로 기호와 예약어 없이 150자 이내로 입력하세요.',
  exists: '같은 이름의 양식이 있습니다. 다른 이름을 입력하세요.',
  working: '처리 중…',
  changed: '양식이 다른 곳에서 변경되었습니다. 새로 표시된 카드에서 다시 시도해 주세요.',
} satisfies Record<keyof typeof zh, string>
