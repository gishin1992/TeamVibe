import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fixtureResultData } from "./result-context.mjs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
async function client(userId) {
  const login = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  return async (path, data, expected = 200) => {
    const response = await fetch(base + "/api/" + path, {
      method: data ? "POST" : "GET",
      headers: {
        Cookie: cookie,
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    return result;
  };
}
const jimin = await client("jimin"),
  seoyeon = await client("seoyeon");
let p = await jimin(
  "projects",
  {
    name: "개발 결과 수정 · 이전 코드 보존",
    description:
      "두 팀원이 반입한 합성 결과를 비교하고 이전 결과를 다시 선택하는 시연",
    goal: "결과를 수정해도 원래 코드와 수행 로그를 보존한다.",
  },
  201,
);
p = await seoyeon("join", { code: p.inviteCode });
const op = async (type, data = {}, who = jimin) =>
  (p = await who("projects/" + p.id, {
    type,
    version: p.version,
    ...fixtureResultData(p, type, data),
  }));
await op("prd.save", {
  body: "# 합성 확인 버튼\n버튼을 눌러 안내 문구가 바뀌는지 확인한다.",
});
await op("prd.approve");
await op("prd.approve", {}, seoyeon);
await op("story.save", {
  title: "확인 버튼의 결과 문구",
  description: "통합한 결과의 버튼 동작을 직접 확인한다.",
  acceptance: ["확인 버튼을 누르면 안내 문구가 바뀐다."],
  tests: ["버튼 클릭 전후 안내 문구를 확인한다."],
  dependencies: [],
  requirementIds: [],
  ownerId: "jimin",
  status: "ready",
});
await op("run.start", { storyIds: [p.stories[0].id] });
const runId = p.runs[0].id;
const html =
  '<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>body{font:16px system-ui;padding:24px;color:#24304a}button{font:inherit;padding:12px 18px;background:#475ce8;color:white;border:0;border-radius:8px}</style></head><body><h1>이전 결과 실행</h1><button id="confirm">결과 확인하기</button><p id="result">확인 전</p><script src="app.js"></script></body></html>';
await op("run.submit", {
  id: runId,
  files: {
    "index.html": html,
    "app.js":
      "document.getElementById('confirm').onclick=()=>{document.getElementById('result').textContent='첫 결과 실행 확인'};",
  },
  log: "첫 합성 결과입니다. 버튼 문구를 작성했으며 아직 브라우저에서 실행하지 않았습니다.",
  source: "합성 첫 결과 · 실제 AI 호출 없음",
});
await op(
  "run.submit",
  {
    id: runId,
    files: {
      "index.html": html,
      "app.js":
        "document.getElementById('confirm').onclick=()=>{document.getElementById('result').textContent='수정 결과 실행 확인'};",
    },
    log: "두 번째 합성 결과입니다. 버튼 문구만 바꿨으며 아직 브라우저에서 실행하지 않았습니다.",
    source: "합성 수정 결과 · 실제 AI 호출 없음",
  },
  seoyeon,
);
writeFileSync(
  "evidence/run-submissions-browser-before.json",
  JSON.stringify(p, null, 2),
);
writeFileSync(
  "evidence/run-submissions-preparation.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      projectId: p.id,
      projectName: p.name,
      runId,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ projectId: p.id, projectName: p.name, runId }, null, 2),
);
