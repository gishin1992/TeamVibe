import { fixtureResultData } from "../scripts/result-context.mjs";
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
async function call(path, body, status = 200, cookie = jimin) {
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
let p = await call(
  "projects",
  {
    name: "검증 기록 이력 계약 검사 " + Date.now(),
    description: "실제 브라우저 결과가 아닌 상태 연결용 합성 검사",
    goal: "이전 기록을 보존하고 현재 결과만 완료에 사용한다.",
  },
  201,
);
p = await call("join", { code: p.inviteCode }, 200, seoyeon);
async function op(type, data = {}, status = 200, cookie = jimin) {
  const d = await call(
    "projects/" + p.id,
    { type, version: p.version, ...fixtureResultData(p, type, data) },
    status,
    cookie,
  );
  if (status === 200) p = d;
  else
    assert.deepEqual(
      await call("projects/" + p.id),
      p,
      "거절된 수정은 원본·이력 모두 불변",
    );
  return d;
}
await op("prd.save", {
  body: "# 합성 상태 검사\n실행 검증을 주장하지 않는 API 테스트 fixture.",
});
await op("prd.approve");
await op("prd.approve", {}, 200, seoyeon);
async function release(title) {
  await op("story.save", {
    title,
    description: "합성 상태 연결",
    acceptance: ["fixture"],
    tests: ["fixture 상태 연결만 검사"],
    dependencies: [],
    requirementIds: [],
    ownerId: "jimin",
    status: "ready",
  });
  const story = p.stories.at(-1);
  await op("run.start", { storyIds: [story.id] });
  const run = p.runs.at(-1);
  await op("run.submit", {
    id: run.id,
    files: { "index.html": "<h1>" + title + "</h1>" },
    log: "합성 상태 fixture, 브라우저 미실행",
    source: "API test-history.mjs",
  });
  await op("release.create", { runIds: [run.id], title });
  return { storyId: story.id, releaseId: p.releases.at(-1).id };
}
const first = await release("합성 릴리스 1");
await op("test.save", {
  releaseId: first.releaseId,
  title: "합성 통과 상태",
  steps: "API 연결 규칙용 fixture",
  expected: "done guard 확인",
  actual: "실제 테스트 아님, 합성 passed 값",
  status: "passed",
  coverage: [first.storyId + ":0"],
  kind: "manual",
});
const tid = p.testResults[0].id;
const test = () => p.testResults.find((t) => t.id === tid);
assert.equal(test().revision, 1);
await op("story.complete", { id: first.storyId });
assert.equal(p.stories[0].status, "done");
await op(
  "test.save",
  {
    ...test(),
    status: "failed",
    actual: "합성 failed 값으로 완료 무효화 검사",
  },
  200,
  seoyeon,
);
assert.equal(test().authorId, "jimin");
assert.equal(test().updatedBy, "seoyeon");
assert.equal(test().revision, 2);
assert.equal(test().history[0].status, "passed");
assert.equal(test().history[0].authorId, "jimin");
assert.equal(p.stories[0].status, "review");
await op("story.complete", { id: first.storyId }, 400);
const unchanged = structuredClone(test());
await op("test.save", { ...test() }, 200, jimin);
assert.deepEqual(
  test(),
  unchanged,
  "같은 내용은 수정자/버전/이력을 바꾸지 않음",
);
await op(
  "test.save",
  {
    ...test(),
    status: "blocked",
    actual: "합성 blocked 값으로 과거 통과 미사용 검사",
  },
  200,
  jimin,
);
assert.equal(test().history[1].status, "failed");
assert.equal(test().history[1].authorId, "seoyeon");
await op("story.complete", { id: first.storyId }, 400);
await op("test.save", {
  ...test(),
  status: "passed",
  actual: "합성 새 passed 값, 현재 기록 연결 검사",
});
assert.equal(test().history.length, 3);
assert.equal(p.stories[0].status, "review");
await op("story.complete", { id: first.storyId });
const second = await release("합성 릴리스 2");
await op("test.save", { ...test(), releaseId: second.releaseId }, 400);
assert.equal(test().releaseId, first.releaseId);
const beforeRecycle = structuredClone(test());
await op("item.delete", { collection: "testResults", id: tid });
await op("item.restore", { collection: "testResults", id: tid });
assert.deepEqual(test(), beforeRecycle);
const oldVersion = p.version;
await op("test.save", { ...test(), title: "합성 수정 제목" }, 200, seoyeon);
await call(
  "projects/" + p.id,
  { type: "test.save", version: oldVersion, ...test(), actual: "오래된 저장" },
  409,
);
assert.deepEqual(await call("projects/" + p.id), p);
const outcome = {
  at: new Date().toISOString(),
  projectId: p.id,
  revisions: test().revision,
  checks: [
    "original author and per-revision author preserved",
    "failed/blocked current status ignores historical passes",
    "identical save does not create history",
    "passing again still requires explicit completion",
    "release binding immutable",
    "soft-delete/restore and CAS preserve record history",
  ],
  note: "Synthetic API state fixture. No browser execution claimed.",
};
await op("project.delete");
writeFileSync(
  "evidence/test-history-api-result.json",
  JSON.stringify(outcome, null, 2),
);
console.log(
  "PASS test history: immutable previous results, original author, current-only completion, fixed release, no-op/recycle/CAS preservation.",
);
