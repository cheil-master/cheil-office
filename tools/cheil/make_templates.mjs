// Cheil fork: sample-derived template authoring. No client material is embedded.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
const modules = process.env.RUNTIME_NODE_MODULES
if (!modules) throw new Error('Set RUNTIME_NODE_MODULES to the artifact-tool runtime packages.')
const runtimeRequire = createRequire(path.join(modules, 'package.json'))
const { Presentation, PresentationFile, Workbook, SpreadsheetFile } = await import(
  pathToFileURL(runtimeRequire.resolve('@oai/artifact-tool')).href
)
const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const out = process.env.CHEIL_TEMPLATE_OUTPUT || path.join(base, 'generated'),
  qa = path.join(out, 'qa')
await fs.mkdir(out, { recursive: true })
await fs.mkdir(qa, { recursive: true })
const font = 'Malgun Gothic',
  ink = '#18212B',
  muted = '#66717C',
  blue = '#204F75'
function text(s, t, x, y, w, h, size = 24, color = ink, bold = false) {
  const a = s.shapes.add({
    geometry: 'textbox',
    position: { left: x, top: y, width: w, height: h },
    fill: 'none',
    line: { fill: 'none', width: 0 },
  })
  a.text = t
  a.text.style = { typeface: font, fontSize: size, color, bold }
  a.text.insets = 0
  return a
}
function table(s, headers, rows) {
  const t = s.tables.add({
    rows: rows.length + 1,
    columns: headers.length,
    left: 64,
    top: 205,
    width: 1152,
    height: Math.min(330, (rows.length + 1) * 78),
    values: [headers, ...rows],
  })
  t.borders.assign({ style: 'solid', fill: '#D9DFE5', width: 1 })
  for (let r = 0; r <= rows.length; r++)
    for (let c = 0; c < headers.length; c++) {
      const v = t.getCell(r, c)
      v.fill = r === 0 ? blue : r % 2 ? '#FFFFFF' : '#F4F6F8'
      v.text.style = {
        typeface: font,
        fontSize: 20,
        color: r === 0 ? '#FFFFFF' : ink,
        bold: r === 0,
      }
    }
  return t
}
const ot = [
  { title: 'OT 및 킥오프', cover: true },
  {
    title: '이번 캠페인의 과제',
    lead: '[이번 캠페인 핵심 과제]',
    fields: [
      ['추진 배경', '[캠페인 배경]'],
      ['달성할 목표', '[캠페인 목표]'],
      ['이번에 요청하는 일', '[이번 OT 요청 범위]'],
    ],
  },
  {
    title: '시장과 지난 캠페인 리뷰',
    lead: '[리뷰에서 확인한 핵심 내용]',
    headers: ['분석 대상', '확인한 내용', '이번 캠페인에 반영할 점'],
    rows: [
      ['시장 및 경쟁', '[시장과 경쟁 현황]', '[시장 분석 시사점]'],
      ['지난 캠페인', '[지난 활동과 결과]', '[리뷰 반영 사항]'],
    ],
    note: '선택 항목 · 확인된 자료가 있는 분석만 사용하고 출처를 함께 적는다.',
  },
  {
    title: '타깃과 커뮤니케이션 목표',
    lead: '[타깃에게 일으킬 인식 또는 행동 변화]',
    fields: [
      ['누구에게', '[타깃]'],
      ['현재 생각과 행동', '[타깃 현황과 근거]'],
      ['소비자 인사이트', '[소비자 인사이트]'],
    ],
  },
  {
    title: '핵심 메시지와 근거',
    lead: '[핵심 메시지]',
    headers: ['제품 또는 서비스의 사실', '소비자에게 줄 편익', '근거 자료'],
    rows: [
      ['[RTB 사실 1]', '[소비자 편익 1]', '[RTB 출처 1]'],
      ['[RTB 사실 2]', '[소비자 편익 2]', '[RTB 출처 2]'],
    ],
  },
  {
    title: '캠페인과 소재의 역할',
    lead: '[캠페인 구성 원칙]',
    headers: ['구분 또는 편명', '역할과 메시지', '접점과 운영 시기'],
    rows: [
      ['[소재 구분 1]', '[소재 역할 1]', '[운영 접점 1]'],
      ['[소재 구분 2]', '[소재 역할 2]', '[운영 접점 2]'],
      ['[소재 구분 3]', '[소재 역할 3]', '[운영 접점 3]'],
    ],
  },
  {
    title: '크리에이티브 방향',
    lead: '[크리에이티브 방향 한 문장]',
    fields: [
      ['컨셉과 표현 방향', '[컨셉과 표현 방향]'],
      ['톤앤매너', '[톤앤매너]'],
      ['필수 요소와 피할 표현', '[필수 요소와 금지 표현]'],
    ],
  },
  {
    title: '소재별 제작 요청',
    lead: '[이번에 구체화할 소재명]',
    fields: [
      ['전달할 내용', '[소재별 전달 내용]'],
      ['스토리와 주요 장면', '[스토리와 장면 요청]'],
      ['제작 시 확인 사항', '[촬영 편집 및 표현 유의사항]'],
    ],
    note: '반복 항목 · 소재가 여러 개면 이 장을 복제하고 각 칸 이름에 소재 구분을 붙인다.',
  },
  {
    title: '레퍼런스',
    lead: '[참고 자료에서 가져올 표현 원칙]',
    fields: [
      ['참고 이미지 또는 영상', '[레퍼런스 제목과 링크]'],
      ['참고할 부분', '[레퍼런스 적용 포인트]'],
      ['그대로 따르지 않을 부분', '[레퍼런스 적용 범위]'],
    ],
    note: '선택 항목 · 원본 이미지나 영상은 사용 권한을 확인한 뒤 직접 넣는다.',
  },
  {
    title: '산출물과 제작 조건',
    lead: '[최종 납품 범위]',
    headers: ['산출물', '규격과 수량', '사용 매체', '납품 기한'],
    rows: [
      ['[산출물 1]', '[규격 수량 1]', '[사용 매체 1]', '[납품 기한 1]'],
      ['[산출물 2]', '[규격 수량 2]', '[사용 매체 2]', '[납품 기한 2]'],
    ],
    note: '[제작 예산 및 권리 조건]',
  },
  {
    title: '진행 일정',
    lead: '캠페인 기간  [캠페인 기간]',
    headers: ['단계', '예정일', '담당과 산출물'],
    rows: [
      ['기획 및 아이디어 보고', '[아이디어 보고일]', '[기획 담당과 산출물]'],
      ['제작 및 시사', '[제작 시사일]', '[제작 담당과 산출물]'],
      ['납품 및 온에어', '[납품 온에어일]', '[납품 담당과 산출물]'],
    ],
  },
  {
    title: '확인할 사항과 다음 할 일',
    lead: '[이번 회의에서 결정할 사항]',
    headers: ['확인 또는 실행할 일', '담당', '기한'],
    rows: [
      ['[다음 할 일 1]', '[다음 담당 1]', '[다음 기한 1]'],
      ['[다음 할 일 2]', '[다음 담당 2]', '[다음 기한 2]'],
    ],
    note: '미정인 사항은 확정 내용과 구분하고 확인할 사람을 적는다.',
  },
]
const result = [
  { title: '캠페인 결과보고서', cover: true },
  {
    title: '결과 요약',
    lead: '[캠페인 결과 핵심 요약]',
    fields: [
      ['목표 대비 결과', '[목표 대비 주요 결과]'],
      ['효과가 있었던 운영', '[효과가 있었던 운영과 근거]'],
      ['다음에 바꿀 점', '[다음 캠페인 개선 요약]'],
    ],
  },
  {
    title: '캠페인 개요',
    lead: '[캠페인명]',
    fields: [
      ['목표와 타깃', '[캠페인 목표와 타깃]'],
      ['기간과 범위', '[캠페인 기간]'],
      ['집행 조건', '[매체와 소재 운영 범위]'],
    ],
    note: '계획 예산  [총예산]',
  },
  {
    title: '미디어 운영 내용',
    lead: '[운영 전략과 실제 변경 내용]',
    headers: ['기간 또는 단계', '매체와 역할', '소재 및 운영 사항'],
    rows: [
      ['[운영 단계 1]', '[매체 역할 1]', '[운영 내용 1]'],
      ['[운영 단계 2]', '[매체 역할 2]', '[운영 내용 2]'],
      ['[운영 단계 3]', '[매체 역할 3]', '[운영 내용 3]'],
    ],
  },
  {
    title: '목표 대비 성과',
    lead: '[목표 달성 평가]',
    headers: ['핵심 지표와 단위', '목표', '실적', '달성률과 해석'],
    rows: [
      ['[성과 지표 1]', '[목표값 1]', '[실적값 1]', '[달성 해석 1]'],
      ['[성과 지표 2]', '[목표값 2]', '[실적값 2]', '[달성 해석 2]'],
      ['[성과 지표 3]', '[목표값 3]', '[실적값 3]', '[달성 해석 3]'],
    ],
    note: '[지표 집계 기간과 출처]',
  },
  {
    title: '매체별 집행 결과',
    lead: '[매체별 성과 핵심 내용]',
    headers: ['매체', '집행액 원', '핵심 실적과 단위', '효율 지표와 해석'],
    rows: [
      ['[집행 매체 1]', '[집행액 1]', '[매체 실적 1]', '[매체 효율 1]'],
      ['[집행 매체 2]', '[집행액 2]', '[매체 실적 2]', '[매체 효율 2]'],
      ['[집행 매체 3]', '[집행액 3]', '[매체 실적 3]', '[매체 효율 3]'],
    ],
    note: '[매체 데이터 출처와 집계 기준]',
  },
  {
    title: '소재별 성과',
    lead: '[성과 차이가 나타난 소재와 이유]',
    headers: ['소재', '비교 지표와 결과', '확인한 점'],
    rows: [
      ['[성과 소재 1]', '[소재 비교 결과 1]', '[소재 해석 1]'],
      ['[성과 소재 2]', '[소재 비교 결과 2]', '[소재 해석 2]'],
    ],
    note: '[소재 비교 기간과 조건]',
  },
  {
    title: '타깃과 접점별 성과',
    lead: '[타깃 또는 접점 분석 요약]',
    headers: ['분석 구분', '결과와 근거', '운영 시사점'],
    rows: [
      ['[분석 구분 1]', '[분석 결과 1]', '[분석 시사점 1]'],
      ['[분석 구분 2]', '[분석 결과 2]', '[분석 시사점 2]'],
    ],
    note: '선택 항목 · 연령별 타깃, 노출 위치 등 비교 가능한 데이터가 있을 때 사용한다.',
  },
  {
    title: '소비자 반응과 추가 효과',
    lead: '[소비자 반응 핵심 내용]',
    fields: [
      ['검색과 참여 반응', '[검색량 참여 반응과 출처]'],
      ['댓글 및 정성 반응', '[댓글 정성 반응과 출처]'],
      ['PR 및 세일즈 연계', '[PR 세일즈 연계와 근거]'],
    ],
    note: '선택 항목 · 관측된 변화와 캠페인의 인과 효과를 구분한다.',
  },
  {
    title: '배운 점과 다음 운영 제안',
    lead: '[다음 운영 방향]',
    headers: ['확인된 사실', '해석', '다음 실행'],
    rows: [
      ['[학습 사실 1]', '[학습 해석 1]', '[다음 실행 1]'],
      ['[학습 사실 2]', '[학습 해석 2]', '[다음 실행 2]'],
      ['[학습 사실 3]', '[학습 해석 3]', '[다음 실행 3]'],
    ],
  },
  {
    title: '데이터 기준과 확인 사항',
    lead: '[보고 범위와 한계]',
    headers: ['자료 또는 지표', '기간과 집계 기준', '미확인 사항'],
    rows: [
      ['[원천 자료 1]', '[집계 기준 1]', '[미확인 사항 1]'],
      ['[원천 자료 2]', '[집계 기준 2]', '[미확인 사항 2]'],
    ],
    note: '누락된 값은 0으로 바꾸지 않는다. 서로 다른 매체의 도달 수는 단순 합산하지 않는다.',
  },
]
async function deck(name, defs) {
  const p = Presentation.create({ slideSize: { width: 1280, height: 720 } })
  for (const [i, d] of defs.entries()) {
    const s = p.slides.add()
    s.background.fill = '#FFFFFF'
    if (d.cover) {
      text(s, d.title, 64, 135, 1152, 75, 48, ink, true)
      text(s, '[캠페인명]', 64, 255, 1152, 80, 36, blue, true)
      text(s, '[광고주]  /  [브랜드·제품]', 64, 365, 1152, 45, 24)
      text(s, '[작성일]  [팀명]  [작성자]', 64, 585, 1152, 36, 20, muted)
    } else {
      text(s, d.title, 64, 48, 1152, 60, 34, ink, true)
      text(s, d.lead, 64, 125, 1152, 58, 25, blue, true)
      if (d.headers) table(s, d.headers, d.rows)
      if (d.fields)
        d.fields.forEach(([label, val], j) => {
          text(s, label, 64, 215 + j * 120, 255, 32, 21, muted, true)
          text(s, val, 345, 211 + j * 120, 870, 90, 26)
        })
      if (d.note) text(s, d.note, 64, 620, 1090, 50, 17, muted)
    }
    text(s, String(i + 1).padStart(2, '0'), 1175, 674, 45, 25, 14, muted)
  }
  await (await PresentationFile.exportPptx(p)).save(path.join(out, name + '.pptx'))
  for (let i = 0; i < p.slides.items.length; i++) {
    const b = await p.export({ slide: p.slides.items[i], format: 'png', scale: 1 })
    await fs.writeFile(path.join(qa, `${name}-${i + 1}.png`), new Uint8Array(await b.arrayBuffer()))
  }
  return { name, p }
}
if (process.argv[2] !== 'sheets') {
  const defs = [
    ['OT 및 킥오프', ot],
    ['결과보고서', result],
  ]
  for (const [name, d] of defs) {
    await deck(name, d)
    console.log('deck', name, d.length)
  }
  await fs.writeFile(path.join(base, 'deck-spec.json'), JSON.stringify({ ot, result }, null, 2))
}
if (process.argv[2] === 'sheets') {
  const w = Workbook.create(),
    s = w.worksheets.add('미디어브리프')
  s.showGridLines = false
  s.getRange('A1:H60').format.font = { name: font, size: 11, color: ink }
  s.getRange('A1:H60').format.rowHeight = 27
  s.getRange('A1:B60').format.columnWidth = 13
  s.getRange('C1:H60').format.columnWidth = 14
  s.getRange('A1:H60').format.verticalAlignment = 'center'
  s.getRange('A1:H60').format.wrapText = true
  function merged(range, t, fill = null, bold = false, size = 11) {
    const r = s.getRange(range)
    r.merge()
    s.getRange(range.split(':')[0]).values = [[t]]
    r.format.font = { name: font, size, bold, color: ink }
    if (fill) r.format.fill = fill
  }
  function section(row, t) {
    merged(`A${row}:H${row}`, t, '#E6EDF3', true, 12)
  }
  function field(row, label, slot, height = 32) {
    merged(`A${row}:B${row}`, label, '#F4F6F8', true)
    merged(`C${row}:H${row}`, slot, '#FFF9E8')
    s.getRange(`A${row}:H${row}`).format.rowHeight = height
  }
  merged('A2:H2', '미디어브리프', null, true, 18)
  s.getRange('A2:H2').format.rowHeight = 38
  merged('A3:H3', '매체 전략과 집행안을 요청하기 위한 캠페인 브리프')
  section(5, '01  캠페인 기본 정보')
  ;[
    ['광고주', '[광고주]'],
    ['브랜드 및 제품', '[브랜드·제품]'],
    ['캠페인명', '[캠페인명]'],
    ['작성일 및 담당', '[작성일]  [팀명]  [작성자]'],
    ['캠페인 기간', '[캠페인 기간]'],
  ].forEach((v, i) => field(i + 6, ...v))
  section(12, '02  배경과 커뮤니케이션 과제')
  field(13, '캠페인 배경', '[캠페인 배경과 현황]', 54)
  field(14, '캠페인 목표', '[캠페인 목표]', 44)
  field(15, '핵심 타깃', '[타깃]', 44)
  field(16, '타깃 세부 조건', '[타깃 연령 지역 관심사]', 44)
  field(17, '핵심 메시지', '[전달 메시지]', 44)
  field(18, '제품 및 근거', '[제품 특장점과 근거]', 44)
  section(20, '03  예산과 집행 조건')
  field(21, '총예산', '[총예산]')
  field(22, '예산 산정 범위', '[매체비 수수료 제작비 VAT 포함 여부]', 44)
  field(23, '집행 기간', '[미디어 집행 기간]')
  field(24, '집행 및 제외 매체', '[희망 매체와 제외 매체]', 44)
  field(25, '매체별 역할', '[도달 조회 유입 전환 등 매체 역할]', 44)
  field(26, '집중 시기 및 지역', '[집중 집행 시기와 지역]', 44)
  section(28, '04  소재와 랜딩')
  field(29, '보유 및 예정 소재', '[소재 종류 편명 초수 수량]', 54)
  field(30, '소재 제공 일정', '[소재 제공일과 교체 일정]', 44)
  field(31, '랜딩 및 행동', '[랜딩 주소와 유도 행동]', 44)
  field(32, '소재 운영 조건', '[타깃별 소재 운영과 필수 고지]', 44)
  section(34, '05  성과 목표와 측정')
  field(35, '핵심 KPI', '[KPI]', 44)
  field(36, '지표 정의와 기준', '[지표 단위 집계 방식 목표 근거]', 54)
  field(37, '측정 및 보고', '[측정 도구와 보고 주기]', 44)
  field(38, '비교 자료', '[이전 캠페인 또는 벤치마크 자료]', 44)
  section(40, '06  제안 요청과 일정')
  field(41, '제안받을 내용', '[미디어 전략 믹스 타깃팅 운영안 요청]', 54)
  field(42, '제안 제출일', '[제안 제출일]')
  field(43, '제출물과 형식', '[견적 시뮬레이션 일정표 등 제출물]', 44)
  field(44, '필수 및 제한 조건', '[브랜드 세이프티 업종 규정 제외 지면]', 54)
  field(45, '확인이 필요한 일', '[확인 항목 담당 기한]', 54)
  field(46, '참고 자료', '[미디어 참고 자료 링크]', 44)
  merged('A48:H48', '노란 칸에 입력한다. 없는 사실이나 숫자는 확인 필요로 남긴다.')
  s.freezePanes.freezeRows(5)
  s.tabColor = blue
  w.recalculate()
  console.log(
    (
      await w.inspect({
        kind: 'match',
        searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?',
        options: { useRegex: true, maxResults: 20 },
      })
    ).ndjson,
  )
  await (await SpreadsheetFile.exportXlsx(w)).save(path.join(out, '미디어브리프.xlsx'))
  for (const [n, range] of ['A1:H18', 'A20:H38', 'A40:H48'].entries()) {
    const b = await w.render({ sheetName: s.name, range, scale: 1.5, format: 'png' })
    await fs.writeFile(path.join(qa, `media-${n + 1}.png`), new Uint8Array(await b.arrayBuffer()))
  }
  console.log('xlsx saved')
}
