import { fixtureResultData } from "../scripts/result-context.mjs";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { prdApprovalBlockers } from "../lib/teamvibe/prd-review.ts";
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
    name: "PRD 검토 계약 " + Date.now(),
    description: "합성 API 상태 검사, 실제 기능 테스트 아님",
    goal: "실제 변경과 변경 없는 저장을 구분",
  },
  201,
);
p = await call("join", { code: p.inviteCode }, 200, seoyeon);
async function op(type, data = {}, status = 200, cookie = jimin) {
  const next = await call(
    "projects/" + p.id,
    { type, version: p.version, ...fixtureResultData(p, type, data) },
    status,
    cookie,
  );
  if (status === 200) p = next;
  else assert.deepEqual(await call("projects/" + p.id), p);
  return next;
}
assert.deepEqual(prdApprovalBlockers(p), ["PRD를 먼저 작성하세요."]);
await op("conversation.save", { title: "합성 검토 원문" });
const cid = p.conversations[0].id;
await op("message.save", {
  conversationId: cid,
  kind: "chatgpt",
  text: "첫 합성 관점",
  source: "실제 AI 아님",
});
await op("message.save", {
  conversationId: cid,
  kind: "chatgpt",
  text: "둘째 합성 관점",
  source: "실제 AI 아님",
});
await op("requirement.save", {
  title: "합의할 취소 규칙",
  description: "합성 검토 범위",
  priority: "must",
  status: "conflict",
  decision: "의견 차이 검토 필요",
  sourceIds: p.conversations[0].messages.map((m) => m.id),
});
assert.equal(prdApprovalBlockers(p).length, 3);
const denied = await op("prd.approve", {}, 400);
assert.equal(denied.error, prdApprovalBlockers(p).join("\n"));
assert.match(denied.error, /합의할 취소 규칙/);
await op("requirement.save", {
  ...p.requirements[0],
  status: "accepted",
  decision: "합성 기준에 합의",
});
await op("prd.generate");
await op("prd.approve");
await op("prd.approve", {}, 200, seoyeon);
assert.deepEqual(prdApprovalBlockers(p), []);
await op("story.save", {
  title: "합성 완료 상태",
  description: "실제 실행 아닌 완료 근거 보존 검사",
  acceptance: ["fixture"],
  tests: ["fixture"],
  dependencies: [],
  requirementIds: [p.requirements[0].id],
  ownerId: "jimin",
  status: "ready",
});
await op("run.start", { storyIds: [p.stories[0].id] });
await op("run.submit", {
  id: p.runs[0].id,
  files: { "index.html": "<h1>합성 fixture</h1>" },
  log: "브라우저 실행하지 않은 API fixture",
  source: "tests/prd-review.mjs",
});
await op("release.create", {
  title: "합성 상태 릴리스",
  runIds: [p.runs[0].id],
});
await op("test.save", {
  title: "합성 상태",
  releaseId: p.releases[0].id,
  steps: "API 상태 연결",
  expected: "합의 보존",
  actual: "실제 실행 아닌 API fixture",
  status: "passed",
  coverage: [p.stories[0].id + ":0"],
});
await op("story.complete", { id: p.stories[0].id });
const before = structuredClone(p);
await op("requirement.save", { ...p.requirements[0] });
assert.deepEqual(p.requirements, before.requirements);
await op("requirement.save", {
  ...p.requirements[0],
  sourceIds: p.requirements[0].sourceIds.slice().reverse(),
});
await op("prd.save", { body: p.prd.body });
assert.deepEqual(p.requirements, [
  {
    ...before.requirements[0],
    sourceIds: before.requirements[0].sourceIds.slice().reverse(),
  },
]);
assert.deepEqual(p.prd, before.prd);
assert.equal(p.requirementsVersion, before.requirementsVersion);
assert.equal(p.stories[0].status, "done");
await op("requirement.save", {
  ...p.requirements[0],
  decision: "팀이 실제로 변경한 합성 합의",
});
assert.equal(p.prd.approvals.length, 0);
assert.equal(p.stories[0].status, "review");
assert.equal(p.requirementsVersion, before.requirementsVersion + 1);
await op("prd.approve", {}, 400);
const oldBody = p.prd.body,
  oldRevision = p.prd.revision;
await op("prd.save", { body: oldBody });
assert.equal(
  p.prd.revision,
  oldRevision + 1,
  "같은 문구라도 반영 기준을 새로 확인하면 새 버전",
);
assert.equal(p.prd.sourceRevision, p.requirementsVersion);
await op("prd.approve");
await op("prd.approve", {}, 200, seoyeon);
const beforeMessage = p.requirementsVersion;
await op("message.save", {
  conversationId: cid,
  id: p.conversations[0].messages[0].id,
  text: "변경된 합성 관점",
  source: "합성 수정",
});
assert.equal(p.requirements[0].status, "proposed");
assert.equal(p.requirementsVersion, beforeMessage + 1);
assert.equal(p.prd.approvals.length, 0);
await op("requirement.save", { ...p.requirements[0], status: "accepted" });
assert.equal(
  p.requirements[0].sourceRevisions[p.conversations[0].messages[0].id],
  2,
);
assert.equal(p.requirementsVersion, beforeMessage + 2);
const result = {
  at: new Date().toISOString(),
  projectId: p.id,
  checks: [
    "shared blockers name unreviewed requirements",
    "empty/stale/conflict approval rejected atomically",
    "identical requirement/PRD and source reordering preserve approvals and completed story",
    "real decision change invalidates agreement and completion",
    "same body with changed requirement context creates a new PRD revision",
    "message edits and source-version reacceptance still require review",
  ],
  note: "Synthetic API fixtures; no actual browser execution of the generated app claimed.",
};
await op("project.delete");
writeFileSync(
  "evidence/prd-review-api-result.json",
  JSON.stringify(result, null, 2),
);
console.log(
  "PASS PRD review: named shared blockers, unchanged-save approval preservation, real changes and source revisions still invalidate.",
);
