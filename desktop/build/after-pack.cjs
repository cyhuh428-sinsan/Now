const fs=require('node:fs/promises');
const path=require('node:path');
module.exports=async function afterPack(context){
  if(context.electronPlatformName!=='win32')return;
  const source=path.join(context.appOutDir,'NowNote.exe');
  await fs.copyFile(source,path.join(context.appOutDir,'NowNoteWiki.exe'));
};
