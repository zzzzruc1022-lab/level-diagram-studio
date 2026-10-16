# GitHub 上传与网址发布

## 上传仓库文件

1. 在 GitHub 新建公开仓库，建议名称 `level-diagram-studio`。许可证不要选择 MIT 等模板，本项目已有 LICENSE 权利保留及使用许可。
2. 将发布准备文件夹里“仓库文件”中的全部内容放在仓库根目录，保留 `.github`、`.gitignore` 等隐藏项。可以用 GitHub Desktop 的 Add local repository → create repository → Publish repository 上传；也可以使用 Git 命令。不要上传 node_modules、.build、私有工程、缓存、录制日志或“发布附件”文件夹。
3. 首次上传后检查仓库根目录有 README.md、package.json、src/、dist/ 和 `.github/workflows/pages.yml`。

## 启用在线使用网址（推荐 GitHub Pages）

1. 打开该仓库的 Settings → Pages。
2. 在 Build and deployment 下把 Source 选成 **GitHub Actions**。
3. 打开 Actions → Check and deploy web → Run workflow，选择 main 分支运行。如果已推送 main，也会自动触发。
4. 等待 build 和 deploy 成功，回到 Settings → Pages，点击 Visit site。
5. 网址一般形如 `https://你的用户名.github.io/level-diagram-studio/`。以 GitHub 实际显示的网址为准，发布前这个示例地址不可用。
6. 把网址填到仓库右侧 About 的 Website，并放进 B 站视频简介。观众打开后即可使用工具，无需 GitHub 账号。

工作流只上传由 dist/index.html 组成的独立网站目录，不发布源码和检查日志到网站。网站没有后端或数据库，所有编辑在访问者自己的浏览器完成；自动暂存不会成为多人共享工程。若更换域名或路径，请让用户先下载工程 JSON。

首次发布或更新可能需等待一段时间。若未出现 deploy，检查 Source 是否选了 GitHub Actions、工作流是否启用、默认分支是否为 main。请先用桌面浏览器实际打开页面，创建组件并下载 JSON / PNG，再填写视频简介。

## 给别人下载 Windows 版

1. 在仓库 Releases → Draft a new release，新建标签 `v1.0.0`。
2. 将“发布附件”中的单文件 EXE、Windows ZIP、离线 HTML、源码 ZIP 和 SHA256SUMS.txt 拖入附件区。
3. 填写版本说明并发布。EXE 和 Windows ZIP 不要提交到代码仓库，它们可能超过 GitHub 单文件限制。
4. 普通用户优先下载便携 EXE；ZIP 完整解压后也可运行目录版 EXE，不要从目录版单独拿走 EXE。

程序未做付费代码签名，Windows 可能显示发布者未知。下载校验值在 SHA256SUMS.txt；确认来源及校验后按自己的系统策略决定是否运行。

## 后续更新

在 src/ 修改，运行 npm run build、npm test，必要时更新帮助内容并运行 Python 教程构建脚本。提交 main 后 Pages 自动构建发布。Windows 版需要重新运行 npm run package:portable 并更新 Releases 附件。不要用旧版 ZIP 覆盖新版网页。

## 其他静态托管

也可将构建后的 dist/index.html 作为网站根目录的 index.html，上传至支持 HTTPS 的静态网站托管服务。无需购买数据库或配置 Node 后端。具体服务的访问速度、额度和地区可用性应在发布时实际验证；本交付尚未创建任何公网网站。

官方参考：
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
