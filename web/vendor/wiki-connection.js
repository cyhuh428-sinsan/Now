/* Existing Provider request and Wiki consent contract, independent of memo UI. */
(() => {
"use strict";
function configured(llm) {
  if (llm.provider === "ollama") return Boolean(llm.ollamaUrl.trim()) && Boolean(llm.ollamaModel.trim());
  if (llm.provider === "omniroute") {
    try {
      return Boolean(baseUrl(llm.omniUrl)) && Boolean(llm.omniModel.trim()) && Boolean(llm.omniApiKey.trim());
    } catch {
      return false;
    }
  }
  return Boolean(llm.apiKey.trim());
}

function baseUrl(raw) {
  const url = new URL(String(raw || "").trim());
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid OmniRoute endpoint");
  }
  const base = `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  return /\/v1$/i.test(base) ? base : `${base}/v1`;
}

async function requestChat(provider, config, prompt, options = null) {
  const wiki=options!==null;
  if(wiki&&(!options||Object.keys(options).length!==2||!Object.hasOwn({"wiki-ingest":4096,"wiki-query":2048,"wiki-lint":2048},options.purpose)
    ||options.maxOutputTokens!==({"wiki-ingest":4096,"wiki-query":2048,"wiki-lint":2048})[options.purpose]))
    throw new Error("위키 요청 출력 예산이 다릅니다.");
  const requestBody=body=>{
    if(!wiki)return body;
    if(provider==="gemini")return {...body,generationConfig:{...body.generationConfig,maxOutputTokens:options.maxOutputTokens}};
    if(["openai","groq"].includes(provider)){const {max_tokens,...rest}=body;return {...rest,max_completion_tokens:options.maxOutputTokens};}
    return {...body,max_tokens:options.maxOutputTokens};
  };
  const post=(url,request)=>fetch(url,wiki?{...request,signal:AbortSignal.timeout(60000)}:request);
  const requesters = {
    openai: () => post("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.3, max_tokens: 2048 })),
    }),
    groq: () => post("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], temperature: 0.3, max_tokens: 2048 })),
    }),
    omniroute: () => post(`${baseUrl(config.omniUrl)}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.omniApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody({ model: config.omniModel.trim(), messages: [{ role: "user", content: prompt }],
        ...(config.omniReasoning ? { reasoning_effort: config.omniReasoning } : {}), stream: false })),
    }),
    grok: () => post("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody({ model: "grok-2-latest", messages: [{ role: "user", content: prompt }], temperature: 0.3, max_tokens: 2048 })),
    }),
    gemini: () => post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 2048 } })),
    }),
    claude: () => post("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify(requestBody({ model: "claude-3-5-haiku-20241022", max_tokens: 2048, messages: [{ role: "user", content: prompt }] })),
    }),
    ollama: () => {
      let base = config.ollamaUrl.trim().replace(/\/+$/, "");
      if (!/\/v1$/.test(base)) base = `${base}/v1`;
      return post(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: "Bearer daon-local-key", "Content-Type": "application/json" },
        body: JSON.stringify(requestBody({ model: config.ollamaModel, messages: [{ role: "user", content: prompt }], temperature: 0.3, stream: false })),
      });
    },
  };
  const requester = requesters[provider];
  if (!requester) throw new Error(`지원하지 않는 LLM provider: ${provider}`);
  return requester();
}

function responseText(provider, data) {
  if (provider === "gemini") return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (provider === "claude") return data?.content?.[0]?.text ?? "";
  return data?.choices?.[0]?.message?.content ?? "";
}

function create({readConfig,contextKey,purpose="wiki-ingest",verify=async()=>{}}){
  const outputTokens=({"wiki-ingest":4096,"wiki-query":2048,"wiki-lint":2048})[purpose];
  if(!Object.hasOwn({"wiki-ingest":4096,"wiki-query":2048,"wiki-lint":2048},purpose))throw new Error("위키 요청 목적이 다릅니다.");
  const config=structuredClone(readConfig()),provider=config.provider;
  if(!configured(config))throw new Error("설정에서 LLM 연결을 먼저 확인하세요.");
  const defaults={
    openai:["gpt-4o-mini","https://api.openai.com/v1"],
    groq:["llama-3.3-70b-versatile","https://api.groq.com/openai/v1"],
    grok:["grok-2-latest","https://api.x.ai/v1"],
    gemini:["gemini-1.5-flash","https://generativelanguage.googleapis.com/v1beta"],
    claude:["claude-3-5-haiku-20241022","https://api.anthropic.com/v1"],
  };
  let model,endpoint;
  if(provider==="omniroute"){model=config.omniModel.trim();endpoint=baseUrl(config.omniUrl);}
  else if(provider==="ollama"){
    model=config.ollamaModel.trim();endpoint=config.ollamaUrl.trim().replace(/\/+$/,"");
    if(!/\/v1$/.test(endpoint))endpoint+="/v1";
    const url=new URL(endpoint);
    if(!["http:","https:"].includes(url.protocol)||url.username||url.password||url.search||url.hash)
      throw new Error("Ollama 서버 주소를 확인하세요.");
  }else [model,endpoint]=defaults[provider]||[];
  if(!model||!endpoint)throw new Error("지원하지 않는 LLM 연결입니다.");
  const key=contextKey();let invoked=false;
  const unchanged=()=>JSON.stringify(readConfig())===JSON.stringify(config);
  return {provider,model,endpoint,reasoning:provider==="omniroute"?config.omniReasoning||"":"",outputTokens,callLimit:1,invoke:async prompt=>{
    if(key!==contextKey())throw new Error("계정·보호 상태가 변경되었습니다.");
    if(!unchanged())throw new Error("LLM 설정·모델이 변경되었습니다. 전송 범위를 다시 확인하세요.");
    if(invoked)throw new Error("위키 생성 요청은 작업당 한 번만 전송합니다.");invoked=true;
    await verify();
    if(key!==contextKey()||!unchanged())throw new Error("계정·LLM 설정이 변경되었습니다. 전송하지 않았습니다.");
    const response=await requestChat(provider,config,prompt,{purpose,maxOutputTokens:outputTokens});
    if(key!==contextKey())throw new Error("계정·보호 상태가 변경되었습니다.");
    if(!unchanged())throw new Error("LLM 설정·모델이 변경되었습니다.");
    if(!response.ok)throw new Error("LLM 응답 실패: HTTP "+response.status);
    const data=await response.json();
    await verify();
    if(key!==contextKey())throw new Error("계정·보호 상태가 변경되었습니다.");
    if(!unchanged())throw new Error("LLM 설정·모델이 변경되었습니다.");
    const text=responseText(provider,data);
    if(typeof text!=="string"||!text.trim())throw new Error("위키 초안 응답이 비어 있습니다.");
    return text.trim();
  }};
}


globalThis.NowWikiConnection={create};
})();
