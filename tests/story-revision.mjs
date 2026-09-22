import { fixtureResultData } from "../scripts/result-context.mjs";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
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
  const out = await r.json();
  assert.equal(r.status, status, JSON.stringify(out));
  return out;
}
let p = await call(
  "projects",
  {
    name: "스토리 수정 버전 검사 " + Date.now(),
    description: "API 상태 연결 회귀 검사. 브라우저 실행 결과가 아님.",
    goal: "수정한 스토리에 과거 통합·검증 결과를 재사용하지 않는다.",
  },
  201,
);
const op = async (type, data = {}, status = 200) => {
  const result = await call(
    "projects/" + p.id,
    { type, version: p.version, ...fixtureResultData(p, type, data) },
    status,
  );
  if (status === 200) p = result;
  return result;
};
await op("requirement.save", {
  title: "수정 검증",
  description: "버전에 맞는 코드와 테스트만 완료 근거로 인정한다.",
  priority: "must",
  status: "accepted",
  decision: "기존 기록은 보존한다.",
  sourceIds: [],
});
await op("prd.generate");
await op("prd.approve");
await op("story.save", {
  title: "버전 검사",
  description: "처음 동작",
  acceptance: ["처음 결과"],
  tests: ["이전 테스트 기준"],
  dependencies: [],
  requirementIds: [],
  ownerId: "jimin",
  status: "ready",
});
const storyId = p.stories[0].id;
const result = {
  files: { "index.html": "<h1>합성 API fixture</h1>" },
  log: "상태 연결용 API fixture이며 실행 테스트 결과가 아님.",
  source: "tests/story-revision.mjs",
};
const evidence = {
  title: "API fixture · 브라우저 실행 아님",
  steps: "테스트 상태 연결",
  expected: "버전 일치 규칙 적용",
  actual: "API 계약 검증용 합성 통과 상태",
  status: "passed",
  coverage: [storyId + ":0"],
};
await op("run.start", { storyIds: [storyId] });
await op("run.submit", { id: p.runs.at(-1).id, ...result });
await op("release.create", {
  title: "첫 버전 fixture",
  runIds: [p.runs.at(-1).id],
});
const oldReleaseId = p.releases.at(-1).id;
await op("test.save", { ...evidence, releaseId: oldReleaseId });
await op("story.complete", { id: storyId });
assert.equal(p.stories[0].status, "done");
await op("story.save", {
  ...p.stories[0],
  description: "수정된 동작",
  tests: ["새 테스트 기준"],
  status: "ready",
});
assert.equal(p.stories[0].revision, 2);
await op("run.start", { storyIds: [storyId] });
assert.equal(p.runs.at(-1).storyRevision, 2);
await op("run.submit", { id: p.runs.at(-1).id, ...result });
await op("story.complete", { id: storyId }, 400);
await op("test.save", { ...evidence, releaseId: oldReleaseId }, 400);
assert.equal(p.testResults[0].coverage[0], storyId + ":0");
await op("release.create", {
  title: "수정 버전 fixture",
  runIds: [p.runs.at(-1).id],
});
await op("story.complete", { id: storyId }, 400);
await op("test.save", { ...evidence, releaseId: p.releases.at(-1).id });
await op("story.complete", { id: storyId });
assert.equal(p.stories[0].status, "done");
await op("release.activate", { id: oldReleaseId });
assert.equal(p.stories[0].status, "review");
await op("story.complete", { id: storyId }, 400);
await op("release.activate", { id: p.releases.at(-1).id });
await op("story.complete", { id: storyId });
await op("run.cancel", { id: p.runs.at(-1).id }, 400);
await op("project.delete");
writeFileSync(
  "evidence/story-revision-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      projectId: p.id,
      status: "passed",
      checks: [
        "수정 시 스토리 버전 증가",
        "작업에 스토리 버전 고정",
        "과거 결과로 새 버전 완료 차단",
        "과거 릴리스의 새 기준 연결 차단",
        "새 릴리스의 새 검증 요구",
        "이전 버전 롤백 시 완료 해제",
        "통합 작업 취소 차단",
      ],
      note: "API 상태 전이 fixture. 브라우저 앱 실행 결과가 아님.",
    },
    null,
    2,
  ),
);
console.log(
  "PASS story revisions isolate prior results, tests, and rollback evidence.",
);
