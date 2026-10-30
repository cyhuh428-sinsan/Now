import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const vendor = path.join(root, 'web/vendor');
const prefix = '// BEGIN NOWNOTE MARKDOWN RUNTIME', suffix = '// END NOWNOTE MARKDOWN RUNTIME';
// Git의 CRLF checkout 여부와 관계없이 빌드 소스만 LF로 비교·생성한다.
const normalize = source => source.replace(/\r\n/g, '\n');
const libraries = await Promise.all(['marked.umd.js','purify.min.js','document-renderer.js','library-state.js','library-ui.js','diff.js','note-history-state.js','note-history-ui.js','note-protection-protocol.js','note-protection-state.js','note-protection-client.js','note-protection-ui.js'].map(async name => normalize(await fs.readFile(path.join(vendor,name),'utf8'))));
const licenses = await Promise.all(['marked.LICENSE','dompurify.LICENSE','diff.LICENSE'].map(async name => normalize(await fs.readFile(path.join(vendor,name),'utf8'))));
for (const relative of ['web/app.js','desktop/app/app.js']) {
  const file = path.join(root,relative); let source = await fs.readFile(file,'utf8');
  source = normalize(source);
  const original = source;
  if (source.startsWith(prefix)) {
    if (!source.includes(suffix)) throw new Error(`${relative}: Markdown 번들 끝 표시가 없습니다.`);
    source = source.slice(source.indexOf(suffix)+suffix.length).replace(/^\n/,'');
  }
  const runtime = `${prefix}\n/*\n${licenses.join('\n')}\n*/\n${libraries.join('\n;\n')}\n${suffix}\n`;
  if (process.argv.includes('--check')) {
    if (!original.startsWith(runtime)) throw new Error(`${relative}: Markdown 번들을 다시 생성해야 합니다.`);
  } else await fs.writeFile(file, runtime + source);
}
