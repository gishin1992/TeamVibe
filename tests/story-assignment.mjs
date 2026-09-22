import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fixtureResultData } from "../scripts/result-context.mjs";
import {
  latestFormValues,
  compareFields,
} from "../lib/teamvibe/form-conflicts.ts";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
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
    name: "담당 변경 API 검사 " + Date.now(),
    description: "합성 상태 계약 · 업무 앱 실행 아님",
    goal: "작업 내용과 담당 변경 분리",
  },
  201,
);
for (const c of [seoyeon, hyunwoo]) p = await c("join", { code: p.inviteCode });
async function op(type, data = {}, status = 200, client = jimin) {
  const result = await client(
    "projects/" + p.id,
    { type, version: p.version, ...fixtureResultData(p, type, data) },
    status,
  );
  if (status === 200) p = result;
  else
    assert.deepEqual(
      await jimin("projects/" + p.id),
      p,
      "Rejected mutations must be atomic",
    );
}
await op("prd.save", {
  body: "# 합성 업무\n담당자와 실제 개발 기준을 구별한다.",
});
for (const c of [jimin, seoyeon, hyunwoo]) await op("prd.approve", {}, 200, c);
const common = {
  description: "합성 업무",
  acceptance: ["기준 유지"],
  tests: ["합성 계약 검사"],
  dependencies: [],
  requirementIds: [],
  ownerId: "seoyeon",
  status: "ready",
};
for (const title of ["완료 작업", "진행 작업", "휴지통 작업"])
  await op("story.save", { ...common, title });
const [doneId, runningId, archivedId] = p.stories.map((s) => s.id);
const story = (id) => p.stories.find((s) => s.id === id);
assert.deepEqual(
  story(doneId).assignmentHistory.map((x) => [
    x.from,
    x.to,
    x.authorId,
    x.reason,
  ]),
  [["", "seoyeon", "jimin", "assigned"]],
);
await op("item.delete", { collection: "stories", id: archivedId });
const original = structuredClone(story(doneId));
await op("story.save", { ...story(doneId), ownerId: "hyunwoo" });
assert.deepEqual(story(doneId), {
  ...original,
  ownerId: "hyunwoo",
  assignmentHistory: story(doneId).assignmentHistory,
});
assert.equal(story(doneId).assignmentHistory.length, 2);
await op("run.start", { storyIds: [doneId, runningId] });
const running = structuredClone(p.runs.find((r) => r.storyId === runningId));
await op("story.assign", {
  id: runningId,
  ownerId: "jimin",
  status: "done",
  title: "ignored",
  assignmentHistory: [],
});
assert.equal(story(runningId).status, "developing");
assert.equal(story(runningId).revision, 1);
assert.equal(story(runningId).title, "진행 작업");
assert.deepEqual(
  p.runs.find((r) => r.id === running.id),
  running,
);
await op(
  "story.save",
  { ...story(runningId), status: "keep", description: "new scope" },
  400,
);
await op("story.assign", { id: runningId, ownerId: "missing" }, 400);
await op("story.assign", { id: runningId }, 400);
await op("story.assign", { id: "missing", ownerId: "jimin" }, 400);
await op("story.assign", { id: archivedId, ownerId: "jimin" }, 400);
await op("member.remove", { userId: "missing" }, 400);
const oldVersion = p.version;
const baseline = latestFormValues(
  p,
  { type: "story.assign", id: runningId },
  { ownerId: "" },
);
await op("story.assign", { id: runningId, ownerId: "seoyeon" }, 200, hyunwoo);
const latest = latestFormValues(
  p,
  { type: "story.assign", id: runningId },
  { ownerId: "" },
);
assert.equal(latest.ownerId, "seoyeon");
assert(compareFields(baseline, { ownerId: "hyunwoo" }, latest)[0].conflict);
await jimin(
  "projects/" + p.id,
  {
    type: "story.assign",
    id: runningId,
    ownerId: "hyunwoo",
    version: oldVersion,
  },
  409,
);
assert.deepEqual(await jimin("projects/" + p.id), p);
assert.equal(
  latestFormValues(
    p,
    { type: "story.assign", id: archivedId },
    { ownerId: "" },
  ),
  null,
);
const doneRun = p.runs.find((r) => r.storyId === doneId);
await op("run.submit", {
  id: doneRun.id,
  files: { "index.html": "<h1>API contract fixture</h1>" },
  log: "Not a browser business-app execution",
  source: "tests/story-assignment.mjs",
});
await op("story.assign", { id: doneId, ownerId: "seoyeon" });
assert.equal(story(doneId).status, "review");
await op("release.create", { title: "합성 계약 릴리스", runIds: [doneRun.id] });
await op("test.save", {
  releaseId: p.releases[0].id,
  title: "합성 기록",
  steps: "API contract only",
  expected: "Assignment preserves evidence",
  actual: "No browser execution",
  status: "passed",
  coverage: [doneId + ":0"],
});
await op("story.complete", { id: doneId });
const evidence = structuredClone({
  runs: p.runs,
  releases: p.releases,
  tests: p.testResults,
});
const complete = structuredClone(story(doneId));
await op("story.save", {
  ...story(doneId),
  status: "keep",
  ownerId: "hyunwoo",
});
assert.equal(story(doneId).status, "done");
assert.equal(story(doneId).revision, 1);
await op("story.assign", { id: doneId, ownerId: "seoyeon" });
const count = story(doneId).assignmentHistory.length;
await op("story.assign", { id: doneId, ownerId: "seoyeon" });
assert.equal(
  story(doneId).assignmentHistory.length,
  count,
  "No duplicate assignment history on no-op",
);
await op("member.remove", { userId: "seoyeon" });
for (const id of [doneId, runningId, archivedId]) {
  assert.equal(story(id).ownerId, "");
  assert.equal(story(id).assignmentHistory.at(-1).reason, "member-removed");
  assert.equal(story(id).revision, 1);
}
assert.equal(story(doneId).status, "done");
await op("story.assign", { id: runningId, ownerId: "jimin" }, 403, seoyeon);
await op("story.assign", { id: doneId, ownerId: "seoyeon" }, 400);
await op("story.assign", { id: doneId, ownerId: "hyunwoo" });
await op("story.assign", { id: runningId, ownerId: "hyunwoo" });
await op("item.restore", { collection: "stories", id: archivedId });
assert.equal(story(archivedId).ownerId, "");
assert.deepEqual(
  { runs: p.runs, releases: p.releases, tests: p.testResults },
  evidence,
);
assert.deepEqual(
  story(doneId).assignmentHistory.slice(0, complete.assignmentHistory.length),
  complete.assignmentHistory,
);
await op("member.leave", {}, 200, hyunwoo);
assert.equal(story(runningId).assignmentHistory.at(-1).authorId, "hyunwoo");
assert.equal(story(runningId).assignmentHistory.at(-1).reason, "member-left");
assert.equal(story(doneId).ownerId, "");
assert.equal(
  story(doneId).status,
  "review",
  "Existing leave policy clears PRD approvals; evidence files remain immutable",
);
assert.equal(story(doneId).revision, 1);
await op("prd.approve");
await op("story.complete", { id: doneId });
await op("story.save", {
  ...story(doneId),
  description: "새 내용",
  ownerId: "jimin",
  status: "keep",
});
assert.equal(story(doneId).revision, 2);
assert.equal(story(doneId).status, "backlog");
assert.equal(story(doneId).assignmentHistory.at(-1).to, "jimin");
assert.deepEqual(
  { runs: p.runs, releases: p.releases, tests: p.testResults },
  evidence,
);
await op("run.cancel", { id: running.id });
await op("project.delete");
writeFileSync(
  "evidence/story-assignment-api-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      projectId: p.id,
      checks: [
        "ready/review/done/running ownership changes preserve content revisions and existing artifacts",
        "initial, manual, unassign, removal, leave and archived assignment records retained",
        "invalid, unauthorized, missing, archived and stale CAS mutations rejected atomically",
        "form comparison identifies simultaneous assignee edits",
        "real content edits still invalidate old development",
        "leave PRD policy retained",
      ],
      note: "Synthetic API states only; browser verification is recorded separately.",
    },
    null,
    2,
  ),
);
console.log(
  "PASS story assignment: ownership lifecycle, immutable artifacts, access/CAS guards, content revision boundaries.",
);
