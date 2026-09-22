import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  readRunResult,
  runResultContext,
  validateRunResultContext,
} from "../lib/teamvibe/run-result.ts";
import { latestFormValues } from "../lib/teamvibe/form-conflicts.ts";
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
    name: "병렬 결과 문맥 검사 " + Date.now(),
    description: "합성 API 반입 경계 검사",
    goal: "다른 작업의 결과를 선택한 작업에 연결하지 않는다.",
  },
  201,
);
async function op(type, data = {}, status = 200) {
  const next = await call(
    "projects/" + p.id,
    { type, version: p.version, ...data },
    status,
  );
  if (status === 200) p = next;
  else assert.deepEqual(await call("projects/" + p.id), p);
  return next;
}
await op("prd.save", {
  body: "# 합성 결과 반입\n안내와 스타일을 독립 작업으로 구분한다.",
});
await op("prd.approve");
for (const title of ["안내", "스타일"])
  await op("story.save", {
    title,
    description: title + " 합성 작업",
    acceptance: ["fixture"],
    tests: ["fixture"],
    dependencies: [],
    requirementIds: [],
    ownerId: "jimin",
    status: "ready",
  });
await op("run.start", { storyIds: p.stories.map((s) => s.id) });
const [a, b] = p.runs;
const contextA = runResultContext(p.id, a),
  contextB = runResultContext(p.id, b);
assert(a.resultContextRequired && b.resultContextRequired);
assert(a.prompt.includes('"context":' + JSON.stringify(contextA)));
assert(b.prompt.includes('"context":' + JSON.stringify(contextB)));
assert.notEqual(contextA.runId, contextB.runId);
assert.equal(contextA.baseReleaseId, "");
const payload = {
  context: contextA,
  files: { "index.html": "<h1>합성 안내</h1>" },
  deletedFiles: [],
  log: "API 계약 검사, 브라우저 미실행",
  source: "tests/run-result-context.mjs",
};
for (const value of [null, [], 5, "text"])
  assert.throws(() => readRunResult(value, p.id, a), /JSON 객체/);
for (const key of ["id", "type", "version", "targetId", "__proto__"])
  assert.throws(
    () =>
      readRunResult(
        JSON.parse(
          JSON.stringify(payload).slice(0, -1) + ',"' + key + '":"foreign"}',
        ),
        p.id,
        a,
      ),
    /허용되지 않은 필드/,
  );
assert.deepEqual(readRunResult(payload, p.id, a), payload);
const noContext = { ...payload };
delete noContext.context;
await op("run.submit", { id: a.id, ...noContext }, 400);
for (const [key, value] of [
  ["projectId", "foreign"],
  ["runId", b.id],
  ["storyId", b.storyId],
  ["storyRevision", 2],
  ["storyRevision", "1"],
  ["prdRevision", 2],
  ["baseReleaseId", null],
])
  await op(
    "run.submit",
    { id: a.id, ...payload, context: { ...contextA, [key]: value } },
    400,
  );
await op(
  "run.submit",
  { id: a.id, ...payload, context: { ...contextA, constructor: "foreign" } },
  400,
);
await op("run.submit", { id: b.id, ...payload }, 400);
// A parallel project update does not change the run's captured identity.
await op("conversation.save", { title: "별도 팀 대화" });
await op("run.submit", { id: a.id, ...payload });
assert.equal(p.runs[0].status, "submitted");
assert.equal(p.runs[1].status, "running");
assert.deepEqual(
  JSON.parse(
    latestFormValues(p, { type: "run.submit", id: a.id }, { payload: "" })
      .payload,
  ).context,
  contextA,
);
const submitted = structuredClone(p.runs[0]);
await op("run.submit", { id: a.id, ...payload, context: contextB }, 400);
assert.deepEqual(p.runs[0], submitted);
const oldVersion = p.version;
await op("run.submit", { id: a.id, ...payload, log: "수정한 실제 합성 로그" });
await call(
  "projects/" + p.id,
  { type: "run.submit", version: oldVersion, id: a.id, ...payload },
  409,
);
assert.deepEqual(await call("projects/" + p.id), p);
await op("run.cancel", { id: a.id });
await op("run.start", { storyIds: [a.storyId] });
const retry = p.runs.at(-1);
assert.notEqual(retry.id, a.id);
await op("run.submit", { id: retry.id, ...payload }, 400);
const legacy = { ...a };
delete legacy.resultContextRequired;
assert.doesNotThrow(() => validateRunResultContext(undefined, p.id, legacy));
assert.deepEqual(readRunResult(noContext, p.id, legacy), noContext);
assert.throws(
  () => readRunResult({ ...payload, context: contextB }, p.id, legacy),
  /다릅니다/,
);
const unknownBaseline = { ...legacy };
delete unknownBaseline.baseReleaseId;
assert.equal(runResultContext(p.id, unknownBaseline).baseReleaseId, null);
const result = {
  at: new Date().toISOString(),
  projectId: p.id,
  checks: [
    "new requests carry immutable project/run/story/revision/baseline context",
    "missing or mismatched context rejected atomically by API",
    "result parser rejects command and target overrides",
    "parallel unrelated changes preserve captured run context",
    "resubmission and stale CAS preserve previous result on failure",
    "cancel/restart rejects prior run result even for same story",
    "legacy missing context allowed, supplied mismatch still rejected",
    "concurrent editor reconstruction retains the same context",
  ],
  note: "Synthetic API/helper checks, no external ChatGPT call or generated app execution.",
};
await op("project.delete");
writeFileSync(
  "evidence/run-result-context-api-result.json",
  JSON.stringify(result, null, 2),
);
console.log(
  "PASS result context: selected-target protection, immutable request identity, missing/mismatch rejection, legacy compatibility and CAS.",
);
