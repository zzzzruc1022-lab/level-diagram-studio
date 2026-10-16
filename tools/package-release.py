"""Create complete, verified source/Windows downloads; no network publishing."""
from pathlib import Path
import hashlib,json,os,shutil,zipfile
from release_files import ROOT as root,DOCS,source_files
out=Path(os.environ.get('STUDIO_RELEASE_DIR',str(root/'release'))).resolve();out.mkdir(parents=True,exist_ok=True)
built=root/'.build/desktop/关卡简图工坊-win32-x64'
portable=root/'.build/portable/LevelDiagramStudio-1.0.0-Windows-x64.exe'
assert (built/'关卡简图工坊.exe').is_file() and portable.is_file(),'Run npm run package:portable first'
assert json.loads((root/'data/initial-project.json').read_text(encoding='utf-8-sig'))['documents']==[]
html=(root/'dist/index.html').read_bytes()
assert b'<script src=' not in html and b'HELP_BUILD_GIF' not in html
source=out/'LevelDiagramStudio-1.0.0-Source.zip';files=source_files()
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in files:z.write(p,p.relative_to(root))
with zipfile.ZipFile(source) as z:
 assert z.testzip() is None
 for p in files:assert z.read(p.relative_to(root).as_posix())==p.read_bytes()
archive=out/'LevelDiagramStudio-1.0.0-Windows-x64.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(built.rglob('*')):
  if p.is_file():z.write(p,Path('关卡简图工坊')/p.relative_to(built))
 z.write(root/'LICENSE','关卡简图工坊/应用使用许可.txt')
 z.write(root/'THIRD_PARTY_NOTICES.md','关卡简图工坊/第三方许可说明.md')
 z.write(root/'data/qa-project.json','关卡简图工坊/空间与曲线示例.json')
 z.write(root/'data/two-storey-house.json','关卡简图工坊/两层小楼示例.json')
 z.writestr('关卡简图工坊/网页版/关卡简图工坊_v1.0.html',html)
 z.writestr('关卡简图工坊/开始使用.txt','完整解压后双击关卡简图工坊.exe，目录版不可单独拷走EXE。\n程序顶部使用说明或F1打开完整离线教程。\n下载工程JSON用于长期备份。工具快捷键使用英文输入法。\n')
with zipfile.ZipFile(archive) as z:
 assert len(z.namelist())==len(set(z.namelist())), 'Duplicate archive entries'
 assert z.testzip() is None
 assert z.read('关卡简图工坊/LICENSE')==(built/'LICENSE').read_bytes()
shutil.copyfile(portable,out/portable.name)
(out/'关卡简图工坊_v1.0.html').write_bytes(html)
shutil.copyfile(root/'docs/使用说明.html',out/'使用说明.html')
shutil.copyfile(root/'data/two-storey-house.json',out/'两层小楼示例.json')
shutil.copyfile(root/'data/qa-project.json',out/'空间与曲线示例.json')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
artifacts=[p for p in out.iterdir() if p.is_file() and p.name!='SHA256SUMS.txt']
(out/'SHA256SUMS.txt').write_text(''.join(sha(p)+'  '+p.name+'\n' for p in sorted(artifacts)),encoding='utf-8')
print(json.dumps({'sourceFiles':len(files),'downloads':{p.name:p.stat().st_size for p in artifacts}},ensure_ascii=False))
