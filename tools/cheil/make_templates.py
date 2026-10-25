# -*- coding: utf-8 -*-
"""Cheil 기획 오피스 기본 양식 만들기.

apps/shell/resources/builtin-skills/cheil-*/assets/ 아래에 양식 문서를 만든다.
숫자·이름 예시를 넣지 않는다. 채울 자리는 [ ] 로만 둔다.

  python -I tools/cheil/make_templates.py

글꼴은 회사 PC 어디에나 있는 '맑은 고딕'. 색은 기본 서식용 중립색이고
회사 공식 서식이 있으면 양식 파일만 바꿔 끼우면 된다.

같은 정보(광고주, 캠페인명, 기간, 예산, 타깃, KPI, 팀, 작성자, 작성일)는
모든 양식에서 같은 칸 이름을 쓴다. 이름은 packages/ui/src/cheil-fields.json
한 곳에서 정하고, 만든 뒤 check_placeholders()가 다시 읽어 확인한다.
- 공통 칸은 사전의 이름만 쓴다(별칭 [광고주명] 등은 쓰면 실패).
- 공통 칸이 아닌 칸은 한 문서 안에서 한 번만 나온다(같은 글이면 찾아 바꾸기가
  엉뚱한 칸까지 바꾼다). 공통 칸은 값이 같으니 여러 번 나와도 된다.
"""
import copy
import json
import re
import sys
import zipfile
from pathlib import Path

from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Emu, Pt
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, RGBColor as DocxRGB, Pt as DocxPt
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[2]
SKILLS = ROOT / "apps" / "shell" / "resources" / "builtin-skills"
FIELDS_JSON = ROOT / "packages" / "ui" / "src" / "cheil-fields.json"

FIELDS = json.loads(FIELDS_JSON.read_text(encoding="utf-8"))["fields"]
# 공통 칸: 사전 이름 → 칸. 양식 안에서는 F["client"] 처럼 꺼내 쓴다.
F = {f["key"]: f["placeholder"] for f in FIELDS}

FONT = "맑은 고딕"
INK = "1A1A1A"
SUB = "5A5F66"
ACCENT = "0B3D91"  # 기본 서식 강조색(회사 공식 색 아님)
LINE = "D5D9E0"
FILL = "EEF2F8"

A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"


def rgb(hex6):
    return RGBColor.from_string(hex6)


# ---------------------------------------------------------------- PowerPoint


def _set_theme_fonts(prs):
    """테마의 제목·본문 글꼴을 맑은 고딕으로(라틴·동아시아 모두)."""
    master = prs.slide_master
    for rel in master.part.rels.values():
        if rel.reltype.endswith("/theme"):
            theme = rel.target_part
            root = etree.fromstring(theme.blob)
            for tag in ("majorFont", "minorFont"):
                for el in root.iter("{%s}%s" % (A_NS, tag)):
                    for kind in ("latin", "ea"):
                        node = el.find("{%s}%s" % (A_NS, kind))
                        if node is not None:
                            node.set("typeface", FONT)
            theme._blob = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
            return


def _master_bar(prs):
    """마스터에 위쪽 강조 막대를 넣는다(장마다 지울 수 있는 도형이 되지 않게)."""
    layout = prs.slide_layouts[6]
    tmp = prs.slides.add_slide(layout)
    bar = tmp.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, Emu(91440))
    bar.fill.solid()
    bar.fill.fore_color.rgb = rgb(ACCENT)
    bar.line.fill.background()
    el = copy.deepcopy(bar._element)
    prs.slide_master.shapes._spTree.append(el)
    # 임시 장 지우기
    sldIdLst = prs.slides._sldIdLst
    rid = sldIdLst[-1].rId
    prs.part.drop_rel(rid)
    sldIdLst.remove(sldIdLst[-1])


def _style_runs(tf, size, color=INK, bold=False):
    for p in tf.paragraphs:
        for r in p.runs:
            r.font.size = Pt(size)
            r.font.color.rgb = rgb(color)
            r.font.bold = bold
            r.font.name = FONT


def _title(slide, text, size=28):
    t = slide.shapes.title
    t.text = text
    _style_runs(t.text_frame, size, INK, True)
    return t


def _bullets(shape, lines, size=18):
    tf = shape.text_frame
    tf.clear()
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = line
        p.level = 0
    _style_runs(tf, size, INK)


def _kicker(slide, prs, text):
    """제목 위 작은 구획 이름(예: 03 과제 정의)."""
    box = slide.shapes.add_textbox(Emu(457200), Emu(228600), Emu(6000000), Emu(320040))
    box.text_frame.text = text
    _style_runs(box.text_frame, 12, ACCENT, True)


def _table(slide, prs, header, rows, top=Emu(1700000), height_row=Emu(420000)):
    left = Emu(457200)
    width = prs.slide_width - Emu(914400)
    shape = slide.shapes.add_table(len(rows) + 1, len(header), left, top, width, height_row * (len(rows) + 1))
    tbl = shape.table
    for c, h in enumerate(header):
        cell = tbl.cell(0, c)
        cell.text = h
        cell.fill.solid()
        cell.fill.fore_color.rgb = rgb(ACCENT)
        _style_runs(cell.text_frame, 13, "FFFFFF", True)
    for r, row in enumerate(rows, start=1):
        for c, v in enumerate(row):
            cell = tbl.cell(r, c)
            cell.text = v
            cell.fill.solid()
            cell.fill.fore_color.rgb = rgb("FFFFFF" if r % 2 else FILL)
            _style_runs(cell.text_frame, 13, INK)
    return shape


def _new_deck():
    prs = Presentation()
    prs.slide_width = Emu(12192000)
    prs.slide_height = Emu(6858000)
    _set_theme_fonts(prs)
    _master_bar(prs)
    return prs


def _cover(prs, title, lines):
    s = prs.slides.add_slide(prs.slide_layouts[0])
    _title(s, title, 40)
    sub = s.placeholders[1]
    _bullets(sub, lines, 18)
    for p in sub.text_frame.paragraphs:
        p.alignment = PP_ALIGN.CENTER
        for r in p.runs:
            r.font.color.rgb = rgb(SUB)
    return s


def _content(prs, kicker, title, lines):
    s = prs.slides.add_slide(prs.slide_layouts[1])
    _kicker(s, prs, kicker)
    _title(s, title)
    _bullets(s.placeholders[1], lines)
    return s


def _table_slide(prs, kicker, title, header, rows, note=None):
    s = prs.slides.add_slide(prs.slide_layouts[5])
    _kicker(s, prs, kicker)
    _title(s, title)
    _table(s, prs, header, rows)
    if note:
        box = s.shapes.add_textbox(Emu(457200), prs.slide_height - Emu(800000), prs.slide_width - Emu(914400), Emu(400000))
        box.text_frame.text = note
        _style_runs(box.text_frame, 11, SUB)
    return s


def make_proposal(path):
    prs = _new_deck()
    _cover(prs, F["campaign"], [f"{F['client']} 제안", f"{F['date']}  ·  {F['team']}"])
    _content(prs, "목차", "목차", [
        "01  과제 정의", "02  시장·경쟁 환경", "03  타깃과 인사이트", "04  전략 방향",
        "05  크리에이티브 컨셉", "06  실행 아이디어", "07  미디어 전략", "08  일정·예산", "09  KPI와 측정",
    ])
    _content(prs, "01  과제 정의", "[과제를 한 문장으로: 무엇을 누구에게서 얼마나]", [
        "사업 과제: [광고주가 풀려는 사업 문제]",
        "커뮤니케이션 과제: [광고가 바꿔야 할 인식·행동]",
        f"목표 KPI: {F['kpi']}",
        "근거: [RFP·브리프의 해당 문장]",
    ])
    _content(prs, "02  시장·경쟁 환경", "[시장에서 보이는 결론 한 문장]", [
        "[시장 사실 1] (출처: [시장 사실 1의 자료명·날짜])",
        "[시장 사실 2] (출처: [시장 사실 2의 자료명·날짜])",
        "[경쟁사 동향] (출처: [경쟁사 동향의 자료명·날짜])",
        "시사점: [그래서 우리에게 무엇이 열려 있나]",
    ])
    _content(prs, "03  타깃과 인사이트", "[타깃의 숨은 긴장을 한 문장으로]", [
        f"핵심 타깃: {F['target']}",
        "지금의 행동·인식: [자료로 확인된 것]",
        "인사이트: [~하지만 ~하다 꼴의 한 문장]",
    ])
    _content(prs, "04  전략 방향", "[핵심 메시지]", [
        "핵심 메시지: [타깃이 기억할 한 문장]",
        "믿을 이유 1: [제품·서비스 근거 1]",
        "믿을 이유 2: [제품·서비스 근거 2]",
        "톤: [말투·분위기]",
    ])
    _content(prs, "05  크리에이티브 컨셉", "[컨셉 문구]", [
        "컨셉 설명: [왜 이 말인가, 2줄]",
        "핵심 장면: [광고 한 장면 묘사]",
    ])
    _content(prs, "06  실행 아이디어", "[실행 전체를 묶는 한 문장]", [
        "[채널 1]: [채널 1의 실행 내용]",
        "[채널 2]: [채널 2의 실행 내용]",
        "[채널 3]: [채널 3의 실행 내용]",
    ])
    _table_slide(prs, "07  미디어 전략", "[미디어 운영 원칙 한 문장]",
                 ["단계", "목표", "주요 매체", "역할"],
                 [[st, f"[{st} 목표]", f"[{st} 매체]", f"[{st} 매체의 역할]"] for st in ("인지", "관심·탐색", "전환")])
    _table_slide(prs, "08  일정·예산", "일정과 예산",
                 ["구분", "기간", "예산(원)", "비고"],
                 [[st, f"[{st} 기간]", f"[{st} 예산]", f"[{st} 비고]"] for st in ("준비·제작", "런칭", "유지·확산")]
                 + [["합계", F["period"], F["budget"], ""]],
                 note="자료에 없는 금액·날짜는 비워 두고 [확인 필요]로 표시")
    _table_slide(prs, "09  KPI와 측정", "무엇으로 성공을 판단하나",
                 ["지표", "목표", "측정 방법", "측정 시점"],
                 [[f"[KPI {i}]", f"[KPI {i} 목표]", f"[KPI {i} 측정 방법]", f"[KPI {i} 측정 시점]"] for i in (1, 2, 3)])
    _cover(prs, "[맺음: 핵심 메시지 한 번 더]", ["감사합니다", F["team"]])
    prs.save(path)


def make_monthly(path):
    prs = _new_deck()
    _cover(prs, f"{F['client']} {F['campaign']} [월] 성과 보고", [f"{F['date']}  ·  {F['team']}"])
    _content(prs, "요약", "[이번 달 결론 한 문장]", [
        "성과: [핵심 지표 달성 결과]",
        "원인: [가장 큰 원인 하나]",
        "다음 달: [제안 요약]",
    ])
    _table_slide(prs, "01  KPI 달성", "[KPI 결과 한 문장]",
                 ["지표", "목표", "실적", "달성률", "전월 대비"],
                 [[f"[지표 {i}]", f"[지표 {i} 목표]", f"[지표 {i} 실적]", f"[지표 {i} 달성률]", f"[지표 {i} 전월 대비]"] for i in (1, 2, 3)],
                 note="달성률 = 실적 ÷ 목표. 숫자는 실적표에 있는 것만 씀")
    _table_slide(prs, "02  매체별 성과", "[매체 성과 한 문장]",
                 ["매체", "집행 금액(원)", "노출", "클릭", "CTR", "CPC(원)"],
                 [[f"[매체 {i}]", f"[매체 {i} 집행 금액]", f"[매체 {i} 노출]", f"[매체 {i} 클릭]", f"[매체 {i} CTR]", f"[매체 {i} CPC]"] for i in (1, 2, 3)]
                 + [["합계", "[집행 금액 합계]", "[노출 합계]", "[클릭 합계]", "[전체 CTR]", "[전체 CPC]"]])
    _content(prs, "03  크리에이티브별 성과", "[잘된 소재와 이유 한 문장]", [
        "[소재 1]: [소재 1의 지표와 해석]",
        "[소재 2]: [소재 2의 지표와 해석]",
    ])
    _content(prs, "04  원인 분석", "[결과를 만든 원인 한 문장]", [
        "잘된 점: [잘된 점 — 사실과 근거 숫자]",
        "아쉬운 점: [아쉬운 점 — 사실과 근거 숫자]",
        "외부 요인: [시즌·경쟁·이슈, 출처]",
    ])
    _content(prs, "05  다음 달 제안", "[다음 달 방향 한 문장]", [
        "제안 1: [제안 1 — 무엇을 / 왜 / 기대 효과]",
        "제안 2: [제안 2 — 무엇을 / 왜 / 기대 효과]",
        "제안 3: [제안 3 — 무엇을 / 왜 / 기대 효과]",
    ])
    _content(prs, "부록", "데이터 출처", [
        "실적: [매체 리포트·파일명, 추출일]",
        "목표: [합의 문서·날짜]",
    ])
    prs.save(path)


# ---------------------------------------------------------------- Word


def _doc_fonts(doc):
    for name in ("Normal", "Title", "Heading 1", "Heading 2", "Table Grid"):
        try:
            st = doc.styles[name]
        except KeyError:
            continue
        st.font.name = FONT
        rpr = st.element.get_or_add_rPr()
        fonts = rpr.find(qn("w:rFonts"))
        if fonts is None:
            fonts = etree.SubElement(rpr, qn("w:rFonts"))
        for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
            fonts.set(qn(attr), FONT)
        # 테마 글꼴 지정이 있으면 지운다(맑은 고딕이 이기게)
        for attr in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
            if fonts.get(qn(attr)) is not None:
                del fonts.attrib[qn(attr)]
    doc.styles["Normal"].font.size = DocxPt(10.5)
    doc.styles["Title"].font.size = DocxPt(22)
    doc.styles["Title"].font.color.rgb = DocxRGB.from_string(INK)
    for h, size in (("Heading 1", 14), ("Heading 2", 12)):
        doc.styles[h].font.size = DocxPt(size)
        doc.styles[h].font.color.rgb = DocxRGB.from_string(ACCENT)
    sec = doc.sections[0]
    sec.page_height, sec.page_width = Cm(29.7), Cm(21.0)
    sec.left_margin = sec.right_margin = Cm(2.2)
    sec.top_margin = sec.bottom_margin = Cm(2.0)


def _shade(cell, hex6):
    tcPr = cell._element.get_or_add_tcPr()
    shd = etree.SubElement(tcPr, qn("w:shd"))
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex6)


def _meta_table(doc, pairs):
    t = doc.add_table(rows=len(pairs), cols=2)
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, (k, v) in enumerate(pairs):
        t.cell(i, 0).text = k
        t.cell(i, 1).text = v
        _shade(t.cell(i, 0), FILL)
        t.cell(i, 0).paragraphs[0].runs[0].bold = True
        t.cell(i, 0).width = Cm(4.0)
        t.cell(i, 1).width = Cm(12.6)
    return t


def _grid(doc, header, rows):
    t = doc.add_table(rows=len(rows) + 1, cols=len(header))
    t.style = "Table Grid"
    for c, h in enumerate(header):
        cell = t.cell(0, c)
        cell.text = h
        _shade(cell, FILL)
        cell.paragraphs[0].runs[0].bold = True
    for r, row in enumerate(rows, start=1):
        for c, v in enumerate(row):
            t.cell(r, c).text = v
    return t


def _section(doc, title, prompts):
    doc.add_heading(title, level=1)
    for p in prompts:
        doc.add_paragraph(p, style="List Bullet")


def make_brief(path):
    doc = Document()
    _doc_fonts(doc)
    doc.add_paragraph("크리에이티브 브리프", style="Title")
    _meta_table(doc, [
        ("광고주", F["client"]), ("브랜드·제품", F["brand"]), ("캠페인명", F["campaign"]),
        ("캠페인 기간", F["period"]), ("총예산", F["budget"]),
        ("작성", f"{F['author']} · {F['team']}"), ("작성일 · 판", f"{F['date']} · [판 번호]"),
    ])
    _section(doc, "1. 과제", ["[이 광고로 해결할 문제 한 문장]", f"목표 KPI: {F['kpi']}"])
    _section(doc, "2. 배경", ["[시장·브랜드 상황 2~3줄, 숫자는 출처와 함께]"])
    _section(doc, "3. 타깃", [F["target"], "[타깃이 지금 가진 생각·행동]"])
    _section(doc, "4. 인사이트", ["[타깃의 숨은 긴장 한 문장]"])
    _section(doc, "5. 핵심 메시지", ["[타깃이 기억할 단 하나의 말]"])
    _section(doc, "6. 믿을 이유", ["[제품·서비스 근거 1]", "[제품·서비스 근거 2]"])
    _section(doc, "7. 톤앤매너", ["[말투·분위기·피할 것]"])
    _section(doc, "8. 꼭 들어갈 것", ["[로고·고지 문구·법적 표기·필수 장면]"])
    doc.add_heading("9. 산출물과 일정", level=1)
    _grid(doc, ["산출물", "규격·길이", "매체", "마감"],
          [[f"[산출물 {i}]", f"[산출물 {i} 규격·길이]", f"[산출물 {i} 매체]", f"[산출물 {i} 마감]"] for i in (1, 2)])
    doc.add_heading("10. 확인할 것", level=1)
    doc.add_paragraph("[자료가 없어 비워 둔 항목과 누구에게 확인할지]", style="List Bullet")
    doc.save(path)


def make_meeting(path):
    doc = Document()
    _doc_fonts(doc)
    doc.add_paragraph("광고주 회의록", style="Title")
    _meta_table(doc, [
        ("회의명", "[회의명]"), ("광고주 · 캠페인", f"{F['client']} · {F['campaign']}"),
        ("일시 · 장소", "[회의 날짜 시간] · [장소/화상]"),
        ("광고주 참석", "[광고주 참석자 이름(직함)]"), ("우리 참석", "[우리 참석자 이름(팀)]"),
        ("작성", f"{F['author']} · {F['date']}"),
    ])
    _section(doc, "1. 안건", ["[안건 1]", "[안건 2]"])
    _section(doc, "2. 논의 내용", ["[안건 1 논의 요지 — 누가 무엇을]", "[안건 2 논의 요지 — 누가 무엇을]"])
    doc.add_heading("3. 결정 사항", level=1)
    _grid(doc, ["번호", "결정 내용", "근거·조건"],
          [[str(i), f"[결정 {i}]", f"[결정 {i}의 근거·조건]"] for i in (1, 2)])
    doc.add_heading("4. 할 일", level=1)
    _grid(doc, ["할 일", "담당", "기한", "상태"],
          [[f"[할 일 {i}]", f"[할 일 {i} 담당]", f"[할 일 {i} 기한]", "예정"] for i in (1, 2)])
    _section(doc, "5. 남은 쟁점", ["[결정되지 않은 것과 다음에 누가 정할지]"])
    _section(doc, "6. 다음 회의", ["[다음 회의 날짜 · 안건]"])
    doc.add_paragraph("배포: [배포 받는 사람]")
    doc.save(path)


def make_pitch(path):
    doc = Document()
    _doc_fonts(doc)
    doc.add_paragraph("경쟁 PT 분석", style="Title")
    _meta_table(doc, [
        ("광고주", F["client"]), ("과제", "[RFP 과제 한 줄]"),
        ("PT 일정", "[RFP 접수 · 질의 마감 · PT 날짜]"),
        ("예산 규모", F["budget"]), ("작성", f"{F['author']} · {F['team']} · {F['date']}"),
    ])
    _section(doc, "1. RFP 요약", ["[광고주가 요구한 것 3~5줄, RFP 쪽수 표시]"])
    _section(doc, "2. 광고주의 진짜 과제", ["[RFP 문장 뒤에 있는 사업 문제 — 근거와 함께]"])
    doc.add_heading("3. 평가 기준", level=1)
    _grid(doc, ["기준", "비중", "우리가 보여 줄 것"],
          [[f"[평가 기준 {i}]", f"[평가 기준 {i} 비중]", f"[평가 기준 {i}에서 보여 줄 것]"] for i in (1, 2)])
    doc.add_heading("4. 경쟁 구도", level=1)
    _grid(doc, ["경쟁사", "예상 전략", "강점", "약점"],
          [[f"[경쟁사 {c}]", f"[경쟁사 {c} 예상 전략]", f"[경쟁사 {c} 강점]", f"[경쟁사 {c} 약점]"] for c in ("A", "B")])
    _section(doc, "5. 우리의 승부처", ["[이길 이유 한 문장]", "[그걸 증명할 자료·사례]"])
    _section(doc, "6. 위험과 대응", ["[위험 1] → [위험 1 대응]"])
    doc.add_heading("7. 준비 일정", level=1)
    _grid(doc, ["일", "할 일", "담당"],
          [[f"[준비 {i} 날짜]", f"[준비 {i} 할 일]", f"[준비 {i} 담당]"] for i in (1, 2)])
    doc.save(path)


# ---------------------------------------------------------------- Excel


def make_media_plan(path):
    wb = Workbook()
    ws = wb.active
    ws.title = "미디어 플랜"
    thin = Side(style="thin", color=LINE)
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    head_font = Font(name=FONT, bold=True, color="FFFFFF", size=10)
    body_font = Font(name=FONT, size=10)
    head_fill = PatternFill("solid", fgColor=ACCENT)
    calc_fill = PatternFill("solid", fgColor=FILL)

    ws["A1"] = f"{F['client']} {F['campaign']} 미디어 플랜"
    ws["A1"].font = Font(name=FONT, bold=True, size=14, color=INK)
    ws.row_dimensions[1].height = 26
    ws["A2"] = f"작성 {F['date']} · {F['team']} · 캠페인 기간 {F['period']} · 총예산 {F['budget']}"
    ws["A2"].font = Font(name=FONT, size=9, color=SUB)
    ws["A3"] = "숫자는 매체 견적·합의 자료 기준(출처는 '가정·출처' 시트)"
    ws["A3"].font = Font(name=FONT, size=9, color=SUB)

    header = ["매체", "상품·지면", "시작일", "종료일", "예산(원)", "예상 노출", "예상 클릭",
              "CPM(원)", "CPC(원)", "CTR", "예산 비중", "비고"]
    widths = [14, 22, 12, 12, 14, 14, 12, 11, 11, 9, 10, 24]
    hr = 4
    for c, (h, w) in enumerate(zip(header, widths), start=1):
        cell = ws.cell(row=hr, column=c, value=h)
        cell.font, cell.fill, cell.border = head_font, head_fill, border
        cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.column_dimensions[get_column_letter(c)].width = w

    first, last = hr + 1, hr + 10
    total = last + 1
    for r in range(first, last + 1):
        for c in range(1, len(header) + 1):
            cell = ws.cell(row=r, column=c)
            cell.font, cell.border = body_font, border
        ws.cell(row=r, column=3).number_format = "yyyy-mm-dd"
        ws.cell(row=r, column=4).number_format = "yyyy-mm-dd"
        for c in (5, 6, 7):
            ws.cell(row=r, column=c).number_format = "#,##0"
        ws.cell(row=r, column=8, value=f'=IF(OR(E{r}="",F{r}="",F{r}=0),"",E{r}/F{r}*1000)')
        ws.cell(row=r, column=9, value=f'=IF(OR(E{r}="",G{r}="",G{r}=0),"",E{r}/G{r})')
        ws.cell(row=r, column=10, value=f'=IF(OR(F{r}="",G{r}="",F{r}=0),"",G{r}/F{r})')
        ws.cell(row=r, column=11, value=f'=IF(OR(E{r}="",$E${total}=0),"",E{r}/$E${total})')
        for c in (8, 9, 10, 11):
            ws.cell(row=r, column=c).fill = calc_fill
        ws.cell(row=r, column=8).number_format = "#,##0"
        ws.cell(row=r, column=9).number_format = "#,##0"
        ws.cell(row=r, column=10).number_format = "0.00%"
        ws.cell(row=r, column=11).number_format = "0.0%"
    ws.cell(row=first, column=1, value="[매체]")
    ws.cell(row=first, column=2, value="[상품·지면]")

    ws.cell(row=total, column=1, value="합계")
    for c in (5, 6, 7):
        L = get_column_letter(c)
        ws.cell(row=total, column=c, value=f"=SUM({L}{first}:{L}{last})").number_format = "#,##0"
    ws.cell(row=total, column=8, value=f'=IF(F{total}=0,"",E{total}/F{total}*1000)').number_format = "#,##0"
    ws.cell(row=total, column=9, value=f'=IF(G{total}=0,"",E{total}/G{total})').number_format = "#,##0"
    ws.cell(row=total, column=10, value=f'=IF(F{total}=0,"",G{total}/F{total})').number_format = "0.00%"
    ws.cell(row=total, column=11, value=f'=IF(E{total}=0,"",1)').number_format = "0.0%"
    for c in range(1, len(header) + 1):
        cell = ws.cell(row=total, column=c)
        cell.font = Font(name=FONT, bold=True, size=10)
        cell.border = border
        cell.fill = calc_fill
    ws.freeze_panes = ws.cell(row=hr + 1, column=3)
    ws.cell(row=total + 2, column=1, value="회색 칸은 계산식. 예산·노출·클릭만 넣는다.").font = Font(name=FONT, size=9, color=SUB)

    src = wb.create_sheet("가정·출처")
    src["A1"] = "가정·출처"
    src["A1"].font = Font(name=FONT, bold=True, size=13)
    for c, (h, w) in enumerate(zip(["항목", "값·가정", "출처(자료명·날짜)"], [24, 30, 40]), start=1):
        cell = src.cell(row=3, column=c, value=h)
        cell.font, cell.fill, cell.border = head_font, head_fill, border
        src.column_dimensions[get_column_letter(c)].width = w
    for r in range(4, 10):
        for c in range(1, 4):
            src.cell(row=r, column=c).border = border
            src.cell(row=r, column=c).font = body_font
    src.cell(row=4, column=1, value="[예: 매체 견적]")
    wb.save(path)


TEMPLATES = {
    "cheil-proposal": ("캠페인 제안서.pptx", make_proposal),
    "cheil-monthly-report": ("월간 성과 보고서.pptx", make_monthly),
    "cheil-brief": ("크리에이티브 브리프.docx", make_brief),
    "cheil-meeting-notes": ("광고주 회의록.docx", make_meeting),
    "cheil-pitch-analysis": ("경쟁 PT 분석.docx", make_pitch),
    "cheil-media-plan": ("미디어 플랜.xlsx", make_media_plan),
}


# ---------------------------------------------------------------- 칸 이름 확인

SLOT_RE = re.compile(r"\[[^\[\]\n]{1,80}\]")
# 채운 문서에 남기는 표시(채울 칸이 아님). packages/ui/src/cheil-fill.ts 의 MARKER_RE 와 같다.
MARKER_RE = re.compile(r"^\[\s*(확인 필요|출처 확인 필요|목표 확인 필요)")
TEXT_RE = re.compile(r"<(w:t|a:t|t)(?:\s[^>]*)?>([^<]*)</\1>")


def _norm(placeholder):
    return re.sub(r"\s+", " ", placeholder).replace("[ ", "[").replace(" ]", "]")


def placeholders_of(path):
    """문서 안의 [칸] 을 나온 순서대로(같은 칸이면 여러 번)."""
    import html
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if re.match(
            r"(word/document\.xml|ppt/slides/slide\d+\.xml|xl/sharedStrings\.xml|xl/worksheets/sheet\d+\.xml)$", n)]
        # 장 순서대로
        names.sort(key=lambda n: [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", n)])
        found = []
        for n in names:
            xml = z.read(n).decode("utf-8")
            for m in TEXT_RE.finditer(xml):
                for s in SLOT_RE.findall(html.unescape(m.group(2))):
                    if s[1:-1].strip() and not MARKER_RE.match(s):
                        found.append(_norm(s))
        return found


def check_placeholders(path):
    """공통 칸은 사전 이름만, 나머지 칸은 문서 안에서 한 번씩. 어기면 이유 목록."""
    canonical = {_norm(f["placeholder"]) for f in FIELDS}
    aliases = {_norm(a): f["placeholder"] for f in FIELDS for a in f["aliases"]}
    found = placeholders_of(path)
    problems = []
    for s in sorted(set(found)):
        if s in aliases:
            problems.append(f"{s} 대신 공통 칸 {aliases[s]}")
    seen = {}
    for s in found:
        if s not in canonical:
            seen[s] = seen.get(s, 0) + 1
    problems += [f"{s} 가 {n}번 나옴(공통 칸이 아니면 한 번만)" for s, n in seen.items() if n > 1]
    common = [f["placeholder"] for f in FIELDS if _norm(f["placeholder"]) in set(found)]
    return problems, common, len(set(found))


def main():
    failed = False
    for skill, (name, fn) in TEMPLATES.items():
        out = SKILLS / skill / "assets"
        out.mkdir(parents=True, exist_ok=True)
        fn(out / name)
        problems, common, total = check_placeholders(out / name)
        print(f"{skill}/assets/{name}  {(out / name).stat().st_size:,} bytes, 칸 {total}개, 공통 칸 {' '.join(common)}")
        for p in problems:
            print(f"  ! {p}")
        failed = failed or bool(problems)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
