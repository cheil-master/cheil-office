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


def _page_title(slide, prs, text):
    """본문 장의 제목: 구획 이름 아래 왼쪽 정렬(현업 장표처럼 제목이 한 줄 메시지)."""
    t = _title(slide, text, 24)
    t.left, t.top = Emu(457200), Emu(560000)
    t.width, t.height = prs.slide_width - Emu(914400), Emu(800000)
    for p in t.text_frame.paragraphs:
        p.alignment = PP_ALIGN.LEFT
    return t


def _content(prs, kicker, title, lines):
    s = prs.slides.add_slide(prs.slide_layouts[1])
    _kicker(s, prs, kicker)
    _page_title(s, prs, title)
    body = s.placeholders[1]
    body.left, body.top = Emu(457200), Emu(1650000)
    body.width, body.height = prs.slide_width - Emu(914400), Emu(4500000)
    _bullets(body, lines)
    return s


def _table_slide(prs, kicker, title, header, rows, note=None, lead=None):
    s = prs.slides.add_slide(prs.slide_layouts[5])
    _kicker(s, prs, kicker)
    _page_title(s, prs, title)
    if lead:
        box = s.shapes.add_textbox(Emu(457200), Emu(1300000), prs.slide_width - Emu(914400), Emu(340000))
        box.text_frame.text = lead
        _style_runs(box.text_frame, 13, SUB)
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


def _two_col(prs, kicker, title, left, right, size=15):
    """왼쪽·오른쪽 두 묶음(작은 제목 + 줄들)."""
    s = prs.slides.add_slide(prs.slide_layouts[5])
    _kicker(s, prs, kicker)
    _page_title(s, prs, title)
    col_w = (prs.slide_width - Emu(914400) - Emu(300000)) // 2
    for i, (head, lines) in enumerate((left, right)):
        x = Emu(457200) + i * (col_w + Emu(300000))
        hb = s.shapes.add_textbox(x, Emu(1650000), col_w, Emu(400000))
        hb.text_frame.text = head
        _style_runs(hb.text_frame, 15, ACCENT, True)
        body = s.shapes.add_textbox(x, Emu(2100000), col_w, Emu(3900000))
        body.text_frame.word_wrap = True
        _bullets(body, lines, size)
    return s


def make_ot(path):
    """캠페인 OT(크리에이티브 브리프). 킥오프·제작 OT 자료의 흐름:
    지난 성과·현황 → 시장 → 과제·구조 → 타깃 → 메시지·RTB → 크리에이티브 가이드
    → 소재 운영 → 산출물·일정·예산 → 레퍼런스 → 확인할 것·Next."""
    prs = _new_deck()
    _cover(prs, f"{F['campaign']} 캠페인 OT", [f"{F['client']}  ·  {F['brand']}", f"{F['date']}  ·  {F['team']}"])
    _content(prs, "오늘 공유할 이야기", "오늘 공유할 이야기", [
        "01  지난 캠페인 성과와 현황", "02  시장·경쟁 상황", "03  이번 캠페인 과제", "04  타깃",
        "05  메시지와 RTB", "06  크리에이티브 가이드", "07  소재 운영 구조", "08  산출물·일정·예산",
        "09  레퍼런스와 아이디어 단초", "10  확인할 것과 Next",
    ])
    _content(prs, "01  지난 캠페인 성과와 현황", "[지난 캠페인을 한 문장으로: 무엇을 했고 무엇이 남았나]", [
        "지난 목표: [지난 캠페인 목표]",
        "진행 내용: [지난 캠페인에서 한 것 — 메시지·장치·매체]",
        "성과: [지난 캠페인 성과 — 숫자는 출처와 함께]",
        "남은 과제: [지난 캠페인에서 아쉬웠던 점]",
    ])
    _table_slide(prs, "01  지난 캠페인 성과와 현황", "지난 캠페인 리뷰 → 이번에 가져갈 것",
                 ["지난 캠페인에서", "이번 캠페인에서"],
                 [[f"[리뷰 {i}]", f"[리뷰 {i}을 이번에 활용·보완하는 법]"] for i in (1, 2, 3)])
    _content(prs, "02  시장·경쟁 상황", "[시장에서 보이는 결론 한 문장]", [
        "시장 변화: [시장 변화] (출처: [시장 변화의 자료명·날짜])",
        "경쟁사 동향: [경쟁사 동향] (출처: [경쟁사 동향의 자료명·날짜])",
        "우리 상황: [우리 브랜드·제품의 지금 위치]",
        "시사점: [그래서 이번 캠페인에 열려 있는 기회]",
    ])
    _two_col(prs, "03  이번 캠페인 과제", "[이번 캠페인 목표 한 문장]",
             ("과제", [
                 "사업 과제: [광고주가 풀려는 사업 문제]",
                 "커뮤니케이션 과제: [광고가 바꿔야 할 인식·행동]",
                 f"KPI: {F['kpi']}",
             ]),
             ("캠페인 구조", [
                 "[구조 요소 1] + [구조 요소 2] + [구조 요소 3]",
                 "구조 설명: [세 요소가 어떻게 하나의 캠페인이 되나]",
                 "광고주 예시 컨셉: [광고주가 OT에서 준 예시 컨셉 문장]",
             ]))
    _two_col(prs, "04  타깃", "[타깃의 숨은 긴장을 한 문장으로]",
             ("누구에게", [
                 f"핵심 타깃: {F['target']}",
                 "확장 타깃: [확장 타깃]",
                 "지금의 생각·행동: [자료로 확인된 타깃의 생각·행동]",
             ]),
             ("인사이트", [
                 "인사이트: [~하지만 ~하다 꼴의 한 문장]",
                 "근거: [인사이트의 근거 자료]",
             ]))
    _content(prs, "05  메시지와 RTB", "[핵심 메시지: 타깃이 기억할 한 문장]", [
        "핵심 메시지: [핵심 메시지 풀어쓰기 — 왜 이 말인가]",
        "톤앤매너: [말투·분위기·피할 것]",
        "필수 포함: [로고·고지 문구·법적 표기·필수 장면]",
    ])
    _table_slide(prs, "05  메시지와 RTB", "믿을 이유(RTB)",
                 ["RTB", "근거가 되는 사실", "소비자 언어로"],
                 [[f"[RTB {i}]", f"[RTB {i}의 근거 사실·출처]", f"[RTB {i}를 소비자 말로]"] for i in (1, 2, 3)],
                 note="제품·서비스 사실만. 자료에 없으면 [확인 필요]")
    _content(prs, "06  크리에이티브 가이드", "[크리에이티브가 꼭 지킬 원칙 한 문장]", [
        "1. [가이드 1 — 무엇을 / 왜]",
        "2. [가이드 2 — 무엇을 / 왜]",
        "3. [가이드 3 — 무엇을 / 왜]",
        "4. [가이드 4 — 무엇을 / 왜]",
        "피할 것: [광고주가 원하지 않는 표현·포맷]",
    ])
    _table_slide(prs, "07  소재 운영 구조", "[통합 소재와 개별 소재의 관계 한 문장]",
                 ["소재", "역할", "핵심 메시지", "초수·규격"],
                 [["통합 소재", "[통합 소재의 역할]", "[통합 소재 메시지]", "[통합 소재 초수·규격]"]]
                 + [[f"[개별 소재 {i}]", f"[개별 소재 {i}의 역할]", f"[개별 소재 {i} 메시지]", f"[개별 소재 {i} 초수·규격]"] for i in (1, 2, 3)])
    _table_slide(prs, "08  산출물·일정·예산", "산출물과 일정",
                 ["산출물", "규격·초수", "매체", "마감"],
                 [[f"[산출물 {i}]", f"[산출물 {i} 규격·초수]", f"[산출물 {i} 매체]", f"[산출물 {i} 마감]"] for i in (1, 2, 3)]
                 + [["주요 일정", "[아이디어 보고 날짜]", "[시사 날짜]", "[온에어 날짜]"]],
                 note="자료에 없는 금액·날짜는 비워 두고 [확인 필요]로 표시",
                 lead=f"캠페인 기간 {F['period']}  ·  예산 {F['budget']}")
    _two_col(prs, "09  레퍼런스와 아이디어 단초", "[참고할 방향 한 문장]",
             ("레퍼런스", [
                 "[레퍼런스 1] — [레퍼런스 1에서 가져올 점]",
                 "[레퍼런스 2] — [레퍼런스 2에서 가져올 점]",
             ]),
             ("아이디어 단초", [
                 "[아이디어 단초 1]",
                 "[아이디어 단초 2]",
             ]))
    _two_col(prs, "10  확인할 것과 Next", "확인할 것과 다음 단계",
             ("확인할 것", [
                 "[자료가 없어 비워 둔 항목과 누구에게 확인할지]",
             ]),
             ("Next", [
                 "[Next 1 — 할 일 · 담당 · 날짜]",
                 "[Next 2 — 할 일 · 담당 · 날짜]",
             ]))
    prs.save(path)


def make_result(path):
    """결과보고서. 캠페인 결과 리포트·매체 결과 리뷰의 흐름:
    요약 → 개요 → 미디어 운영 방향 → 정량(KPI·매체별·검색·확산) → 정성 → 소재별
    → 인사이트 → 다음 제안 → 출처."""
    prs = _new_deck()
    _cover(prs, f"{F['client']} {F['campaign']} 캠페인 결과 보고", [f"{F['date']}  ·  {F['team']}"])
    _content(prs, "Summary", "[캠페인 결과를 한 문장으로]", [
        "정량 성과: [가장 중요한 지표의 결과 — 목표 대비]",
        "정성 성과: [가장 눈에 띈 반응]",
        "잘된 이유: [성과를 만든 가장 큰 이유]",
        "다음 캠페인: [제안 요약]",
    ])
    _two_col(prs, "01  캠페인 개요", "캠페인 개요",
             ("캠페인", [
                 f"브랜드·제품: {F['brand']}",
                 "캠페인 목표: [캠페인 목표]",
                 f"KPI: {F['kpi']}",
                 "소재: [운영 소재 — 편 수·초수]",
             ]),
             ("매체 운영", [
                 f"타깃: {F['target']}",
                 f"기간: {F['period']}",
                 f"총예산: {F['budget']}",
                 "집행 매체: [집행 매체와 예산 비중]",
             ]))
    _table_slide(prs, "02  미디어 운영 방향", "[미디어 운영 방향 한 문장]",
                 ["방향", "무엇을", "주요 매체"],
                 [[f"[운영 방향 {i}]", f"[운영 방향 {i}의 내용]", f"[운영 방향 {i}의 매체]"] for i in (1, 2, 3)])
    _table_slide(prs, "03  주요 성과: 정량", "[KPI 결과 한 문장]",
                 ["지표", "목표", "결과", "달성률"],
                 [[f"[지표 {i}]", f"[지표 {i} 목표]", f"[지표 {i} 결과]", f"[지표 {i} 달성률]"] for i in (1, 2, 3, 4)],
                 note="달성률 = 결과 ÷ 목표. 숫자는 매체 리포트·실적표에 있는 것만")
    _table_slide(prs, "03  주요 성과: 정량", "매체별 집행 결과",
                 ["매체·상품", "집행비용(원)", "노출", "조회", "클릭", "CTR", "CPM(원)", "CPV(원)"],
                 [[f"[매체 {i}]", f"[매체 {i} 집행비용]", f"[매체 {i} 노출]", f"[매체 {i} 조회]", f"[매체 {i} 클릭]",
                   f"[매체 {i} CTR]", f"[매체 {i} CPM]", f"[매체 {i} CPV]"] for i in (1, 2, 3, 4)]
                 + [["합계", "[집행비용 합계]", "[노출 합계]", "[조회 합계]", "[클릭 합계]", "[전체 CTR]", "[전체 CPM]", "[전체 CPV]"]],
                 note="CTR = 클릭 ÷ 노출, CPM = 집행비용 ÷ 노출 × 1000, CPV = 집행비용 ÷ 조회")
    _table_slide(prs, "03  주요 성과: 정량", "[검색량·인게이지먼트 변화 한 문장]",
                 ["지표", "캠페인 전", "캠페인 중·후", "변화"],
                 [[f"[반응 지표 {i}]", f"[반응 지표 {i} 캠페인 전]", f"[반응 지표 {i} 캠페인 후]", f"[반응 지표 {i} 변화]"] for i in (1, 2, 3)],
                 note="검색량·버즈량·인게이지먼트·공유 등. 출처와 기간을 함께")
    _content(prs, "04  주요 성과: 정성", "[소비자·시장 반응 한 문장]", [
        "세일즈 연계: [판촉·구매와 연결된 결과]",
        "기사 반응: [기사 반응 — 매체명·날짜]",
        "소비자 반응: [댓글·후기에서 보인 반응 — 대표 문장]",
        "기타 성과: [수상·순위·자발적 확산 등]",
    ])
    _table_slide(prs, "05  소재별 결과", "[가장 반응이 좋았던 소재와 이유]",
                 ["소재", "핵심 메시지·장치", "주요 반응", "미디어 성과"],
                 [[f"[소재 {i}]", f"[소재 {i} 메시지·장치]", f"[소재 {i} 주요 반응]", f"[소재 {i} 미디어 성과]"] for i in (1, 2, 3)])
    _two_col(prs, "06  인사이트", "[이번 캠페인이 남긴 배움 한 문장]",
             ("잘된 점", [
                 "[잘된 점 1 — 사실과 근거 숫자]",
                 "[잘된 점 2 — 사실과 근거 숫자]",
             ]),
             ("아쉬운 점·외부 요인", [
                 "[아쉬운 점 — 사실과 근거 숫자]",
                 "[외부 요인 — 시즌·경쟁·이슈, 출처]",
             ]))
    _content(prs, "07  다음 캠페인 제안", "[다음 캠페인 방향 한 문장]", [
        "제안 1: [제안 1 — 무엇을 / 왜 / 기대 효과]",
        "제안 2: [제안 2 — 무엇을 / 왜 / 기대 효과]",
        "제안 3: [제안 3 — 무엇을 / 왜 / 기대 효과]",
    ])
    _content(prs, "부록", "데이터 출처", [
        "매체 실적: [매체 리포트·파일명, 추출일]",
        "검색·반응 데이터: [도구·기간]",
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


def _box(doc, label, text):
    """회색 칸 하나짜리 표(AE 의견·해석)."""
    t = doc.add_table(rows=1, cols=1)
    t.style = "Table Grid"
    cell = t.cell(0, 0)
    cell.text = ""
    p = cell.paragraphs[0]
    r = p.add_run(f"{label}) ")
    r.bold = True
    p.add_run(text)
    _shade(cell, FILL)
    doc.add_paragraph()
    return t


def _quote(doc, text):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.italic = True
    r.font.color.rgb = DocxRGB.from_string(SUB)
    return p


def make_contact(path):
    """컨택 리포트. 광고주 보고·시사·OT 뒤에 남기는 회의 기록:
    머리표(회의명·일시·장소·참석자) → 요약 → 상세 피드백(광고주 발언·AE 의견) → NEXT."""
    doc = Document()
    _doc_fonts(doc)
    doc.add_paragraph("CONTACT REPORT", style="Title")
    t = doc.add_table(rows=5, cols=4)
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    rows = [
        ("Project명 / 회의명", "[회의명]", None, None),
        ("광고주 · 캠페인", f"{F['client']} · {F['campaign']}", None, None),
        ("Date", "[회의 날짜 · 시간]", "Place", "[회의 장소]"),
        ("참석자 (광고주)", "[광고주 참석자 — 이름·직함]", None, None),
        ("참석자 (우리)", f"{F['team']} — [우리 참석자 — 이름·직함]", None, None),
    ]
    for i, (k1, v1, k2, v2) in enumerate(rows):
        cells = t.rows[i].cells
        if k2 is None:
            merged = cells[1].merge(cells[3])
            merged.text = v1
        else:
            cells[1].text = v1
            cells[2].text = k2
            cells[3].text = v2
            _shade(cells[2], FILL)
            cells[2].paragraphs[0].runs[0].bold = True
        cells[0].text = k1
        _shade(cells[0], FILL)
        cells[0].paragraphs[0].runs[0].bold = True
    doc.add_paragraph(f"작성: {F['author']} · {F['date']}")

    doc.add_heading("요약", level=1)
    for line in ("[핵심 피드백 1 — 광고주가 가장 강조한 것]", "[핵심 피드백 2]",
                 "[결정된 것 — 확정·선택된 안]", "[다시 해 올 것 — 수정·보강 요청]"):
        doc.add_paragraph(line, style="List Bullet")

    doc.add_heading("상세 피드백", level=1)
    for i in (1, 2, 3):
        doc.add_heading(f"{i}. [논의 주제 {i}]", level=2)
        _quote(doc, f"“[주제 {i}에 대한 광고주 발언 그대로]”")
        doc.add_paragraph(f"[주제 {i} 피드백 요지 — 무엇을 왜]", style="List Bullet")
        doc.add_paragraph(f"[주제 {i} 요청 사항 — 무엇을 어떻게 바꿀지]", style="List Bullet")
        if i == 1:
            _box(doc, "AE 의견", "[광고주 발언을 어떻게 해석했는지, 제작팀에 전할 뜻]")

    doc.add_heading("NEXT", level=1)
    _grid(doc, ["주체", "할 일", "기한"],
          [["우리", f"[우리 할 일 {i}]", f"[우리 할 일 {i} 기한]"] for i in (1, 2, 3)]
          + [["광고주", f"[광고주 할 일 {i}]", f"[광고주 할 일 {i} 기한]"] for i in (1, 2)])
    doc.add_paragraph()
    doc.add_paragraph("남은 쟁점: [결정되지 않은 것과 누가 언제 정할지]")
    end = doc.add_paragraph("- END -")
    end.alignment = WD_ALIGN_PARAGRAPH.CENTER
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
    """미디어 플랜. 미디어 브리프 양식의 흐름: 캠페인 개요 → 매체별 집행 계획
    (계산식) → 매체 구분별 예산 요약 → 소재 운영 → 매체별 운영 메모.
    빠른 채우기는 A1:L60 을 읽는다(packages/ui/src/cheil-sheet-fill.ts). 사람이 넣는
    열은 A~L 안에 두고, 계산식 열은 그 오른쪽에 두어도 된다."""
    wb = Workbook()
    ws = wb.active
    ws.title = "미디어 플랜"
    thin = Side(style="thin", color=LINE)
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    head_font = Font(name=FONT, bold=True, color="FFFFFF", size=10)
    body_font = Font(name=FONT, size=10)
    label_font = Font(name=FONT, bold=True, size=10, color=INK)
    sec_font = Font(name=FONT, bold=True, size=12, color=ACCENT)
    head_fill = PatternFill("solid", fgColor=ACCENT)
    label_fill = PatternFill("solid", fgColor=FILL)
    calc_fill = PatternFill("solid", fgColor="F4F5F7")
    wrap = Alignment(vertical="center", wrap_text=True)

    widths = [12, 16, 20, 18, 11, 11, 14, 13, 12, 11, 11, 11, 9, 9, 22]
    for c, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(c)].width = w

    ws["A1"] = f"{F['client']} {F['campaign']} 미디어 플랜"
    ws["A1"].font = Font(name=FONT, bold=True, size=14, color=INK)
    ws.row_dimensions[1].height = 26
    ws["A2"] = f"작성 {F['date']} · {F['team']} · 숫자는 매체 견적·합의 자료 기준(출처는 '가정·출처' 시트)"
    ws["A2"].font = Font(name=FONT, size=9, color=SUB)

    def section(row, text):
        ws.cell(row=row, column=1, value=text).font = sec_font

    def pair(row, label, value, col=1, span=6):
        k = ws.cell(row=row, column=col, value=label)
        k.font, k.fill, k.border, k.alignment = label_font, label_fill, border, wrap
        v = ws.cell(row=row, column=col + 1, value=value)
        v.font, v.border, v.alignment = body_font, border, wrap
        ws.merge_cells(start_row=row, start_column=col + 1, end_row=row, end_column=col + span)
        for c in range(col + 2, col + span + 1):
            ws.cell(row=row, column=c).border = border

    # 1. 캠페인 개요 (미디어 브리프의 '통합' 칸)
    section(4, "1. 캠페인 개요")
    pair(5, "브랜드·제품", F["brand"], 1, 4)
    pair(5, "캠페인명", F["campaign"], 7, 5)
    pair(6, "배경 및 목적", "[배경 및 목적 — 이번 미디어 집행으로 이루려는 것]", 1, 10)
    pair(7, "Comm. 타깃", F["target"], 1, 4)
    pair(7, "캠페인 기간", F["period"], 7, 5)
    pair(8, "캠페인 목표", "[캠페인 목표 — 도달·조회·유입·전환 중 무엇, 비중]", 1, 4)
    pair(8, "캠페인 예산", F["budget"], 7, 5)
    pair(9, "집행 매체", "[집행 매체 — 지상파·케이블·디지털·CTV·OOH·기타 중]", 1, 10)
    pair(10, "운영 소재", "[운영 소재 — 편 수·초수·형태(가로·세로·이미지)]", 1, 10)
    for r in range(5, 11):
        ws.row_dimensions[r].height = 30

    # 2. 매체별 집행 계획 (사람·AI 가 넣는 열: A~J, 계산식: K~N)
    section(12, "2. 매체별 집행 계획")
    header = ["구분", "매체", "상품·지면", "타깃팅", "시작일", "종료일", "예산(원)",
              "예상 노출", "예상 조회", "예상 클릭", "CPM(원)", "CPV(원)", "CTR", "예산 비중", "비고"]
    hr = 13
    for c, h in enumerate(header, start=1):
        cell = ws.cell(row=hr, column=c, value=h)
        cell.font, cell.fill, cell.border = head_font, head_fill, border
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    first, last = hr + 1, hr + 12
    total = last + 1
    for r in range(first, last + 1):
        for c in range(1, len(header) + 1):
            cell = ws.cell(row=r, column=c)
            cell.font, cell.border = body_font, border
        ws.cell(row=r, column=5).number_format = "yyyy-mm-dd"
        ws.cell(row=r, column=6).number_format = "yyyy-mm-dd"
        for c in (7, 8, 9, 10):
            ws.cell(row=r, column=c).number_format = "#,##0"
        ws.cell(row=r, column=11, value=f'=IF(OR(G{r}="",H{r}="",H{r}=0),"",G{r}/H{r}*1000)')
        ws.cell(row=r, column=12, value=f'=IF(OR(G{r}="",I{r}="",I{r}=0),"",G{r}/I{r})')
        ws.cell(row=r, column=13, value=f'=IF(OR(H{r}="",J{r}="",H{r}=0),"",J{r}/H{r})')
        ws.cell(row=r, column=14, value=f'=IF(OR(G{r}="",$G${total}=0),"",G{r}/$G${total})')
        for c in (11, 12, 13, 14):
            ws.cell(row=r, column=c).fill = calc_fill
        ws.cell(row=r, column=11).number_format = "#,##0"
        ws.cell(row=r, column=12).number_format = "#,##0"
        ws.cell(row=r, column=13).number_format = "0.00%"
        ws.cell(row=r, column=14).number_format = "0.0%"
    ws.cell(row=total, column=1, value="합계")
    for c in (7, 8, 9, 10):
        L = get_column_letter(c)
        ws.cell(row=total, column=c, value=f"=SUM({L}{first}:{L}{last})").number_format = "#,##0"
    ws.cell(row=total, column=11, value=f'=IF(H{total}=0,"",G{total}/H{total}*1000)').number_format = "#,##0"
    ws.cell(row=total, column=12, value=f'=IF(I{total}=0,"",G{total}/I{total})').number_format = "#,##0"
    ws.cell(row=total, column=13, value=f'=IF(H{total}=0,"",J{total}/H{total})').number_format = "0.00%"
    ws.cell(row=total, column=14, value=f'=IF(G{total}=0,"",1)').number_format = "0.0%"
    for c in range(1, len(header) + 1):
        cell = ws.cell(row=total, column=c)
        cell.font, cell.border, cell.fill = Font(name=FONT, bold=True, size=10), border, calc_fill
    ws.cell(row=total + 1, column=1,
            value="구분은 지상파·케이블·디지털·CTV·OOH·기타 중 하나로. 회색 칸은 계산식, 예산·노출·조회·클릭만 넣는다.").font = Font(name=FONT, size=9, color=SUB)

    # 3. 매체 구분별 예산 요약 (계산식만)
    section(29, "3. 매체 구분별 예산 요약")
    sr = 30
    for c, h in enumerate(["매체 구분", "예산(원)", "비중"], start=1):
        cell = ws.cell(row=sr, column=c, value=h)
        cell.font, cell.fill, cell.border = head_font, head_fill, border
        cell.alignment = Alignment(horizontal="center")
    kinds = ["지상파", "케이블", "디지털", "CTV", "OOH", "기타"]
    for i, k in enumerate(kinds, start=sr + 1):
        ws.cell(row=i, column=1, value=k)
        ws.cell(row=i, column=2, value=f'=SUMIF($A${first}:$A${last},A{i},$G${first}:$G${last})').number_format = "#,##0"
        ws.cell(row=i, column=3, value=f'=IF($G${total}=0,"",B{i}/$G${total})').number_format = "0.0%"
        for c in (1, 2, 3):
            ws.cell(row=i, column=c).font = body_font
            ws.cell(row=i, column=c).border = border
        for c in (2, 3):
            ws.cell(row=i, column=c).fill = calc_fill
    sum_row = sr + len(kinds) + 1
    ws.cell(row=sum_row, column=1, value="합계")
    ws.cell(row=sum_row, column=2, value=f"=SUM(B{sr + 1}:B{sum_row - 1})").number_format = "#,##0"
    ws.cell(row=sum_row, column=3,
            value=f'=IF(B{sum_row}=$G${total},"집행 계획 합계와 같음","구분을 확인하세요")')
    for c in (1, 2, 3):
        cell = ws.cell(row=sum_row, column=c)
        cell.font, cell.border, cell.fill = Font(name=FONT, bold=True, size=10), border, calc_fill

    # 4. 소재 운영
    section(40, "4. 소재 운영")
    mr = 41
    for c, h in enumerate(["소재", "유형", "초수·규격", "운영 비중", "소재 특성·키 메시지"], start=1):
        cell = ws.cell(row=mr, column=c, value=h)
        cell.font, cell.fill, cell.border = head_font, head_fill, border
        cell.alignment = Alignment(horizontal="center")
    for r in range(mr + 1, mr + 7):
        for c in range(1, 6):
            ws.cell(row=r, column=c).border = border
            ws.cell(row=r, column=c).font = body_font

    # 5. 매체별 운영 메모 (미디어 브리프의 매체별 요청 칸)
    section(49, "5. 매체별 운영 메모")
    pair(50, "TV", "[TV 운영 메모 — 지상파·케이블 비중, 선호 채널·프로그램]", 1, 10)
    pair(51, "디지털", "[디지털 운영 메모 — 필수 매체, 타깃팅 기준]", 1, 10)
    pair(52, "CTV·OOH", "[CTV·OOH 운영 메모 — 선호 매체·지역]", 1, 10)
    pair(53, "특이 사항", "[운영 특이 사항 — 제외 매체·광고주 요청]", 1, 10)
    for r in range(50, 54):
        ws.row_dimensions[r].height = 30
    ws.freeze_panes = "A4"

    src = wb.create_sheet("가정·출처")
    src["A1"] = "가정·출처"
    src["A1"].font = Font(name=FONT, bold=True, size=13)
    for c, (h, w) in enumerate(zip(["항목", "값·가정", "출처(자료명·날짜)"], [24, 30, 40]), start=1):
        cell = src.cell(row=3, column=c, value=h)
        cell.font, cell.fill, cell.border = head_font, head_fill, border
        src.column_dimensions[get_column_letter(c)].width = w
    for r in range(4, 12):
        for c in range(1, 4):
            src.cell(row=r, column=c).border = border
            src.cell(row=r, column=c).font = body_font
    wb.save(path)


# 캠페인 OT·결과보고서·미디어 플랜·컨택 리포트는 현업 문서(킥오프·제작 OT, 결과
# 리포트·매체 결과 리뷰, 미디어 브리프, 컨택 리포트)의 구성을 따랐다(2026-10-26).
# 스킬 이름(cheil-brief 등)은 그대로 두고 양식 파일만 바꾼다.
TEMPLATES = {
    "cheil-proposal": ("캠페인 제안서.pptx", make_proposal),
    "cheil-monthly-report": ("결과보고서.pptx", make_result),
    "cheil-brief": ("캠페인 OT.pptx", make_ot),
    "cheil-meeting-notes": ("컨택 리포트.docx", make_contact),
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
