const fs = require('node:fs/promises');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const allowed = new Set(['.txt','.md','.pdf','.png','.jpg','.jpeg','.gif','.webp','.csv','.docx','.xlsx','.pptx']);

function assertDocumentPath(target) {
  if (/[\x00-\x1f]/.test(target) || !path.isAbsolute(target) || /^[/\\]{2}/.test(target) || target.includes(':', 2)) throw new Error('로컬 파일의 절대 경로가 필요합니다.');
  if (!allowed.has(path.extname(target).toLowerCase())) throw new Error('이 파일 형식은 열 수 없습니다.');
}

async function resolveDocumentPath(input) {
  if (typeof input !== 'string' || input.length > 4096 || /[\x00-\x1f]/.test(input)) throw new Error('유효하지 않은 파일 경로입니다.');
  let target = input;
  const fileUrl = /^file:/i.test(target);
  if (fileUrl) {
    const url = new URL(target);
    if (url.hostname) throw new Error('네트워크 파일은 열 수 없습니다.');
    target = fileURLToPath(url);
  }
  assertDocumentPath(target);
  let real;
  try { real = await fs.realpath(target); }
  catch (error) {
    // 실제 % 파일명을 먼저 찾고, 없을 때만 Markdown URI 인코딩을 한 번 해석한다.
    if (fileUrl || !['ENOENT','ENOTDIR'].includes(error.code) || !/%[\da-f]{2}/i.test(target)) throw error;
    try { target = decodeURIComponent(target); }
    catch { throw new Error('잘못된 파일 경로 인코딩입니다.'); }
    assertDocumentPath(target);
    real = await fs.realpath(target);
  }
  assertDocumentPath(real);
  if (!(await fs.stat(real)).isFile()) throw new Error('일반 로컬 문서 파일만 열 수 있습니다.');
  return real;
}
function isRelativeDocumentReference(input) {
  return typeof input === 'string' && input.length <= 4096 && !/[\x00-\x1f]/.test(input)
    && !path.isAbsolute(input) && !/^(?:[\w+.-]+:|[/\\]{2})/.test(input)
    && allowed.has(path.extname(input).toLowerCase());
}
module.exports = { resolveDocumentPath, isRelativeDocumentReference };
