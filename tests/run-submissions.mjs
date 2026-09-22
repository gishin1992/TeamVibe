import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  saveRunSubmission,
  runResultValues,
} from "../lib/teamvibe/run-submissions.ts";
import { fixtureResultData } from "../scripts/result-context.mjs";
const legacy = {
  files: { "old.js": "old" },
  deletedFiles: ["a.js", "b.js"],
  log: "old log",
  source: "old source",
};
const next = {
  files: { "new.js": "new" },
  deletedFiles: [],
  log: "new log",
  source: "new source",
};
saveRunSubmission(legacy, next, "seoyeon", "2026-09-21T00:00:00Z");
assert.equal(legacy.submissionRevision, 2);
assert.equal(legacy.submissionHistory[0].revision, 1);
assert.equal(legacy.submissionHistory[0].authorId, undefined);
assert.equal(legacy.submissionHistory[0].at, undefined);
next.files["new.js"] = "changed later";
next.deletedFiles.push("new.js");
assert.equal(legacy.files["new.js"], "new");
assert.deepEqual(legacy.deletedFiles, []);
assert.deepEqual(legacy.submissionHistory[0].files, { "old.js": "old" });
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
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
const a = await client("jimin"),
  b = await client("seoyeon");
let p = await a(
  "projects",
  {
    name: "개발 결과 변경 이력 검사 " + Date.now(),
    description: "합성 API 상태 검사",
    goal: "반입 수정 전 코드·로그·출처를 보존",
  },
  201,
);
p = await b("join", { code: p.inviteCode });
async function op(type, data = {}, who = a, expected = 200) {
  const result = await who(
    "projects/" + p.id,
    { type, version: p.version, ...fixtureResultData(p, type, data) },
    expected,
  );
  if (expected === 200) p = result;
  else assert.deepEqual(await a("projects/" + p.id), p);
  return result;
}
await op("prd.save", { body: "# 합성 코드 결과 이력" });
await op("prd.approve");
await op("prd.approve", {}, b);
const storyValues = {
  title: "합성 안내",
  description: "결과 이력 검토",
  acceptance: ["합성 fixture"],
  tests: ["API 상태 검사"],
  dependencies: [],
  requirementIds: [],
  ownerId: "jimin",
  status: "ready",
};
await op("story.save", storyValues);
const sid = p.stories[0].id;
await op("run.start", { storyIds: [sid] });
await op("run.submit", {
  id: p.runs[0].id,
  files: {
    "index.html": '<script src="app.js"></script>',
    "app.js": "// original",
    "a.js": "// a",
    "b.js": "// b",
  },
  log: "초기 합성, 미실행",
  source: "API fixture",
});
await op("release.create", { title: "시작 코드", runIds: [p.runs[0].id] });
await op("story.save", { ...storyValues, id: sid });
await op("run.start", { storyIds: [sid] });
const rid = p.runs.at(-1).id,
  run = () => p.runs.find((r) => r.id === rid);
const prompt = run().prompt;
const v1 = {
  files: { "app.js": "// first submission", "style.css": "body{}" },
  deletedFiles: ["a.js", "b.js"],
  log: "첫 합성 반입, 브라우저 미실행",
  source: "첫 합성 자료",
};
await op("run.submit", {
  id: rid,
  ...v1,
  submittedBy: "forged",
  submissionRevision: 99,
  submissionHistory: [],
});
assert.equal(run().submittedBy, "jimin");
assert.equal(run().submissionRevision, 1);
const first = structuredClone(run());
await op(
  "run.submit",
  {
    id: rid,
    ...v1,
    files: { "style.css": "body{}", "app.js": "// first submission" },
    deletedFiles: ["b.js", "a.js"],
  },
  b,
);
assert.deepEqual(
  run(),
  first,
  "같은 결과와 파일 순서 변경은 이력/반입자를 바꾸지 않는다.",
);
const v2 = {
  files: { "app.js": "// corrected submission" },
  deletedFiles: [],
  log: "수정한 합성 반입, 미실행",
  source: "보완 자료",
};
await op("run.submit", { id: rid, ...v2 }, b);
assert.equal(run().submissionRevision, 2);
assert.equal(run().submittedBy, "seoyeon");
assert.deepEqual(
  runResultValues(run().submissionHistory[0]),
  runResultValues(first),
);
assert.equal(run().submissionHistory[0].authorId, "jimin");
assert.equal(run().submissionHistory[0].at, first.submittedAt);
assert.equal(run().prompt, prompt);
await op("run.submit", { id: rid, ...v1, log: "" }, a, 400);
await op("run.submit", { id: rid, ...v1, context: {} }, a, 400);
const oldVersion = p.version;
await op("conversation.save", { title: "독립 변경" });
await a(
  "projects/" + p.id,
  {
    type: "run.submit",
    version: oldVersion,
    ...fixtureResultData(p, "run.submit", { id: rid, ...v1 }),
  },
  409,
);
assert.deepEqual(await a("projects/" + p.id), p);
const history = structuredClone(run().submissionHistory);
await op("run.submit", {
  id: rid,
  ...runResultValues(run().submissionHistory[0]),
});
assert.equal(run().submissionRevision, 3);
assert.deepEqual(runResultValues(run()), v1);
assert.deepEqual(run().submissionHistory.slice(0, -1), history);
assert.equal(run().submissionHistory.at(-1).authorId, "seoyeon");
const beforeIntegration = structuredClone(run());
await op("release.create", { title: "선택한 결과 통합", runIds: [rid] });
assert.deepEqual(run(), { ...beforeIntegration, status: "integrated" });
assert.equal(p.releases.at(-1).files["app.js"], v1.files["app.js"]);
assert(!("a.js" in p.releases.at(-1).files));
await op("run.submit", { id: rid, ...v2 }, a, 400);
await op("story.save", { ...storyValues, title: "취소 이력 보존" });
await op("run.start", { storyIds: [p.stories.at(-1).id] });
const cancelledId = p.runs.at(-1).id;
await op("run.submit", { id: cancelledId, ...v2 });
await op("run.submit", { id: cancelledId, ...v2, log: "취소 전 추가 설명" }, b);
await op("run.cancel", { id: cancelledId });
const cancelled = structuredClone(p.runs.at(-1));
await op("item.delete", { collection: "runs", id: cancelledId });
await op("item.restore", { collection: "runs", id: cancelledId });
assert.deepEqual(p.runs.at(-1), cancelled);
await op("run.submit", { id: cancelledId, ...v2 }, a, 400);
const result = {
  at: new Date().toISOString(),
  projectId: p.id,
  checks: [
    "server-owned importer metadata",
    "unchanged and reordered results retain identity",
    "old code, deletions, log, source and importer preserved",
    "reimporting prior result creates a new version",
    "integration uses current result and keeps history",
    "integrated and cancelled edits rejected",
    "cancel/recycle retains all result versions",
    "failed validation and CAS are atomic",
    "legacy unknown importer/time retained",
    "nested arrays/maps copied independently",
  ],
  note: "Synthetic API/helper checks only; no generated business app execution.",
};
await op("project.delete");
writeFileSync(
  "evidence/run-submissions-api-result.json",
  JSON.stringify(result, null, 2),
);
console.log(
  "PASS run submissions: immutable prior artifacts/logs, importer provenance, unchanged results, reimport, integration, cancellation, CAS and legacy.",
);
