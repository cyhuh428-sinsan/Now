const fs = require('node:fs/promises');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const allowed = new Set(['.txt','.md','.pdf','.png','.jpg','.jpeg','.gif','.webp','.csv','.docx','.xlsx','.pptx']);

async function resolveDocumentPath(input) {
  if (typeof input !== 'string' || input.length > 4096 || /[\x00-\x1f]/.test(input)) throw new Error('유효하지 않은 파일 경로입니다.');
  let target = input;
  if (/^file:/i.test(target)) {
    const url = new URL(target);
    if (url.hostname) throw new Error('네트워크 파일은 열 수 없습니다.');
    target = fileURLToPath(url);
  }
  if (!path.isAbsolute(target) || /^[/\\]{2}/.test(target) || target.includes(':', 2)) throw new Error('로컬 파일의 절대 경로가 필요합니다.');
  if (!allowed.has(path.extname(target).toLowerCase())) throw new Error('이 파일 형식은 열 수 없습니다.');
  const real = await fs.realpath(target);
  if (/^[/\\]{2}/.test(real) || real.includes(':', 2) || !allowed.has(path.extname(real).toLowerCase()) || !(await fs.stat(real)).isFile()) throw new Error('일반 로컬 문서 파일만 열 수 있습니다.');
  return real;
}
function isRelativeDocumentReference(input) {
  return typeof input === 'string' && input.length <= 4096 && !/[\x00-\x1f]/.test(input)
    && !path.isAbsolute(input) && !/^(?:[\w+.-]+:|[/\\]{2})/.test(input)
    && allowed.has(path.extname(input).toLowerCase());
}
module.exports = { resolveDocumentPath, isRelativeDocumentReference };
