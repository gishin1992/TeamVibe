import { fixtureResultData } from "../scripts/result-context.mjs";
// Local-only manual browser verification. This server never makes an outbound request.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";

const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
const startedAt = new Date().toISOString();
const requests = [];
const server = createServer((req, res) => {
  if (req.url.startsWith("/sink/")) {
    requests.push({
      at: new Date().toISOString(),
      method: req.method,
      path: req.url,
    });
    writeFileSync(
      "evidence/sandbox-network-received.json",
      JSON.stringify({ startedAt, requests }, null, 2),
    );
  }
  res.setHeader("Cache-Control", "no-store");
  if (req.url === "/preview.html") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(readFileSync("evidence/demo-preview.html"));
  } else {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ startedAt, requests }));
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
writeFileSync(
  "evidence/sandbox-network-received.json",
  JSON.stringify({ startedAt, requests }, null, 2),
);
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body>
<h1>로컬 격리 검증</h1><p>합성 값만 사용하며 모든 목적지는 이 컴퓨터의 기록 서버입니다.</p>
<button id="probe">격리 검사 실행</button><pre id="results"></pre>
<form method="post" action="${origin}/sink/form"><button>폼 전송 차단 확인</button></form>
<button id="navigation">프레임 탐색 차단 확인</button>
<script>
const lines=[];const add=(name,result)=>{lines.push(name+': '+result);document.getElementById('results').textContent=lines.join('\\n')};
document.addEventListener('securitypolicyviolation',e=>add('CSP',e.violatedDirective));
document.getElementById('probe').onclick=async()=>{
 try{void parent.document.body;add('parent DOM','UNEXPECTED allowed')}catch(e){add('parent DOM',e.name)}
 try{void document.cookie;add('cookie','UNEXPECTED allowed')}catch(e){add('cookie',e.name)}
 try{void localStorage.length;add('localStorage','UNEXPECTED allowed')}catch(e){add('localStorage',e.name)}
 try{await fetch('${origin}/sink/fetch');add('fetch','UNEXPECTED allowed')}catch(e){add('fetch','blocked')}
 const img=document.createElement('img');img.alt='차단할 로컬 이미지';img.src='${origin}/sink/image';img.onerror=()=>add('image','blocked');document.body.append(img);
 const nested=document.createElement('iframe');nested.title='차단할 로컬 프레임';nested.src='${origin}/sink/iframe';document.body.append(nested);
 add('검사','요청 완료');
};
document.getElementById('navigation').onclick=()=>{add('navigation','attempted');location.href='${origin}/sink/navigation'};
</script></body></html>`;
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
  const p = await r.json();
  assert.equal(r.status, status, JSON.stringify(p));
  return p;
}
let p = await call(
  "projects",
  {
    name: "로컬 샌드박스 검증 " + Date.now(),
    description:
      "외부 전송 없이 동일 컴퓨터의 수신 기록 서버로 격리 여부를 확인하는 합성 테스트",
    goal: "부모 접근, 저장소, 네트워크와 탐색 차단 검증",
  },
  201,
);
const op = async (type, data = {}) =>
  (p = await call("projects/" + p.id, { type, version: p.version, ...fixtureResultData(p, type, data) }));
await op("requirement.save", {
  title: "격리 경계 검사",
  description: "샘플 코드의 차단 경계 확인",
  priority: "must",
  status: "accepted",
  decision: "로컬 합성 검사만 사용",
  sourceIds: [],
});
await op("prd.generate");
await op("prd.approve");
await op("story.save", {
  title: "로컬 격리 검사 화면",
  description: "요청 차단과 부모·저장소 접근을 관찰한다.",
  acceptance: ["실제 결과만 기록한다."],
  tests: ["브라우저 격리 동작과 수신 로그 대조"],
  dependencies: [],
  requirementIds: [],
  ownerId: "jimin",
  status: "ready",
});
await op("run.start", { storyIds: [p.stories[0].id] });
await op("run.submit", {
  id: p.runs[0].id,
  files: { "index.html": html },
  log: "브라우저 실행 검증을 위해 직접 만든 합성 probe. 실제 결과는 실행 후 별도 보존한다.",
  source: "tests/serve-browser-fixtures.mjs",
});
await op("release.create", {
  title: "격리 검증 fixture",
  runIds: [p.runs[0].id],
});
writeFileSync(
  "evidence/sandbox-preparation.json",
  JSON.stringify(
    { startedAt, origin, projectId: p.id, projectName: p.name },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      origin,
      projectId: p.id,
      projectName: p.name,
      portablePreview: origin + "/preview.html",
    },
    null,
    2,
  ),
);
process.on("SIGINT", () => server.close(() => process.exit(0)));
