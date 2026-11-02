import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const vendor = path.join(root, 'web/vendor');
const prefix = '// BEGIN NOWNOTE MARKDOWN RUNTIME', suffix = '// END NOWNOTE MARKDOWN RUNTIME';
// Git의 CRLF checkout 여부와 관계없이 빌드 소스만 LF로 비교·생성한다.
const normalize = source => source.replace(/\r\n/g, '\n');
const mainFiles = ['web/app.js','desktop/app/app.js'];
const wikiFiles = ['web/wiki-runtime.js','desktop/app/wiki-runtime.js'];
const mainLibraries = ['marked.umd.js','purify.min.js','note-blocks.js','document-renderer.js','library-state.js','library-ui.js','diff.js','browser-history-storage.js','note-history-state.js','note-history-ui.js','note-protection-protocol.js','note-protection-state.js','note-protection-client.js','note-protection-analysis.js','note-protection-ui.js','wiki-state.js','wiki-ingest.js','wiki-sources.js','wiki-lifecycle.js','wiki-notebook.js','wiki-server-access.js','wiki-evidence.js','wiki-protection-group.js','wiki-ingest-notebook.js','wiki-graph.js','wiki-query.js','wiki-query-notebook.js','wiki-lint.js','wiki-runtime-loader.js'];
const wikiLibraries = ['cytoscape.min.js','wiki-graph-ui.js','wiki-ui.js'];
mainLibraries.unshift('document-parts.js','document-idb.js');

export async function buildRuntimeBundles() {
  const read = async names => Promise.all(names.map(async name => normalize(await fs.readFile(path.join(vendor,name),'utf8'))));
  const libraries = await read(mainLibraries);
  const licenses = await read(['marked.LICENSE','dompurify.LICENSE','diff.LICENSE']);
  const wikiLibrariesSource = await read(wikiLibraries);
  const wikiLicenses = await read(['cytoscape.LICENSE']);
  return {
    main: `${prefix}\n/*\n${licenses.join('\n')}\n*/\n${libraries.join('\n;\n')}\n${suffix}\n`,
    wiki: `// BEGIN NOWNOTE WIKI RUNTIME\n/*\n${wikiLicenses.join('\n')}\n*/\n${wikiLibrariesSource.join('\n;\n')}\n// END NOWNOTE WIKI RUNTIME\n`,
  };
}

export async function checkRuntimeBundles(bundles, read = relative => fs.readFile(path.join(root,relative),'utf8')) {
  for (const relative of [...mainFiles,...wikiFiles]) {
    let source;
    try { source = normalize(await read(relative)); }
    catch { throw new Error(`${relative}: runtime 파일을 읽을 수 없습니다.`); }
    const valid = mainFiles.includes(relative) ? source.startsWith(bundles.main) : source === bundles.wiki;
    if (!valid) throw new Error(`${relative}: runtime 번들을 다시 생성해야 합니다.`);
  }
}

async function run() {
  const bundles = await buildRuntimeBundles();
  if (process.argv.includes('--check')) return checkRuntimeBundles(bundles);
  for (const relative of mainFiles) {
    const file = path.join(root,relative); let source = await fs.readFile(file,'utf8');
    source = normalize(source);
    if (source.startsWith(prefix)) {
      if (!source.includes(suffix)) throw new Error(`${relative}: Markdown 번들 끝 표시가 없습니다.`);
      source = source.slice(source.indexOf(suffix)+suffix.length).replace(/^\n/,'');
    }
    await fs.writeFile(file, bundles.main + source);
  }
  for (const relative of wikiFiles) await fs.writeFile(path.join(root,relative), bundles.wiki);
  await fs.copyFile(path.join(vendor,'document-parts.js'),path.join(root,'desktop/app/document-parts.js'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await run();
