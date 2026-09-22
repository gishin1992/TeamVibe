import { fixtureResultData } from "./result-context.mjs";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
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
  const d = await r.json();
  assert.equal(r.status, status, JSON.stringify(d));
  return d;
}
const advance = process.argv.includes("--advance");
let p = advance
  ? await call(
      "projects/" +
        JSON.parse(
          readFileSync("evidence/test-record-browser-fixture.json", "utf8"),
        ).id,
    )
  : await call(
      "projects",
      {
        name: "릴리스별 검증 · 이전 기준 보존",
        description: "릴리스가 바뀐 뒤에도 실제 관찰 기록을 추적하는 합성 시연",
        goal: "검증 당시 기준과 현재 개발 기준을 구분한다.",
      },
      201,
    );
async function op(type, data = {}) {
  p = await call("projects/" + p.id, { type, version: p.version, ...fixtureResultData(p, type, data) });
}
if (advance) {
  assert.equal(p.releases.length, 1, "한 번만 다음 버전 준비 가능");
  assert.equal(
    p.testResults.length,
    1,
    "브라우저에서 첫 테스트 기록을 저장한 뒤 실행",
  );
  assert.equal(p.testResults[0].coverageSnapshots.length, 1);
  writeFileSync(
    "evidence/test-record-browser-before-upgrade.json",
    JSON.stringify(p, null, 2),
  );
} else {
  await op("prd.save", {
    body: "# 릴리스별 검증 시연\n합성 안내 문구를 실제 미리보기로 확인하고, 문구 변경 후 과거 검증 기록을 보존한다.",
  });
  await op("prd.approve");
}
const heading = advance ? "팀 검토 완료" : "팀 검토 준비";
await op("story.save", {
  ...(advance ? { id: p.stories[0].id } : {}),
  title: advance ? "새 안내 문구" : "이전 안내 문구",
  description: "미리보기에 " + heading + " 제목을 표시한다.",
  acceptance: [heading + " 제목이 보인다."],
  tests: ["미리보기 제목이 ‘" + heading + "’인지 확인한다."],
  dependencies: [],
  requirementIds: [],
  ownerId: "jimin",
  status: "ready",
});
await op("run.start", { storyIds: [p.stories[0].id] });
await op("run.submit", {
  id: p.runs.at(-1).id,
  files: {
    "index.html": `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading}</title><style>body{font-family:system-ui;padding:28px;color:#203353}h1{font-size:28px}p{color:#63718b}</style></head><body><h1>${heading}</h1><p>릴리스별 검증을 위한 합성 안내 화면입니다.</p></body></html>`,
  },
  log: "합성 안내 코드 준비. 이 로그 작성 시점에는 브라우저 실행 전이다.",
  source: "로컬 합성 코드, 실제 ChatGPT 호출 없음",
});
await op("release.create", {
  runIds: [p.runs.at(-1).id],
  title: advance ? "안내 화면 v2" : "안내 화면 v1",
});
if (advance)
  await op("item.delete", { collection: "releases", id: p.releases[0].id });
writeFileSync(
  advance
    ? "evidence/test-record-browser-after-upgrade.json"
    : "evidence/test-record-browser-fixture.json",
  JSON.stringify(p, null, 2),
);
console.log(
  JSON.stringify({
    projectId: p.id,
    storyId: p.stories[0].id,
    activeRelease: p.releases.at(-1).id,
    stage: advance
      ? "v2 prepared; v1 archived, test records preserved"
      : "v1 prepared; no test execution claimed",
  }),
);
