// Browser-only preview. Never evaluates imported code in the TeamVibe page/server.
export function previewDocument(
  files: Record<string, string>,
  bridge?: { token: string; parentOrigin: string },
): string {
  let html = files["index.html"] || "<h1>index.html 파일이 없습니다.</h1>";
  html = html.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, "");
  html = html.replace(/<base\b[^>]*>/gi, "");
  html = html.replace(
    /<link\b[^>]*href=["'](?:\.\/)?([^"']+)["'][^>]*>/gi,
    (tag, path: string) =>
      path.endsWith(".css") && files[path] !== undefined
        ? `<style>${files[path].replace(/<\/style/gi, "<\\/style")}</style>`
        : tag,
  );
  html = html.replace(
    /<script\b([^>]*?)src=["'](?:\.\/)?([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (tag, a: string, path: string, b: string) =>
      files[path] !== undefined
        ? `<script ${a}${b}>${files[path].replace(/<\/script/gi, "<\\/script")}</script>`
        : tag,
  );
  const policy = `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';`;
  const diagnostics = bridge
    ? `<script>(()=>{
    const settings=${JSON.stringify(bridge).replace(/</g, "\\u003c")};
    let count=0;
    const send=(kind,message)=>{if(count>=20)return;count++;try{parent.postMessage({type:"teamvibe.preview.diagnostic",token:settings.token,kind,message:String(message).slice(0,2000)},settings.parentOrigin)}catch{}};
    addEventListener("error",event=>{
      if(typeof event.message==="string")send("script",event.message);
      else if(event.target&&event.target!==window)send("resource",(event.target.tagName||"리소스")+" 파일을 불러오지 못했습니다. 상대 경로와 반입한 파일을 확인하세요.");
    },true);
    addEventListener("unhandledrejection",event=>{let message="처리되지 않은 비동기 오류입니다.";try{message=event.reason instanceof Error?event.reason.message:typeof event.reason==="string"?event.reason:message}catch{}send("promise",message)});
    addEventListener("securitypolicyviolation",event=>send("policy",(event.effectiveDirective||event.violatedDirective||"CSP")+": 이 실행 환경에서 허용되지 않는 요청입니다."));
  })();<\/script>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width,initial-scale=1">${diagnostics}</head><body>${html}</body></html>`;
}

/** A portable preview keeps imported code inside the same restricted iframe. */
export function standaloneDocument(
  files: Record<string, string>,
  title: string,
): string {
  const escape = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; frame-src about: blob:; base-uri 'none'; form-action 'none'">
<title>${escape(title)} · TeamVibe</title>
<style>html,body{height:100%;margin:0;font:14px system-ui,sans-serif;color:#273149;background:#f7f8fc}body{display:flex;flex-direction:column}header{padding:16px 20px;border-bottom:1px solid #ddd}h1{font-size:18px;margin:0 0 6px}p{margin:0;color:#596174}iframe{flex:1;width:100%;border:0;background:white}</style>
</head><body><header><h1>${escape(title)}</h1><p>TeamVibe 로컬 시연 · 외부 통신 제한 · 새로고침하면 실행 상태가 초기화됩니다.</p></header>
<iframe title="통합 코드 실행 미리보기" sandbox="allow-scripts allow-forms" srcdoc="${escape(previewDocument(files))}"></iframe>
</body></html>`;
}
