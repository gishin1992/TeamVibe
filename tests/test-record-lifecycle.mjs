import { fixtureResultData } from "../scripts/result-context.mjs";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  availableTestCoverage,
  recordedCoverageLabel,
  testCoverageOptions,
} from "../lib/teamvibe/test-coverage.ts";
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
    name: "검증 기록 생명주기 " + Date.now(),
    description: "합성 API 검사, 브라우저 테스트 아님",
    goal: "이전 기준 보존과 현재 검증 분리",
  },
  201,
);
async function op(type, data = {}, status = 200) {
  const next = await call(
    "projects/" + p.id,
    { type, version: p.version, ...fixtureResultData(p, type, data) },
    status,
  );
  if (status === 200) p = next;
  else
    assert.deepEqual(
      await call("projects/" + p.id),
      p,
      "거절된 변경은 원본과 이력 전체 불변",
    );
}
await op("prd.save", {
  body: "# 합성 상태 검사\n실행 결과가 아닌 버전 연결 검사",
});
await op("prd.approve");
await op("story.save", {
  title: "이전 안내",
  description: "버전 1",
  acceptance: ["이전 조건"],
  tests: ["이전 안내 문구", "추가 이전 기준"],
  dependencies: [],
  requirementIds: [],
  ownerId: "jimin",
  status: "ready",
});
const sid = p.stories[0].id;
async function integrate(title) {
  await op("run.start", { storyIds: [sid] });
  await op("run.submit", {
    id: p.runs.at(-1).id,
    files: { "index.html": "<h1>" + title + "</h1>" },
    log: "합성 API fixture. 브라우저 미실행",
    source: "tests/test-record-lifecycle.mjs",
  });
  await op("release.create", { runIds: [p.runs.at(-1).id], title });
  return p.releases.at(-1).id;
}
const oldRelease = await integrate("이전 릴리스");
const values = {
  title: "합성 검사",
  steps: "API 상태 연결",
  expected: "검증 연결 보존",
  actual: "실제 실행이 아닌 합성 상태",
  status: "passed",
  kind: "manual",
  coverage: [sid + ":0"],
};
await op("test.save", {
  ...values,
  releaseId: oldRelease,
  coverageSnapshots: [{ key: sid + ":0", criterion: "클라이언트 위조" }],
});
const tid = p.testResults[0].id;
const record = () => p.testResults.find((item) => item.id === tid);
const first = structuredClone(record());
assert.equal(
  first.coverageSnapshots[0].criterion,
  "이전 안내 문구",
  "스냅샷은 서버가 생성",
);
assert.equal(first.coverageSnapshots[0].storyRevision, 1);
await op("story.save", {
  ...p.stories[0],
  title: "새 안내",
  description: "버전 2",
  tests: ["새 안내 문구", "새 추가 기준"],
  status: "ready",
});
assert.equal(availableTestCoverage(p, oldRelease).length, 0);
await op("test.save", { ...record(), actual: "과거 기록의 설명 보완" });
assert.deepEqual(record().coverageSnapshots, first.coverageSnapshots);
assert.deepEqual(
  record().history[0].coverageSnapshots,
  first.coverageSnapshots,
);
assert.ok(
  testCoverageOptions(p, oldRelease, record())[0].label.includes(
    "이전 안내 v1 / 이전 안내 문구",
  ),
);
assert.ok(
  testCoverageOptions(p, oldRelease, record())[0].label.includes(
    "유지 또는 해제",
  ),
);
await op("test.save", { ...record(), coverage: [sid + ":0", sid + ":1"] }, 400);
await op("test.save", { ...values, releaseId: oldRelease }, 400);
const currentRelease = await integrate("새 릴리스");
await op("story.complete", { id: sid }, 400);
await op("item.delete", { collection: "releases", id: oldRelease });
await op("test.save", {
  ...record(),
  actual: "보관한 릴리스의 기존 기록 설명 보완",
});
assert.equal(record().releaseId, oldRelease);
assert.deepEqual(record().coverageSnapshots, first.coverageSnapshots);
await op("test.save", { ...values, coverage: [], releaseId: oldRelease }, 400);
await op("test.save", { ...record(), releaseId: currentRelease }, 400);
await op("test.save", {
  ...values,
  releaseId: currentRelease,
  coverage: [sid + ":0", sid + ":1"],
});
assert.equal(
  p.testResults.at(-1).coverageSnapshots[0].criterion,
  "새 안내 문구",
);
assert.equal(p.testResults.at(-1).coverageSnapshots[0].storyRevision, 2);
await op("story.complete", { id: sid });
await op("test.save", {
  ...record(),
  status: "failed",
  actual: "이전 릴리스에만 해당하는 합성 실패",
});
assert.equal(
  p.stories[0].status,
  "done",
  "과거 릴리스 실패가 현재 완료를 바꾸지 않음",
);
const beforeRecycle = structuredClone(record());
await op("item.delete", { collection: "testResults", id: tid });
await op("item.restore", { collection: "testResults", id: tid });
assert.deepEqual(record(), beforeRecycle);
await op("test.save", { ...record(), coverage: [] });
assert.deepEqual(record().coverageSnapshots, []);
assert.deepEqual(
  record().history.at(-1).coverageSnapshots,
  first.coverageSnapshots,
);
await op("test.save", { ...record(), coverage: [sid + ":0"] }, 400);
const legacy = { ...values, releaseId: oldRelease };
assert.equal(
  recordedCoverageLabel(legacy, sid + ":0"),
  "이전 연결 기준 · 당시 문구 미기록",
);
assert.ok(
  testCoverageOptions(p, oldRelease, legacy)[0].label.includes(
    "당시 문구 미기록",
  ),
);
assert.ok(
  testCoverageOptions(p, oldRelease, undefined, [sid + ":0"])[0].label.includes(
    "해제 필요",
  ),
);
const evidence = {
  at: new Date().toISOString(),
  projectId: p.id,
  checks: [
    "server-authored immutable criterion snapshots",
    "old version and archived release records editable with retained links",
    "new invalid links and release reassignment rejected atomically",
    "old records cannot complete new stories or invalidate current release",
    "removed links preserved in history and cannot be reattached without eligibility",
    "legacy text never fabricated; stale selections remain visible",
    "recycle preserves full history",
  ],
  note: "Synthetic API fixtures. No browser execution claimed.",
};
await op("project.delete");
writeFileSync(
  "evidence/test-record-lifecycle-api-result.json",
  JSON.stringify(evidence, null, 2),
);
console.log(
  "PASS test record lifecycle: archived release edits, frozen criterion snapshots, version isolation, legacy/stale choices and lossless recycle.",
);
