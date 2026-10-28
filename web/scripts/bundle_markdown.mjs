import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const vendor = path.join(root, 'web/vendor');
const prefix = '// BEGIN NOWNOTE MARKDOWN RUNTIME', suffix = '// END NOWNOTE MARKDOWN RUNTIME';
const libraries = await Promise.all(['marked.umd.js','purify.min.js','document-renderer.js'].map(name => fs.readFile(path.join(vendor,name),'utf8')));
const licenses = await Promise.all(['marked.LICENSE','dompurify.LICENSE'].map(name => fs.readFile(path.join(vendor,name),'utf8')));
for (const relative of ['web/app.js','desktop/app/app.js']) {
  const file = path.join(root,relative); let source = await fs.readFile(file,'utf8');
  const original = source;
  if (source.startsWith(prefix)) source = source.slice(source.indexOf(suffix)+suffix.length).replace(/^\r?\n/,'');
  const runtime = `${prefix}\n/*\n${licenses.join('\n')}\n*/\n${libraries.join('\n;\n')}\n${suffix}\n`;
  if (process.argv.includes('--check')) {
    if (!original.startsWith(runtime)) throw new Error(`${relative}: Markdown 번들을 다시 생성해야 합니다.`);
  } else await fs.writeFile(file, runtime + source);
}
