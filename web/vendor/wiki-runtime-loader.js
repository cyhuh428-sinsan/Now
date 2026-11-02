/* Wiki UI is loaded only by an explicit caller; no account data is retained here. */
(function () {
  'use strict';
  const pageURL = new URL(globalThis.location.href);
  const scriptURL = new URL(document.currentScript?.src || pageURL.href, pageURL);
  const runtimeURL = new URL('wiki-runtime.js', scriptURL);
  let pending = null;

  globalThis.ensureNowWikiRuntime = function ensureNowWikiRuntime() {
    if (pending) return pending;
    if (runtimeURL.origin !== pageURL.origin || runtimeURL.protocol !== pageURL.protocol) {
      return Promise.reject(new Error('wiki_runtime_origin'));
    }
    let script;
    const attempt = new Promise((resolve, reject) => {
      script = document.createElement('script');
      script.src = runtimeURL.href;
      script.async = true;
      function finish(error) {
        script.onload = script.onerror = null;
        if (error) { script.remove(); reject(error); }
        else resolve();
      }
      script.onload = () => {
        const ready = typeof globalThis.cytoscape === 'function'
          && typeof globalThis.mountWikiGraph === 'function'
          && typeof globalThis.mountNowWiki === 'function';
        finish(ready ? null : new Error('wiki_runtime_incomplete'));
      };
      script.onerror = () => finish(new Error('wiki_runtime_load_failed'));
      document.head.appendChild(script);
    });
    pending = attempt;
    // A failed request is retried only by the next explicit ensure call.
    attempt.catch(() => { if (pending === attempt) pending = null; });
    return attempt;
  };
})();

globalThis.createLazyWikiView=function createLazyWikiView({contextKey,mount,prepare=async()=>{}}){
  let view=null,generation=0,pendingContext=null;
  async function open(method,args){
    const token=++generation,bound=contextKey();pendingContext=bound;
    await ensureNowWikiRuntime();
    if(token!==generation||bound!==contextKey())return false;
    await prepare();
    if(token!==generation||bound!==contextKey())return false;
    if(method==='openProtected')args[1]?.guard?.();
    view ||= mount();
    return view[method](...args);
  }
  return {
    open:(...args)=>open('open',args),
    openProtected:(...args)=>open('openProtected',args),
    close(){generation++;pendingContext=null;view?.close();},
    check(){if(pendingContext!==null&&pendingContext!==contextKey()){generation++;pendingContext=null;view?.close();}else view?.check();},
  };
};
