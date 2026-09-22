import { fixtureResultData } from "./result-context.mjs";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
async function login(userId) {
  const r = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
const jimin = await login("jimin"),
  seoyeon = await login("seoyeon");
async function call(path, body, cookie = jimin, status = 200) {
  const r = await fetch(base + "/api/" + path, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  assert.equal(r.status, status, JSON.stringify(d));
  return d;
}
let p = await call(
  "projects",
  {
    name: "검증 기록 이력 · 팀 검토 시연",
    description: "실제 미리보기 관찰과 이후 기록 편집을 구분하는 합성 시연",
    goal: "테스트 원본과 팀원의 수정 이력을 보존한다.",
  },
  jimin,
  201,
);
p = await call("join", { code: p.inviteCode }, seoyeon);
async function op(type, data = {}, cookie = jimin) {
  p = await call(
    "projects/" + p.id,
    { type, version: p.version, ...fixtureResultData(p, type, data) },
    cookie,
  );
}
await op("prd.save", {
  body: "# 검증 기록 시연\n미리보기에서 확인 횟수 0을 확인하고 버튼을 한 번 누르면 1이 된다. 실제 관찰과 기록 편집은 구분한다.",
});
await op("prd.approve");
await op("prd.approve", {}, seoyeon);
await op("story.save", {
  title: "확인 횟수 버튼",
  description: "한 번 누르면 확인 횟수가 0에서 1로 바뀐다.",
  acceptance: ["확인 버튼으로 횟수 0을 1로 바꿀 수 있다."],
  tests: ["미리보기의 초기 0을 확인하고 확인 버튼을 한 번 눌러 1을 확인한다."],
  dependencies: [],
  requirementIds: [],
  ownerId: "jimin",
  status: "ready",
});
await op("run.start", { storyIds: [p.stories[0].id] });
const run = p.runs[0];
await op("run.submit", {
  id: run.id,
  files: {
    "index.html":
      '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>검증 이력 확인</title><style>body{font-family:system-ui;padding:24px;color:#21324b}button{padding:12px 20px;font-size:18px;background:#405ceb;color:white;border:0;border-radius:8px}output{font-size:32px;display:block;margin:20px 0}</style></head><body><h1>검증 이력 확인</h1><p>합성 시연 · 외부 연결 없음</p><output id="count" aria-label="확인 횟수">0</output><button id="confirm">확인</button><script>let count=0;document.querySelector("#confirm").onclick=()=>document.querySelector("#count").textContent=String(++count);</script></body></html>',
  },
  log: "검증 이력 시연용 합성 코드를 준비했다. 이 로그 작성 시점에는 브라우저 실행 전이다.",
  source: "로컬 합성 코드 · 실제 ChatGPT 호출 없음",
});
await op("release.create", { runIds: [run.id], title: "확인 횟수 시연 v1" });
writeFileSync(
  "evidence/test-history-browser-fixture.json",
  JSON.stringify(p, null, 2),
);
console.log({
  projectId: p.id,
  storyId: p.stories[0].id,
  releaseId: p.releases[0].id,
});
