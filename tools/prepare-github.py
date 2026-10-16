"""Prepare a fresh upload folder containing only public repository files."""
from pathlib import Path
import hashlib,json,shutil,sys
from release_files import ROOT as root,source_files
out=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'release-upload'
repo=out/'仓库文件'
if repo.exists():raise FileExistsError('Use a new upload folder; existing repositories are never overwritten: '+str(repo))
repo.mkdir(parents=True)
files=source_files()
for p in files:
 target=repo/p.relative_to(root);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
shutil.copyfile(root/'docs/GitHub发布指南.md',out/'上传与网址发布.md')
(out/'先看这里.txt').write_text('仓库文件：将里面的全部内容上传至GitHub仓库根目录，保留隐藏文件。\n发布附件：上传到GitHub Releases，不要提交大EXE和ZIP到代码仓库。\n本文件夹未创建仓库或上线网址。具体步骤见上传与网址发布.md。\n源码保留全部权利，允许下载运行及使用导出图稿，详见仓库文件/LICENSE。\n',encoding='utf-8-sig')
manifest={p.relative_to(repo).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(repo.rglob('*')) if p.is_file()}
(out/'仓库文件校验.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
assert set(manifest)=={p.relative_to(root).as_posix() for p in files}
print(json.dumps({'repository':str(repo),'files':len(files)},ensure_ascii=False))
