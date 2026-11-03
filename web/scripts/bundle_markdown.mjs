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
const coreFiles = ['web/wiki-core.js','desktop/app/wiki-core.js'];
const mainLibraries = ['marked.umd.js','purify.min.js','note-blocks.js','document-renderer.js','library-state.js','library-ui.js','diff.js','browser-history-storage.js','note-history-state.js','note-history-ui.js','note-protection-protocol.js','note-protection-state.js','note-protection-client.js','note-protection-analysis.js','note-protection-ui.js','wiki-state.js','wiki-ingest.js','wiki-sources.js','wiki-lifecycle.js','wiki-notebook.js','wiki-server-access.js','wiki-evidence.js','wiki-protection-group.js','wiki-ingest-notebook.js','wiki-graph.js','wiki-query.js','wiki-query-notebook.js','wiki-lint.js','wiki-runtime-loader.js'];
const wikiLibraries = ['cytoscape.min.js','wiki-graph-ui.js','wiki-ui.js'];
mainLibraries.unshift('document-parts.js','document-idb.js','history-snapshot.js','journal-writes.js','journal-window.js','deferred-history.js','history-backup.js');
mainLibraries.push('wiki-index-reader.js');
mainLibraries.push('wiki-read-set.js','wiki-selected-page.js','history-client.js','wiki-workspace.js','web-session-storage.js');
mainLibraries.push('history-persistence.js');
mainLibraries.push('wiki-connection.js');
mainLibraries.push('workspace-navigation.js');
mainLibraries.push('crypto-worker-client.js');

export async function buildRuntimeBundles() {
  const read = async names => Promise.all(names.map(async name => normalize(await fs.readFile(path.join(vendor,name),'utf8'))));
  const libraries = await read(mainLibraries);
  const licenses = await read(['marked.LICENSE','dompurify.LICENSE','diff.LICENSE']);
  const wikiLibrariesSource = await read(wikiLibraries);
  const wikiLicenses = await read(['cytoscape.LICENSE']);
  const assets={};
  for(const name of ['wiki.html','wiki-shell.js','wiki.css'])assets['desktop/app/'+name]=normalize(await fs.readFile(path.join(root,'web',name),'utf8'));
  assets['desktop/app/workspace-navigation.js']=(await read(['workspace-navigation.js']))[0];
  const worker=libraries[mainLibraries.indexOf('note-protection-protocol.js')]+'\n;\n'+(await read(['crypto-worker-host.js']))[0];
  assets['web/crypto-worker.js']=worker;assets['desktop/app/crypto-worker.js']=worker;
  const core=`${prefix}\n/*\n${licenses.join('\n')}\n*/\n${libraries.join('\n;\n')}\n${suffix}\n`;
  return {
    main: core,core,assets,
    wiki: `// BEGIN NOWNOTE WIKI RUNTIME\n/*\n${wikiLicenses.join('\n')}\n*/\n${wikiLibrariesSource.join('\n;\n')}\n// END NOWNOTE WIKI RUNTIME\n`,
  };
}

export async function checkRuntimeBundles(bundles, read = relative => fs.readFile(path.join(root,relative),'utf8')) {
  for (const relative of [...mainFiles,...wikiFiles,...coreFiles,...Object.keys(bundles.assets)]) {
    let source;
    try { source = normalize(await read(relative)); }
    catch { throw new Error(`${relative}: runtime 파일을 읽을 수 없습니다.`); }
    const valid = mainFiles.includes(relative) ? source.startsWith(bundles.main) : source === (bundles.assets[relative]??(coreFiles.includes(relative)?bundles.core:bundles.wiki));
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
  for (const relative of coreFiles) await fs.writeFile(path.join(root,relative), bundles.core);
  await fs.copyFile(path.join(vendor,'document-parts.js'),path.join(root,'desktop/app/document-parts.js'));
  await fs.copyFile(path.join(vendor,'journal-writes.js'),path.join(root,'desktop/app/journal-writes.js'));
  await fs.copyFile(path.join(vendor,'journal-window.js'),path.join(root,'desktop/app/journal-window.js'));
  for(const [relative,source]of Object.entries(bundles.assets))await fs.writeFile(path.join(root,relative),source);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await run();
