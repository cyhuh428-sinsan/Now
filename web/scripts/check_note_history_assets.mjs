import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = new URL('../../', import.meta.url);
const require = createRequire(new URL('desktop/package.json', root));
const asar = require('@electron/asar');
const archive = fileURLToPath(new URL('desktop/dist/win-unpacked/resources/app.asar', root));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashes = {};
for (const path of ['app.js', 'styles.css']) {
  const web = await fs.readFile(new URL('web/' + path, root));
  const response = await fetch('http://127.0.0.1:8750/' + path, { cache: 'no-store' });
  assert.equal(response.status, 200);
  const served = Buffer.from(await response.arrayBuffer());
  assert.equal(sha(served), sha(web), 'served Web must match source: ' + path);
  hashes['web/' + path] = sha(web);
  const desktop = await fs.readFile(new URL('desktop/app/' + path, root));
  const packaged = asar.extractFile(archive, 'app/' + path);
  assert.equal(sha(packaged), sha(desktop), 'asar must match source: ' + path);
  hashes['desktop/app/' + path] = sha(desktop);
}
for (const path of ['main.cjs', 'preload.cjs']) {
  const source = await fs.readFile(new URL('desktop/' + path, root));
  assert.equal(sha(asar.extractFile(archive, path)), sha(source)); hashes['desktop/' + path] = sha(source);
}
const app = await fs.readFile(new URL('web/app.js', root), 'utf8');
for (const path of ['diff.js', 'note-history-state.js', 'note-history-ui.js', 'note-protection-protocol.js', 'note-protection-state.js', 'note-protection-client.js', 'note-protection-analysis.js', 'note-protection-ui.js']) {
  const source = await fs.readFile(new URL('web/vendor/' + path, root), 'utf8');
  assert.ok(app.includes(source.replace(/\r\n/g, '\n')), path + ' runtime must be bundled exactly');
  hashes['web/vendor/' + path] = sha(Buffer.from(source));
}
await fs.writeFile((process.env.NOWNOTE_HISTORY_QA_DIR || 'D:/tmp/now-240-stage-e3')+'/final-asset-hashes.json', JSON.stringify(hashes, null, 2));
console.log('served Web == source; Electron asar == source; journal/diff runtimes embedded byte-for-byte PASS');
console.log(JSON.stringify(hashes));
