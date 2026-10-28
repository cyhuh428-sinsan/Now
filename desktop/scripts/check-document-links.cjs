const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { resolveDocumentPath, isRelativeDocumentReference } = require('../document-links.cjs');

test('로컬 일반 문서만 허용하고 실행·네트워크·상대·ADS 경로를 거부한다', async () => {
  const dir = await fs.mkdtemp('D:/tmp/now-240-stage-b/links-');
  try {
    const file = dir + '/sample.txt'; await fs.writeFile(file,'synthetic');
    assert.equal(await resolveDocumentPath(file), await fs.realpath(file));
    assert.equal(await resolveDocumentPath(pathToFileURL(file).href), await fs.realpath(file));
    const spaced = dir + '/한글 hello world.md'; await fs.writeFile(spaced,'synthetic');
    const encoded = dir + '/' + encodeURIComponent('한글 hello world.md');
    assert.equal(await resolveDocumentPath(encoded), await fs.realpath(spaced));
    assert.equal(await resolveDocumentPath(pathToFileURL(spaced).href), await fs.realpath(spaced));
    const literal = dir + '/hello%20world.md'; await fs.writeFile(literal,'literal percent');
    assert.equal(await resolveDocumentPath(literal), await fs.realpath(literal));
    assert.equal(await resolveDocumentPath(pathToFileURL(literal).href), await fs.realpath(literal));
    const percent = dir + '/100%.md'; await fs.writeFile(percent,'literal percent');
    assert.equal(await resolveDocumentPath(percent), await fs.realpath(percent));
    for (const input of [dir+'/missing%ZZ.md', dir+'/missing%3Astream.md', pathToFileURL(dir).href+'/bad%ZZ.md']) await assert.rejects(resolveDocumentPath(input));
    assert.equal(isRelativeDocumentReference('../report.md'),true);
    for (const input of ['../run.cmd','//server/share/a.txt','https://example.com/a.txt','file:///D:/a.txt']) assert.equal(isRelativeDocumentReference(input),false);
    for (const input of [dir+'/evil.exe', dir+'/evil.cmd', dir+'/evil.ps1', dir+'/evil.lnk', '//server/share/a.txt', 'relative.md', 'https://example.com', file+':stream', file+'\0', dir]) {
      await assert.rejects(resolveDocumentPath(input));
    }
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
