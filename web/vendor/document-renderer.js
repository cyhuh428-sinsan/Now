/* 원문을 변경하지 않는 문서 변환. 외부 HTML은 정제 후 DOM으로 구성한다. */
window.NowMarkdown = (() => {
  const tags = ['p','br','hr','strong','em','del','blockquote','ul','ol','li','pre','code','h1','h2','h3','h4','h5','h6','a','img','table','thead','tbody','tr','th','td','details','summary','input','span'];
  const clean = html => DOMPurify.sanitize(html, { ALLOWED_TAGS: tags, ALLOWED_ATTR: ['href','src','alt','title','open','start','type','checked','disabled','align','data-note-attachment-key'], ALLOW_DATA_ATTR: false });
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function scanHeadings(source) {
    const result = []; let offset = 0, fence = null, previous = '', previousOffset = 0;
    for (const line of String(source || '').split('\n')) {
      const text = line.replace(/^ {0,3}(?:> ?)+/, '');
      const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
      if (marker) {
        if (!fence) fence = marker[1];
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      } else if (!fence && !/^(?: {4}|\t)/.test(text)) {
        const match = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(text);
        if (match) result.push({ level: match[1].length, title: match[2], raw: line, index: offset, id: `note-heading-${result.length}` });
        else if (previous.trim() && /^ {0,3}(?:=+|-+)\s*$/.test(text)) result.push({ level: text.trim()[0] === '=' ? 1 : 2, title: previous.trim(), raw: previous + '\n' + line, index: previousOffset, id: `note-heading-${result.length}` });
      }
      previous = text; previousOffset = offset;
      offset += line.length + 1;
    }
    return result;
  }
  function render(source, options = {}) {
    const localPaths = [];
    const renderer = new marked.Renderer();
    renderer.link = function(token) {
      const href = String(token.href || '').trim(), label = this.parser.parseInline(token.tokens);
      if (/^(?:file:\/\/\/|[A-Za-z]:[\\/]|\.{0,2}[\\/])/.test(href) || (!/^[\w+.-]+:/.test(href) && /\.[\w]{1,8}(?:#.*)?$/.test(href))) {
        const key = localPaths.push(href) - 1;
        return `<span title="nownote-local-${key}">${label}</span>`;
      }
      return /^(?:https?:\/\/|mailto:|#)/i.test(href) ? `<a href="${escape(href)}">${label}</a>` : label;
    };
    renderer.image = token => options.image ? options.image(escape(token.text), escape(token.href)) : '';
    const root = document.createElement('div');
    root.innerHTML = clean(marked.parse(String(source || ''), { renderer, gfm: true, breaks: true }));
    // details raw block 안에 남은 텍스트도 같은 Markdown parser로 처리한다.
    for (const node of [...root.querySelectorAll('details, blockquote')]) {
      for (const text of [...node.childNodes]) {
        if (text.nodeType !== Node.TEXT_NODE || !text.textContent.trim()) continue;
        const fragment = document.createElement('div');
        fragment.innerHTML = clean(marked.parse(text.textContent, { renderer, gfm: true, breaks: true }));
        text.replaceWith(...fragment.childNodes);
      }
    }
    root.innerHTML = clean(root.innerHTML);
    root.querySelectorAll('span[title^="nownote-local-"]').forEach(span => {
      const index = Number(span.title.slice('nownote-local-'.length));
      const button = document.createElement('button'); button.type = 'button'; button.className = 'local-file-link';
      button.dataset.localPath = localPaths[index]; button.title = localPaths[index];
      button.append(...span.childNodes); span.replaceWith(button);
    });
    root.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href');
      if (!/^(https?:\/\/|mailto:|#)/i.test(href || '')) a.removeAttribute('href');
      else if (!href.startsWith('#')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    });
    root.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src') || '';
      if (src && !/^(?:https?:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(src)) img.removeAttribute('src');
      img.classList.add('note-inline-image');
    });
    root.querySelectorAll('input').forEach((input, index) => {
      input.type = 'checkbox'; input.disabled = !options.tasks;
      const item = input.closest('li');
      if (item) { item.classList.add('task-list-item'); item.dataset.taskIndex = String(index); }
    });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    for (const text of texts) {
      if (text.parentElement.closest('pre,code,a,button')) continue;
      const parts = text.textContent.split(/(\[\[[^\]\n]+\]\])/g);
      if (parts.length === 1) continue;
      text.replaceWith(...parts.map(part => {
        if (!part.startsWith('[[')) return document.createTextNode(part);
        const button = document.createElement('button'); button.type = 'button'; button.className = 'wiki-link';
        button.dataset.wikiLink = part.slice(2,-2); button.textContent = part.slice(2,-2); return button;
      }));
    }
    const sourceHeadings = scanHeadings(source);
    let sourceOffset = 0;
    root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading, index) => {
      heading.id = `note-heading-${index}`;
      const candidate = sourceHeadings.find(item => {
        const title = document.createElement('div'); title.innerHTML = clean(marked.parseInline(item.title));
        return item.index >= sourceOffset && title.textContent === heading.textContent;
      });
      const position = candidate?.index ?? Math.max(0, String(source).indexOf(heading.textContent, sourceOffset));
      heading.dataset.sourceIndex = String(position);
      heading.dataset.sourceLength = String(candidate?.raw.length || heading.textContent.length);
      sourceOffset = position + 1;
      if (!options.sections) return;
      const section = document.createElement('details'); section.className = 'document-section'; section.open = true;
      const summary = document.createElement('summary'), level = Number(heading.tagName[1]);
      heading.before(section); summary.append(heading); section.append(summary);
      while (section.nextSibling) {
        const next = section.nextSibling;
        if (/^H[1-6]$/.test(next.nodeName) && Number(next.nodeName[1]) <= level) break;
        section.append(next);
      }
    });
    if (!options.sections) root.querySelectorAll('details').forEach(detail => { detail.open = true; });
    if (options.code) root.querySelectorAll('pre > code').forEach(code => {
      const wrapper = document.createElement('div'); wrapper.innerHTML = options.code(escape(code.textContent), escape((code.className.match(/language-(\S+)/) || [,''])[1]));
      code.parentElement.replaceWith(...wrapper.childNodes);
    });
    return root.innerHTML;
  }
  function headings(source) {
    const root = document.createElement('div');
    root.innerHTML = render(source);
    return [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((heading, i) => {
      const index = Number(heading.dataset.sourceIndex);
      return { level: Number(heading.tagName[1]), title: heading.textContent,
        raw: String(source).slice(index, index + Number(heading.dataset.sourceLength)), index, id: heading.id };
    });
  }
  return { render, headings };
})();
