"""Cheil fork: preserve cells and set the media brief's native print metadata.

The bundled artifact authoring API has no worksheet.pageLayout surface. This
post-export step changes only OOXML print elements and the Print_Area name.
"""
from pathlib import Path
from zipfile import ZipFile
import re
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape


def fix_media_print(path: Path) -> None:
    with ZipFile(path) as book:
        entries = [(entry, book.read(entry.filename)) for entry in book.infolist()]
    original = dict((entry.filename, data) for entry, data in entries)
    sheet = original['xl/worksheets/sheet1.xml'].decode('utf-8')
    workbook = original['xl/workbook.xml'].decode('utf-8')
    prefix = re.search(r'<([\w]+:)?worksheet\b', sheet).group(1) or ''
    wp = re.search(r'<([\w]+:)?workbook\b', workbook).group(1) or ''
    setup_pr = f'<{prefix}pageSetUpPr fitToPage="1"/>'
    if re.search(fr'<{prefix}pageSetUpPr\b[^>]*/>', sheet):
        sheet = re.sub(fr'<{prefix}pageSetUpPr\b[^>]*/>', setup_pr, sheet)
    elif f'</{prefix}sheetPr>' in sheet:
        sheet = sheet.replace(f'</{prefix}sheetPr>', setup_pr + f'</{prefix}sheetPr>', 1)
    elif re.search(fr'<{prefix}sheetPr\b[^>]*/>', sheet):
        sheet = re.sub(fr'<{prefix}sheetPr\b[^>]*/>', f'<{prefix}sheetPr>{setup_pr}</{prefix}sheetPr>', sheet, count=1)
    else:
        sheet = re.sub(fr'(<{prefix}worksheet\b[^>]*>)', fr'\1<{prefix}sheetPr>{setup_pr}</{prefix}sheetPr>', sheet, count=1)
    margins = f'<{prefix}pageMargins left="0.3" right="0.3" top="0.35" bottom="0.35" header="0.15" footer="0.15"/>'
    sheet = re.sub(fr'<{prefix}pageMargins\b[^>]*/>', margins, sheet, count=1)
    page_setup = f'<{prefix}pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>'
    if re.search(fr'<{prefix}pageSetup\b[^>]*/>', sheet):
        sheet = re.sub(fr'<{prefix}pageSetup\b[^>]*/>', page_setup, sheet, count=1)
    else:
        sheet = sheet.replace(margins, margins + page_setup, 1)
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    name = ET.fromstring(original['xl/workbook.xml']).find('s:sheets/s:sheet', ns).attrib['name']
    formula = escape("'" + name.replace("'", "''") + "'!$A$1:$H$48")
    defined = f'<{wp}definedName name="_xlnm.Print_Area" localSheetId="0">{formula}</{wp}definedName>'
    pattern = fr'<{wp}definedName\b[^>]*name="_xlnm.Print_Area"[^>]*>.*?</{wp}definedName>'
    if re.search(pattern, workbook):
        workbook = re.sub(pattern, defined, workbook, count=1)
    elif f'</{wp}definedNames>' in workbook:
        workbook = workbook.replace(f'</{wp}definedNames>', defined + f'</{wp}definedNames>', 1)
    else:
        workbook = workbook.replace(f'</{wp}workbook>', f'<{wp}definedNames>{defined}</{wp}definedNames></{wp}workbook>', 1)
    before_cells = re.search(fr'<{prefix}sheetData\b.*?</{prefix}sheetData>', original['xl/worksheets/sheet1.xml'].decode('utf-8')).group()
    after_cells = re.search(fr'<{prefix}sheetData\b.*?</{prefix}sheetData>', sheet).group()
    assert before_cells == after_cells, 'Cell data must remain byte-for-byte identical'
    ET.fromstring(sheet)
    ET.fromstring(workbook)
    changed = {'xl/worksheets/sheet1.xml': sheet.encode('utf-8'), 'xl/workbook.xml': workbook.encode('utf-8')}
    temp = path.with_suffix('.printing.tmp')
    with ZipFile(temp, 'w') as book:
        for entry, data in entries:
            book.writestr(entry, changed.get(entry.filename, data))
    temp.replace(path)
    with ZipFile(path) as book:
        for entry, data in entries:
            if entry.filename not in changed:
                assert book.read(entry.filename) == data


if __name__ == '__main__':
    import sys
    fix_media_print(Path(sys.argv[1]))
