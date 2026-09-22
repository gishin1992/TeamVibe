// Creates a new synthetic project and a loopback-only request sink. No external AI call.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { fixtureResultData } from "./result-context.mjs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
const startedAt = new Date().toISOString();
const requests = [];
const save = (path, value) =>
  writeFileSync(path, JSON.stringify(value, null, 2));
const server = createServer((req, res) => {
  if (req.url.startsWith("/sink/")) {
    requests.push({
      at: new Date().toISOString(),
      method: req.method,
      path: req.url,
    });
    save("evidence/preview-diagnostics-network.json", { startedAt, requests });
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ startedAt, requests }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
save("evidence/preview-diagnostics-network.json", { startedAt, requests });
const login = await fetch(base + "/api/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: "jimin" }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";")[0];
async function call(path, body, status = 200) {
  const r = await fetch(base + "/api/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: cookie,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  assert.equal(r.status, status, JSON.stringify(data));
  return data;
}
let p = await call(
  "projects",
  {
    name: "미리보기 실행 오류 · 수정 확인",
    description: "오류 표시와 격리 경계, 재실행을 확인하는 합성 코드",
    goal: "팀원이 실행 오류를 확인하고 수정 요청에 사용할 수 있다.",
  },
  201,
);
const op = async (type, data = {}) =>
  (p = await call("projects/" + p.id, {
    type,
    version: p.version,
    ...fixtureResultData(p, type, data),
  }));
await op("prd.save", {
  body: "# 실행 오류 안내\n합성 오류를 확인한 뒤 수정된 화면을 직접 검증한다.",
});
await op("prd.approve");
await op("story.save", {
  title: "실행 오류 확인",
  description: "오류 감지 자체를 테스트 통과로 기록하지 않는다.",
  acceptance: ["버튼으로 확인 횟수를 증가시킬 수 있다."],
  tests: ["실제 버튼 동작을 확인한다."],
  dependencies: [],
  requirementIds: [],
  ownerId: "jimin",
  status: "ready",
});
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>body{font:16px system-ui;padding:20px;color:#24304a}button{font:inherit;padding:10px;margin:4px;border:1px solid #ced4e0;border-radius:8px;background:#f3f6ff}pre{white-space:pre-wrap}</style></head><body>
<h1>미리보기 오류 확인</h1><p>합성 코드 · 외부 전송 없음</p>
<button id="count">확인 횟수 늘리기</button><p id="count-result">확인 횟수: 0</p>
<button id="error">실행 오류 만들기</button><button id="promise">비동기 오류 만들기</button>
<button id="probe">격리 검사 실행</button><button id="flood">오류 30건 만들기</button>
<pre id="probe-result"></pre><script src="broken.js"></script><script src="app.js"></script></body></html>`;
const app = `let count=0;document.getElementById('count').onclick=()=>{document.getElementById('count-result').textContent='확인 횟수: '+(++count)};
document.getElementById('error').onclick=()=>{throw new Error('합성 버튼 실행 오류 <strong>문자 그대로</strong>')};
document.getElementById('promise').onclick=()=>{Promise.reject(new Error('합성 비동기 오류'))};
document.getElementById('flood').onclick=()=>{for(let i=1;i<=30;i++)setTimeout(()=>{throw new Error('합성 반복 오류 '+i)},0)};
document.getElementById('probe').onclick=async()=>{const lines=[];for(const [name,read] of [['parent DOM',()=>parent.document.body],['cookie',()=>document.cookie],['localStorage',()=>localStorage.length]]){try{read();lines.push(name+': UNEXPECTED allowed')}catch(e){lines.push(name+': '+e.name)}}try{await fetch('${origin}/sink/fetch');lines.push('fetch: UNEXPECTED allowed')}catch{lines.push('fetch: blocked')}const img=document.createElement('img');img.alt='차단 대상';img.src='${origin}/sink/image';document.body.append(img);document.getElementById('probe-result').textContent=lines.join('\\n')};`;
await op("run.start", { storyIds: [p.stories[0].id] });
await op("run.submit", {
  id: p.runs.at(-1).id,
  files: { "index.html": html, "broken.js": "const broken = ;", "app.js": app },
  log: "의도적 오류가 포함된 합성 시연 코드. 아직 브라우저 미실행.",
  source: "scripts/prepare-preview-diagnostics-demo.mjs",
});
await op("release.create", {
  title: "오류가 있는 합성 화면",
  runIds: [p.runs.at(-1).id],
});
const brokenReleaseId = p.releases.at(-1).id;
await op("story.save", {
  id: p.stories[0].id,
  title: p.stories[0].title,
  description: p.stories[0].description,
  acceptance: p.stories[0].acceptance,
  tests: p.stories[0].tests,
  dependencies: [],
  requirementIds: [],
  ownerId: "jimin",
  status: "ready",
});
await op("run.start", { storyIds: [p.stories[0].id] });
await op("run.submit", {
  id: p.runs.at(-1).id,
  files: {
    "index.html":
      '<h1>수정한 확인 화면</h1><button id="confirm">확인하기</button><p id="result">확인 전</p><script src="app.js"></script>',
    "app.js":
      "document.getElementById('confirm').onclick=()=>{document.getElementById('result').textContent='확인 완료'};",
  },
  deletedFiles: ["broken.js"],
  log: "의도적 오류를 제거한 합성 수정본. 아직 브라우저 미실행.",
  source: "scripts/prepare-preview-diagnostics-demo.mjs",
});
await op("release.create", {
  title: "오류를 제거한 확인 화면",
  runIds: [p.runs.at(-1).id],
});
const fixedReleaseId = p.releases.at(-1).id;
await op("release.activate", { id: brokenReleaseId });
save("evidence/preview-diagnostics-preparation.json", {
  startedAt,
  origin,
  projectId: p.id,
  projectName: p.name,
  brokenReleaseId,
  fixedReleaseId,
});
save("evidence/preview-diagnostics-before-project.json", p);
console.log(
  JSON.stringify(
    {
      origin,
      projectId: p.id,
      projectName: p.name,
      brokenReleaseId,
      fixedReleaseId,
    },
    null,
    2,
  ),
);
process.on("SIGINT", () => server.close(() => process.exit(0)));
