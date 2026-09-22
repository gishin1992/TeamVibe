import { fixtureResultData } from "./result-context.mjs";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
const r = await fetch(base + "/api/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: "jimin" }),
});
assert.equal(r.status, 200);
const cookie = r.headers.get("set-cookie").split(";")[0];
async function call(path, body, status = 200) {
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
    name: "스토리 편집 · 완료 상태 보존",
    description: "실제로 확인한 작은 동작과 변경 없는 저장을 비교한다.",
    goal: "검증한 스토리는 그대로 저장해도 완료를 유지하고 실제 변경은 다시 개발한다.",
  },
  201,
);
async function op(type, data = {}) {
  p = await call("projects/" + p.id, { type, version: p.version, ...fixtureResultData(p, type, data) });
}
await op("prd.save", {
  body: "# 확인 버튼 시연\n합성 화면에서 확인 버튼을 누르면 확인 전이 확인 완료로 바뀐다. 외부 연결과 저장 기능은 없다.",
});
await op("prd.approve");
await op("story.save", {
  title: "확인 버튼 동작",
  description: "팀원으로서 검토를 마친 후 확인 버튼으로 완료 안내를 본다.",
  acceptance: ["확인 버튼을 누르면 안내가 확인 완료로 바뀐다."],
  tests: ["처음 확인 전과 버튼 클릭 후 확인 완료 표시를 비교한다."],
  dependencies: [],
  requirementIds: [],
  ownerId: "jimin",
  status: "ready",
});
await op("run.start", { storyIds: [p.stories[0].id] });
await op("run.submit", {
  id: p.runs[0].id,
  files: {
    "index.html":
      '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>검토 확인</title><style>body{font:18px system-ui;margin:0;padding:32px;background:#f2f6ff;color:#182544}main{max-width:480px;margin:auto;padding:24px;background:white;border:1px solid #dce3ef;border-radius:16px}h1{font-size:24px}button{background:#305fe5;color:white;border:0;border-radius:8px;padding:12px 24px;font:inherit}</style><main><h1>팀 검토 확인</h1><p id="result" aria-live="polite">확인 전</p><button id="confirm">확인</button><p>합성 시연 · 새로고침하면 초기화됩니다.</p></main><script>document.getElementById("confirm").onclick=()=>{document.getElementById("result").textContent="확인 완료"}</script></html>',
  },
  log: "로컬 합성 코드 작성. 준비 시점에는 브라우저 동작 미검증.",
  source: "scripts/prepare-story-editing-demo.mjs · 실제 ChatGPT 호출 없음",
});
await op("release.create", {
  title: "확인 버튼 · 최초 버전",
  runIds: [p.runs[0].id],
});
writeFileSync(
  "evidence/story-editing-browser-before.json",
  JSON.stringify(p, null, 2),
);
console.log(
  JSON.stringify({ projectId: p.id, name: p.name, storyId: p.stories[0].id }),
);
