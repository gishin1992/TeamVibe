import { fixtureResultData } from "../scripts/result-context.mjs";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  analyzeIntegration,
  readResolutionPlan,
  resolutionPrompt,
} from "../lib/teamvibe/integration.ts";
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
  const response = await fetch(base + "/api/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: cookie,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result;
}
let p;
async function op(type, data = {}, status = 200) {
  const result = await call(
    "projects/" + p.id,
    { type, version: p.version, ...fixtureResultData(p, type, data) },
    status,
  );
  if (status === 200) p = result;
  else
    assert.deepEqual(
      await call("projects/" + p.id),
      p,
      "실패한 요청은 전체 프로젝트를 보존한다",
    );
  return result;
}
async function story(title) {
  await op("story.save", {
    title,
    description: "합성 안내 파일 정리와 보존 검사",
    acceptance: ["선택한 코드만 새 릴리스에 적용된다."],
    tests: ["기존 화면과 클릭 동작을 직접 확인한다."],
    dependencies: [],
    requirementIds: [],
    ownerId: "jimin",
    status: "ready",
  });
  return p.stories.at(-1).id;
}
async function submit(id, files, deletedFiles = [], status = 200) {
  return op(
    "run.submit",
    {
      id,
      files,
      deletedFiles,
      log: "합성 API 검증 코드. 브라우저 실행 결과가 아니며 ChatGPT에 전달하지 않았음.",
      source: "tests/artifact-removal.mjs · 합성",
    },
    status,
  );
}
async function create(name) {
  p = await call(
    "projects",
    {
      name,
      description: "원본과 이전 릴리스를 보존하는 파일 제외 합성 시연",
      goal: "사용하지 않는 코드를 제외할 때 동료의 변경을 검토한다.",
    },
    201,
  );
  await op("prd.save", {
    body: "# 합성 파일 정리\n새 릴리스에서 오래된 안내만 제외하고 남은 버튼 동작을 유지한다.",
  });
  await op("prd.approve");
  const first = await story("초기 안내와 카운터");
  await op("run.start", { storyIds: [first] });
  await submit(p.runs.at(-1).id, {
    "index.html":
      '<h1>합성 파일 정리 시연</h1><p id="legacy">이전 안내</p><button id="count">확인 횟수: 0</button><script src="legacy.js"></script><script src="app.js"></script>',
    "legacy.js":
      'document.getElementById("legacy").textContent = "이전 안내 문구";',
    "app.js":
      'let count = 0; document.getElementById("count").onclick = () => { document.getElementById("count").textContent = "확인 횟수: " + (++count); };',
    "notes.txt": "처음 기록한 합성 메모",
  });
  await op("release.create", {
    title: "파일 정리 전",
    runIds: [p.runs.at(-1).id],
  });
  return structuredClone(p.releases.at(-1));
}
const initial = await create("산출물 파일 제외 검사 " + Date.now());
const deletionStory = await story("오래된 안내 제외"),
  editStory = await story("이전 안내 수정"),
  untouchedStory = await story("메모 갱신");
await op("run.start", { storyIds: [deletionStory, editStory, untouchedStory] });
const [removal, edit, untouched] = p.runs.slice(-3);
assert.ok(removal.prompt.includes('"deletedFiles":[]'));
for (const invalid of [
  ["../outside.js"],
  ["missing.js"],
  ["index.html"],
  ["legacy.js", "legacy.js"],
  [""],
  "legacy.js",
  null,
]) {
  await submit(removal.id, {}, invalid, 400);
}
await submit(removal.id, { "legacy.js": "new" }, ["legacy.js"], 400);
await submit(removal.id, {}, [], 400);
await submit(removal.id, {}, ["legacy.js"]);
assert.deepEqual(p.runs.find((r) => r.id === removal.id).deletedFiles, [
  "legacy.js",
]);
assert.equal(p.runs.find((r) => r.id === removal.id).status, "submitted");
const latest = latestFormValues(
  p,
  { type: "run.submit", id: removal.id },
  { payload: "" },
);
assert.deepEqual(JSON.parse(latest.payload).deletedFiles, ["legacy.js"]);
await submit(edit.id, { "legacy.js": "// teammate changed old file" });
await submit(untouched.id, {
  "legacy.js": initial.files["legacy.js"],
  "notes.txt": "새 합성 메모",
});
const selected = () =>
  p.runs.filter((r) => [removal.id, edit.id].includes(r.id));
const parallel = analyzeIntegration(p, selected());
assert.equal(parallel.conflicts[0].reason, "parallel");
assert.equal(
  parallel.conflicts[0].proposals.find((r) => r.runId === removal.id).content,
  null,
);
const plan = {
  projectId: p.id,
  projectVersion: p.version,
  activeReleaseId: initial.id,
  runIds: [removal.id, edit.id],
  source: "합성 파일 제외 해결안",
  resolutions: {
    "legacy.js": {
      content: null,
      reason:
        "동료 변경을 확인했고 오래된 안내의 제외를 선택했다. 남은 참조를 검증해야 한다.",
    },
  },
};
assert.deepEqual(readResolutionPlan(JSON.stringify(plan), p, selected()), plan);
assert.ok(resolutionPrompt(p, selected()).includes("content=null은 삭제 요청"));
await op(
  "release.create",
  { title: "검토 없는 삭제", runIds: plan.runIds },
  400,
);
await op(
  "release.create",
  {
    title: "이유 없는 삭제",
    runIds: plan.runIds,
    resolutions: { "legacy.js": { content: null, reason: "" } },
  },
  400,
);
await op("release.create", { title: "동료 수정 먼저 반영", runIds: [edit.id] });
assert.equal(
  analyzeIntegration(p, [p.runs.find((r) => r.id === removal.id)]).conflicts[0]
    .reason,
  "stale",
);
const changedRelease = structuredClone(p.releases.at(-1));
await op("release.create", {
  title: "검토한 안내 파일 제외",
  runIds: [removal.id],
  resolutions: plan.resolutions,
  resolutionSource: plan.source,
});
const removed = structuredClone(p.releases.at(-1));
assert.equal(removed.files["legacy.js"], undefined);
assert.deepEqual(removed.deletedFiles, ["legacy.js"]);
assert.equal(removed.resolutions[0].action, "delete");
assert.deepEqual(
  p.releases.find((r) => r.id === initial.id).files,
  initial.files,
);
assert.deepEqual(p.runs.find((r) => r.id === edit.id).files, {
  "legacy.js": "// teammate changed old file",
});
await op("release.create", {
  title: "미변경 파일 재제출",
  runIds: [untouched.id],
});
assert.equal(
  p.releases.at(-1).files["legacy.js"],
  undefined,
  "이전 원본을 그대로 제출해도 제외된 파일이 되살아나면 안 된다",
);
assert.equal(p.releases.at(-1).files["notes.txt"], "새 합성 메모");
await op("release.activate", { id: initial.id });
assert.equal(
  p.releases.find((r) => r.status === "active").files["legacy.js"],
  initial.files["legacy.js"],
);
await op("release.activate", { id: removed.id });
assert.equal(
  p.releases.find((r) => r.status === "active").files["legacy.js"],
  undefined,
);
const late = {
  ...edit,
  files: { "legacy.js": "changed again" },
  deletedFiles: [],
};
assert.equal(
  analyzeIntegration(p, [late]).conflicts[0].reason,
  "stale",
  "현재 제외된 파일을 늦게 온 수정으로 자동 복구하면 안 된다",
);
const currentDeletion = { ...removal, files: {}, deletedFiles: ["legacy.js"] };
assert.equal(
  analyzeIntegration(p, [
    currentDeletion,
    { ...currentDeletion, id: "other-removal" },
  ]).conflicts.length,
  0,
);
assert.equal(
  analyzeIntegration(p, [currentDeletion]).changedPaths.length,
  0,
  "이미 제외된 파일의 같은 요청은 멱등이다",
);
await op("release.activate", { id: changedRelease.id });
await op("item.delete", { collection: "releases", id: initial.id });
assert.equal(
  analyzeIntegration(p, [currentDeletion]).conflicts[0].proposals[0]
    .baselineKnown,
  true,
);
const cancelStory = await story("제외 요청 수정·취소");
await op("run.start", { storyIds: [cancelStory] });
const cancellation = p.runs.at(-1).id;
await submit(cancellation, {}, ["notes.txt"]);
await op("run.submit", {
  id: cancellation,
  files: { "notes.txt": "제외 요청 철회" },
  log: "수정한 합성 제출",
  source: "테스트",
});
assert.deepEqual(p.runs.find((r) => r.id === cancellation).deletedFiles, []);
await submit(cancellation, {}, ["notes.txt"]);
await op("run.cancel", { id: cancellation });
await op("item.delete", { collection: "runs", id: cancellation });
await op("item.restore", { collection: "runs", id: cancellation });
assert.deepEqual(p.runs.find((r) => r.id === cancellation).deletedFiles, [
  "notes.txt",
]);
assert.equal(
  p.releases.find((r) => r.status === "active").files["notes.txt"],
  initial.files["notes.txt"],
  "제출·취소는 릴리스를 변경하지 않는다",
);
await op("project.delete");
writeFileSync(
  "evidence/artifact-removal-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      projectId: p.id,
      status: "passed",
      checks: [
        "시작 코드의 파일만 명시적 제외 허용",
        "경로·중복·빈 목록·수정/제외 겹침·index 삭제 거절",
        "파일 제외만 포함한 결과 제출·편집용 JSON 보존",
        "동시 삭제/수정 및 늦은 삭제 충돌",
        "content:null 해결안과 이유 필수",
        "원본·수정 제출·이전 릴리스 보존",
        "삭제된 파일의 미변경 재제출로 복구하지 않음",
        "이전 릴리스 활성화로 코드 복원",
        "삭제된 파일에 대한 늦은 수정 검토 및 중복 제외 멱등",
        "보관한 릴리스를 시작 기준으로 사용",
        "제출 수정·취소·휴지통 복원에서 제외 요청 보존",
      ],
      note: "API 계약과 통합 비교 검사이며 브라우저 기능 실행 검증은 별도 기록.",
    },
    null,
    2,
  ),
);
console.log(
  "PASS artifact removal: explicit deletions, three-way conflicts, immutable history, rollback and submission lifecycle.",
);

if (process.env.TEAMVIBE_REMOVAL_BROWSER_FIXTURE === "1") {
  const original = await create("파일 제외와 팀 변경 · 통합 검토 시연");
  const a = await story("오래된 안내 제거"),
    b = await story("동료의 안내 문구 변경");
  await op("run.start", { storyIds: [a, b] });
  const [ra, rb] = p.runs.slice(-2);
  const payload = {
    files: {
      "index.html":
        '<h1>합성 파일 정리 시연</h1><p>오래된 안내를 제외했습니다.</p><button id="count">확인 횟수: 0</button><script src="app.js"></script>',
    },
    deletedFiles: ["legacy.js"],
    log: "합성 결과: 이전 안내와 해당 스크립트 참조를 제거. 브라우저 검증은 아직 하지 않음.",
    source: "로컬 합성 파일 제외 예제",
  };
  await submit(rb.id, {
    "legacy.js":
      'document.getElementById("legacy").textContent = "동료가 수정한 이전 안내";',
  });
  writeFileSync(
    "data/sample-artifact-removal.json",
    JSON.stringify(payload, null, 2),
  );
  writeFileSync(
    "evidence/artifact-removal-browser-project.json",
    JSON.stringify(p, null, 2),
  );
  writeFileSync(
    "evidence/artifact-removal-browser-fixture.json",
    JSON.stringify(
      {
        projectId: p.id,
        initialReleaseId: original.id,
        removalRunId: ra.id,
        editRunId: rb.id,
      },
      null,
      2,
    ),
  );
  console.log("Browser fixture:", p.id);
}
