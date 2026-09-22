import { fixtureResultData } from "../scripts/result-context.mjs";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { storyEditorStatus } from "../lib/teamvibe/form-conflicts.ts";
assert.equal(storyEditorStatus("done"), "keep");
assert.equal(storyEditorStatus("review"), "keep");
assert.equal(storyEditorStatus("ready"), "ready");
assert.equal(storyEditorStatus(), "backlog");
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
let p = await call(
  "projects",
  {
    name: "스토리 변경 없는 저장 검사 " + Date.now(),
    description: "합성 API 상태 검사, 업무 앱 실행 아님",
    goal: "실제 변경과 기존 기준 확인을 구별",
  },
  201,
);
async function op(type, data = {}, status = 200) {
  const d = await call(
    "projects/" + p.id,
    { type, version: p.version, ...fixtureResultData(p, type, data) },
    status,
  );
  if (status === 200) p = d;
  else assert.deepEqual(await call("projects/" + p.id), p);
}
for (const title of ["범위", "기준"])
  await op("requirement.save", {
    title,
    description: title + " 합성 요구",
    priority: "must",
    status: "accepted",
    decision: "합성 범위 합의",
    sourceIds: [],
  });
await op("prd.generate");
await op("prd.approve");
const common = {
  title: "합성 기준",
  description: "합성 이전 동작",
  acceptance: ["조건 A", "조건 B"],
  tests: ["이전 기준 A", "이전 기준 B"],
  dependencies: [],
  requirementIds: p.requirements.map((r) => r.id),
  ownerId: "jimin",
  status: "ready",
};
await op("story.save", { ...common, status: "keep" }, 400);
await op("story.save", common);
const sid = p.stories[0].id;
const story = () => p.stories.find((s) => s.id === sid);
const original = structuredClone(story()),
  prd = structuredClone(p.prd);
await op("story.save", { ...story() });
assert.deepEqual(story(), original);
await op("story.save", { ...story(), status: "keep" });
assert.deepEqual(story(), original);
await op("story.save", {
  ...story(),
  requirementIds: story().requirementIds.slice().reverse(),
});
assert.equal(story().revision, 1);
assert.deepEqual(p.prd, prd);
await op("run.start", { storyIds: [sid] });
await op("story.save", { ...story(), status: "keep" }, 400);
await op("run.submit", {
  id: p.runs[0].id,
  files: { "index.html": "<h1>API fixture only</h1>" },
  log: "브라우저 미실행, 상태 계약 검사",
  source: "tests/story-editing.mjs",
});
await op("release.create", { title: "API 합성 상태", runIds: [p.runs[0].id] });
await op("test.save", {
  releaseId: p.releases[0].id,
  title: "합성 통과 값",
  steps: "API 연결 검사",
  expected: "완료 상태 보존",
  actual: "실제 앱 실행 아님",
  status: "passed",
  coverage: [sid + ":0", sid + ":1"],
});
await op("story.complete", { id: sid });
const completed = structuredClone(story());
const oldRun = structuredClone(p.runs[0]),
  oldTest = structuredClone(p.testResults[0]);
await op("story.save", { ...story(), status: "keep" });
assert.deepEqual(story(), completed);
assert.equal(story().status, "done");
assert.deepEqual(p.runs[0], oldRun);
assert.deepEqual(p.testResults[0], oldTest);
const oldVersion = p.version;
await op("story.save", { ...story(), description: "새 범위", status: "keep" });
assert.equal(story().revision, 2);
assert.equal(story().status, "backlog");
await call(
  "projects/" + p.id,
  { type: "story.save", version: oldVersion, ...completed, status: "keep" },
  409,
);
assert.deepEqual(await call("projects/" + p.id), p);
await op("story.save", { ...story(), status: "done" }, 400);
await op("story.complete", { id: sid }, 400);
assert.deepEqual(p.runs[0], oldRun);
assert.deepEqual(p.testResults[0], oldTest);
assert(oldRun.prompt.includes("합성 이전 동작"));
const once = story().revision;
await op("story.save", { ...story(), status: "ready" });
assert.equal(
  story().revision,
  once + 1,
  "명시적인 준비 상태 변경은 새 작업 버전",
);
const ready = structuredClone(story());
await op("story.save", { ...story() });
assert.deepEqual(story(), ready);
await op("story.save", { ...story(), tests: story().tests.slice().reverse() });
assert.equal(
  story().revision,
  ready.revision + 1,
  "테스트 순서 변경은 기준 키 의미가 바뀌므로 새 버전",
);
await op("prd.save", { body: p.prd.body + "\n\n## 추가 검토\n합성 문서 변경" });
const previous = story().revision;
await op("story.save", { ...story(), status: "keep" });
assert.equal(story().revision, previous + 1);
assert.equal(story().prdRevision, p.prd.revision);
// Dependency and requirement ordering alone does not change the development version.
for (const title of ["선행 A", "선행 B"])
  await op("story.save", { ...common, title, status: "backlog" });
await op("story.save", {
  ...common,
  title: "후속",
  status: "backlog",
  dependencies: p.stories.slice(-2).map((s) => s.id),
});
const linked = structuredClone(p.stories.at(-1));
await op("story.save", {
  ...linked,
  dependencies: linked.dependencies.slice().reverse(),
  requirementIds: linked.requirementIds.slice().reverse(),
});
assert.deepEqual(p.stories.at(-1), {
  ...linked,
  dependencies: linked.dependencies.slice().reverse(),
  requirementIds: linked.requirementIds.slice().reverse(),
});
const result = {
  at: new Date().toISOString(),
  projectId: p.id,
  checks: [
    "unchanged ready and completed saves preserve version/state",
    "link display order preserves revision; test order does not",
    "real edit with keep returns completed work to backlog",
    "explicit preparation change and new PRD advance revision",
    "old run prompt and criterion snapshot immutable",
    "active work, invalid status/new keep and stale CAS rejected atomically",
  ],
  note: "Synthetic API states, not a browser execution of the generated business app.",
};
await op("project.delete");
writeFileSync(
  "evidence/story-editing-api-result.json",
  JSON.stringify(result, null, 2),
);
console.log(
  "PASS story editing: unchanged-save preservation, explicit restarts, meaningful version changes, prior evidence and CAS guards.",
);
