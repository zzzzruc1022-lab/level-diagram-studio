# 第三方组件与许可

应用网页没有第三方运行时脚本或外部字体；使用系统字体。早期参考项目仅作为交互思路参考，未复制源码或附带其库。

Windows包包括Electron 44.7.2（MIT），其中包含Chromium、Node.js等依赖。官方运行时附带的LICENSE及LICENSES.chromium.html完整随包保留；请与EXE一同分发。官方来源：https://github.com/electron/electron/releases/tag/v44.7.2 。本次官方win32-x64.zip SHA256：10a89447ef64ac5cb9f782af48ffd83734a40ae91681259d1048ca3c9e6c5da4。

仅构建／测试依赖：@electron/packager 20.1.1（BSD-2-Clause）、Terser 5.46.1（BSD-2-Clause）、jsdom 30.1.2（MIT）；Electron与这些工具的精确依赖树见package-lock.json，安装后各包附带其许可。npm11.12.1（Artistic-2.0）仅在本机作为构建工具使用，不加入用户运行包。Playwright CLI沿用本机已有工具，用于交互验收。

关卡简图工坊自身源码的开源许可证由作者决定；本文件不代表已经选择或授予某一开源许可证。程序未添加自动更新、遥测、远程账号或联网素材。

## 最终便携版封装补充

单文件便携 EXE 由 electron-builder 26.15.3（MIT）和 NSIS 启动器封装，运行时内含完整 Electron 授权文件。NSIS 原始声明见 third_party/NSIS-COPYING.txt，包含其压缩模块的分别授权。封装用到未修改的 StdUtils（LoRd_MuldeR，LGPL-2.1-or-later）；声明、可替换插件的NSIS接口及LGPL文本分别见 third_party/StdUtils.nsh 和 third_party/LGPL-2.1.txt。相关上游源码：https://github.com/lordmulder/stdutils ，https://github.com/electron-userland/electron-builder-binaries ，https://sourceforge.net/projects/nsis/files/ 。工具的封装入口在 tools/package-portable.mjs；依赖版本由 package-lock.json 固定。第三方组件的原有权利不受本项目 LICENSE 限制。

新增构建依赖 electron-builder 及其下载、压缩工具仅用于制作发行版，未添加到网页版。Playwright Core 1.62.1（Apache-2.0）仅用于测试。打包依赖树扫描见最终检查记录；应用没有新增在线运行依赖。
