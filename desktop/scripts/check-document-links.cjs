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
    assert.equal(isRelativeDocumentReference('../report.md'),true);
    for (const input of ['../run.cmd','//server/share/a.txt','https://example.com/a.txt','file:///D:/a.txt']) assert.equal(isRelativeDocumentReference(input),false);
    for (const input of [dir+'/evil.exe', dir+'/evil.cmd', dir+'/evil.ps1', dir+'/evil.lnk', '//server/share/a.txt', 'relative.md', 'https://example.com', file+':stream', file+'\0', dir]) {
      await assert.rejects(resolveDocumentPath(input));
    }
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
