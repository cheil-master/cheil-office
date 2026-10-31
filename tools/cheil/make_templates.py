"""Cheil fork: rebuild exactly four current templates, never the retired six."""
from pathlib import Path
from template_print import fix_media_print
import os, subprocess, sys, tempfile, shutil
root=Path(__file__).resolve().parents[2]
if not os.environ.get('RUNTIME_NODE_MODULES'):
    raise SystemExit('Set RUNTIME_NODE_MODULES and optionally RUNTIME_NODE to the bundled artifact runtime.')
node=os.environ.get('RUNTIME_NODE','node')
with tempfile.TemporaryDirectory(prefix='cheil-templates-') as tmp:
    env={**os.environ,'CHEIL_TEMPLATE_OUTPUT':tmp}
    for mode in ['slides','sheets']:
        subprocess.run([node,str(Path(__file__).with_suffix('.mjs')),mode],env=env,check=True)
    subprocess.run([sys.executable,str(Path(__file__).with_name('make_contact_template.py'))],env=env,check=True)
    for skill,name in [('cheil-brief','OT 및 킥오프.pptx'),('cheil-meeting-notes','컨택리포트.docx'),('cheil-media-plan','미디어브리프.xlsx'),('cheil-monthly-report','결과보고서.pptx')]:
        target=root/'apps/shell/resources/builtin-skills'/skill/'assets'/name
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(Path(tmp)/name,target)
        if target.suffix == '.xlsx':
            fix_media_print(target)
        print(target.name)
