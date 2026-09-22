import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fixtureResultData } from "./result-context.mjs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
async function client(userId) {
  const r = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie").split(";")[0];
  return async (path, data, status = 200) => {
    const r = await fetch(base + "/api/" + path, {
      method: data ? "POST" : "GET",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const body = await r.json();
    assert.equal(r.status, status, JSON.stringify(body));
    return body;
  };
}
const jimin = await client("jimin"),
  seoyeon = await client("seoyeon");
let p = await jimin(
  "projects",
  {
    name: "통합 검토 초안 · 작업 묶음별 보존",
    description:
      "선택 작업과 화면을 바꿔도 최종 코드와 해결 근거를 보존하는 합성 시연",
    goal: "검토하던 통합안을 잃지 않고 최신 팀 변경과 다시 비교한다.",
  },
  201,
);
p = await seoyeon("join", { code: p.inviteCode });
const op = async (type, data = {}) =>
  (p = await jimin("projects/" + p.id, {
    type,
    version: p.version,
    ...fixtureResultData(p, type, data),
  }));
await op("prd.save", {
  body: "# 합성 통합 검토\n버튼을 눌러 확인 문구와 확인 횟수를 함께 표시한다. 두 기능의 코드를 비교하여 하나의 화면으로 통합한다.",
});
await op("prd.approve");
p = await seoyeon("projects/" + p.id, {
  type: "prd.approve",
  version: p.version,
});
for (const [title, acceptance] of [
  ["확인 문구 표시", "버튼을 누르면 확인 완료 문구가 표시된다."],
  ["확인 횟수 표시", "버튼을 누를 때마다 확인 횟수가 1씩 증가한다."],
])
  await op("story.save", {
    title,
    description: acceptance,
    acceptance: [acceptance],
    tests: ["실제 미리보기에서 버튼 클릭 전후 값을 비교한다."],
    dependencies: [],
    requirementIds: [],
    ownerId: "jimin",
    status: "ready",
  });
await op("run.start", { storyIds: p.stories.map((s) => s.id) });
const wrap = (body) =>
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:18px system-ui;padding:24px;color:#24304a}button{font:inherit;padding:12px 18px;background:#475ce8;color:white;border:0;border-radius:8px}</style></head><body>${body}</body></html>`;
for (const [index, run] of p.runs.entries())
  await op("run.submit", {
    id: run.id,
    files: {
      "index.html": wrap(
        index === 0
          ? '<h1>확인 문구</h1><button id="confirm">확인하기</button><p id="message">확인 전</p><script>document.getElementById("confirm").onclick=()=>document.getElementById("message").textContent="확인 완료"</script>'
          : '<h1>확인 횟수</h1><button id="confirm">확인하기</button><p id="count">0</p><script>let n=0;document.getElementById("confirm").onclick=()=>document.getElementById("count").textContent=String(++n)</script>',
      ),
    },
    log: "합성 코드 작성. 아직 브라우저에서 실행하지 않았습니다.",
    source: "통합 초안 보존용 합성 결과 · AI 호출 없음",
  });
const merged = wrap(
  '<h1>함께 검토한 결과</h1><button id="confirm">확인하기</button><p id="message">확인 전</p><p id="count">0</p><script>let n=0;document.getElementById("confirm").onclick=()=>{document.getElementById("message").textContent="확인 완료";document.getElementById("count").textContent=String(++n)}</script>',
);
const plan = {
  projectId: p.id,
  projectVersion: p.version,
  activeReleaseId: "",
  runIds: p.runs.map((r) => r.id),
  source: "합성 충돌 해결안 · 아직 실행하지 않음",
  resolutions: {
    "index.html": {
      content: merged,
      reason:
        "확인 문구와 횟수를 한 버튼에 연결했다. 통합 후 문구와 0→1→2 증가를 실제로 확인해야 한다.",
    },
  },
};
for (const [name, value] of [
  ["before", p],
  ["plan", plan],
])
  writeFileSync(
    `evidence/integration-drafts-${name}.json`,
    JSON.stringify(value, null, 2),
  );
console.log(
  JSON.stringify({ projectId: p.id, runIds: p.runs.map((r) => r.id) }, null, 2),
);
