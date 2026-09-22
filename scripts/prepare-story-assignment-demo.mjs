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
  seoyeon = await client("seoyeon"),
  hyunwoo = await client("hyunwoo");
let p = await jimin(
  "projects",
  {
    name: "담당자 인계 · 진행 작업과 검증 보존",
    description:
      "합성 팀에서 담당자를 변경하고 기존 실행 결과를 이어서 확인한다.",
    goal: "업무 내용과 담당 변경을 구분하고 팀원 제외 뒤 남은 팀에 인계한다.",
  },
  201,
);
for (const c of [seoyeon, hyunwoo]) p = await c("join", { code: p.inviteCode });
async function op(type, data = {}, c = jimin) {
  p = await c("projects/" + p.id, {
    type,
    version: p.version,
    ...fixtureResultData(p, type, data),
  });
}
await op("prd.save", {
  body: "# 합성 팀 검토\n첫 작업은 확인 버튼을 누르면 확인 전이 확인 완료로 바뀐다. 두 번째 독립 작업은 별도 안내 화면이며 아직 결과를 기다린다. 외부 연결은 없다.",
});
for (const c of [jimin, seoyeon, hyunwoo]) await op("prd.approve", {}, c);
for (const [title, description] of [
  ["검증을 마친 확인 버튼", "확인 버튼을 누르면 확인 완료 문구가 표시된다."],
  ["결과를 기다리는 안내 화면", "별도 안내 화면을 구현한다."],
])
  await op("story.save", {
    title,
    description,
    acceptance: [description],
    tests: [
      title === "검증을 마친 확인 버튼"
        ? "실제 미리보기의 확인 전과 클릭 후 확인 완료를 비교한다."
        : "별도 안내 화면을 확인한다.",
    ],
    dependencies: [],
    requirementIds: [],
    ownerId: "seoyeon",
    status: "ready",
  });
await op("run.start", { storyIds: p.stories.map((s) => s.id) });
await op("run.submit", {
  id: p.runs[0].id,
  files: {
    "index.html":
      '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>팀 검토 인계</title><style>body{font:18px system-ui;padding:24px;color:#233453;background:#f4f7ff}main{max-width:440px;margin:auto;padding:24px;border-radius:16px;background:white}button{font:inherit;background:#405ee9;color:white;padding:12px 24px;border:0;border-radius:8px}</style></head><body><main><h1>팀 검토 인계</h1><p id="result">확인 전</p><button id="confirm">확인하기</button><p>담당자가 바뀌어도 같은 기능을 확인합니다.</p></main><script>document.getElementById("confirm").onclick=()=>document.getElementById("result").textContent="확인 완료"</script></body></html>',
  },
  log: "합성 코드 준비. 준비 시점에는 브라우저 동작 미검증.",
  source: "scripts/prepare-story-assignment-demo.mjs · 실제 ChatGPT 호출 없음",
});
await op("release.create", {
  title: "담당 인계 전 확인 버튼",
  runIds: [p.runs[0].id],
});
writeFileSync(
  "evidence/story-assignment-browser-before.json",
  JSON.stringify(p, null, 2),
);
console.log(
  JSON.stringify({
    projectId: p.id,
    name: p.name,
    stories: p.stories.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
    })),
  }),
);
