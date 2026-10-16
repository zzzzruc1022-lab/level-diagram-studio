// Bundle the tested directory application into one offline, no-install EXE.
import {build,Platform,Arch} from 'electron-builder';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
await build({projectDir:root,prepackaged:path.join(root,'.build/desktop/关卡简图工坊-win32-x64'),
 targets:Platform.WINDOWS.createTarget('portable',Arch.x64),config:{
  appId:'studio.leveldiagram.editor',productName:'关卡简图工坊',
  directories:{output:'.build/portable'},artifactName:'LevelDiagramStudio-${version}-Windows-x64.exe',
  win:{icon:'desktop/icon.ico',signAndEditExecutable:false},
  portable:{requestExecutionLevel:'user'},compression:'normal',
  publish:null
 }});
