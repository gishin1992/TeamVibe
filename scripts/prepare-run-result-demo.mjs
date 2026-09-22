import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fixtureResultData } from "./result-context.mjs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
async function session(userId) {
  const r = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
const jimin = await session("jimin"),
  seoyeon = await session("seoyeon");
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
    name: "병렬 결과 반입 · 작업 일치 확인",
    description: "두 팀원의 합성 결과를 올바른 개발 작업에 반입한다.",
    goal: "서로 다른 작업의 결과를 혼동하지 않고 검토 후 통합한다.",
  },
  jimin,
  201,
);
p = await call("join", { code: p.inviteCode }, seoyeon);
async function op(type, data = {}, cookie = jimin) {
  p = await call(
    "projects/" + p.id,
    { type, version: p.version, ...data },
    cookie,
  );
}
await op("prd.save", {
  body: "# 작업 일치 확인\n안내 HTML/동작과 스타일을 독립적으로 만들고 로컬 샌드박스에서 통합한다. 합성 데이터만 사용한다.",
});
await op("prd.approve");
await op("prd.approve", {}, seoyeon);
for (const [title, ownerId] of [
  ["안내와 확인 버튼", "jimin"],
  ["안내 화면 스타일", "seoyeon"],
])
  await op("story.save", {
    title,
    description: title + "을 독립 파일로 작성한다.",
    acceptance: ["안내 문구와 버튼이 표시된다."],
    tests: ["통합 후 안내와 확인 버튼을 직접 확인한다."],
    dependencies: [],
    requirementIds: [],
    ownerId,
    status: "ready",
  });
await op("run.start", { storyIds: p.stories.map((s) => s.id) });
function result(run, files) {
  const { id, ...payload } = fixtureResultData(p, "run.submit", {
    id: run.id,
    files,
    deletedFiles: [],
    log: "로컬 합성 파일 작성. 준비 시점 브라우저 미실행.",
    source: "scripts/prepare-run-result-demo.mjs · 실제 ChatGPT 호출 없음",
  });
  return payload;
}
const app = result(p.runs[0], {
  "index.html":
    '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>작업 일치 확인</title><link rel="stylesheet" href="styles.css"><main><h1>작업 일치 확인</h1><p id="result">반입한 두 작업을 확인하세요.</p><button id="confirm">확인</button></main><script>document.getElementById("confirm").onclick=()=>document.getElementById("result").textContent="통합 결과 확인 완료"</script></html>',
});
const style = result(p.runs[1], {
  "styles.css":
    "body{font:18px system-ui;margin:0;padding:32px;background:#eef4ff;color:#18335e}main{max-width:480px;padding:24px;margin:auto;background:white;border:2px solid #315ed9;border-radius:16px}h1{font-size:26px}button{font:inherit;background:#315ed9;color:white;border:0;border-radius:8px;padding:12px 24px}",
});
writeFileSync(
  "evidence/run-result-browser-before.json",
  JSON.stringify(p, null, 2),
);
writeFileSync("data/sample-run-result-app.json", JSON.stringify(app, null, 2));
writeFileSync(
  "data/sample-run-result-style.json",
  JSON.stringify(style, null, 2),
);
writeFileSync(
  "evidence/run-result-browser-wrong-target.json",
  JSON.stringify({ ...app, id: p.runs[1].id }, null, 2),
);
console.log(
  JSON.stringify({
    projectId: p.id,
    name: p.name,
    runs: p.runs.map((r) => ({ id: r.id, title: r.title })),
  }),
);
