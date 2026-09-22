import { fixtureResultData } from "../scripts/result-context.mjs";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { analyzeIntegration } from "../lib/teamvibe/integration.ts";
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
      "실패한 통합은 프로젝트 전체를 변경하면 안 됨",
    );
  return result;
}
async function create(name) {
  p = await call(
    "projects",
    {
      name,
      description:
        "통합 기준 보존을 확인하는 합성 프로젝트. 실제 ChatGPT 응답 아님.",
      goal: "서로 다른 시점에 완성한 팀 작업을 기존 변경 보존 후 통합한다.",
    },
    201,
  );
  await op("prd.save", {
    body: "# 합성 통합 검증\n기존 신청 기능을 유지하며 검색과 합계를 추가하고 팀의 변경을 보존한다.",
  });
  await op("prd.approve");
}
async function story(title) {
  await op("story.save", {
    title,
    description: title + " · 합성 코드 검증",
    acceptance: ["기존 변경을 보존한다."],
    tests: ["통합 결과를 실제 화면에서 확인한다."],
    dependencies: [],
    requirementIds: [],
    ownerId: "jimin",
    status: "ready",
  });
  return p.stories.at(-1).id;
}
async function submit(runId, files) {
  await op("run.submit", {
    id: runId,
    files,
    log: "API 계약 검증용 합성 코드. 앱 동작을 실제로 검증한 기록이 아님.",
    source: "tests/integration-baseline.mjs",
  });
}
await create("시작 코드와 통합 충돌 검사 " + Date.now());
const initial = await story("초기 코드");
await op("run.start", { storyIds: [initial] });
assert.equal(p.runs.at(-1).baseReleaseId, "");
await submit(p.runs.at(-1).id, {
  "index.html": "<h1>합성 초기 앱</h1>",
  "app.js": "const version = 'base';",
  "styles.css": "body { color: black; }",
});
await op("release.create", {
  title: "기준 릴리스",
  runIds: [p.runs.at(-1).id],
});
const original = p.releases.at(-1);
const a = await story("먼저 도착한 검색"),
  b = await story("늦게 도착한 합계"),
  c = await story("기존 파일 포함 결과");
await op("run.start", { storyIds: [a, b, c] });
const [ra, rb, rc] = p.runs.slice(-3);
assert.ok(
  [ra, rb, rc].every(
    (r) =>
      r.baseReleaseId === original.id &&
      r.prompt.includes("const version = 'base';") &&
      r.prompt.includes(original.id),
  ),
);
await submit(ra.id, { "app.js": "const version = 'search';" });
await submit(rb.id, { "app.js": "const version = 'totals';" });
await submit(rc.id, {
  "app.js": original.files["app.js"],
  "styles.css": "body { color: navy; }",
});
assert.equal(
  analyzeIntegration(
    p,
    p.runs.filter((r) => [ra.id, rb.id].includes(r.id)),
  ).conflicts[0].reason,
  "parallel",
);
await op("release.create", { title: "검색 추가", runIds: [ra.id] });
await op("release.create", { title: "스타일 추가", runIds: [rc.id] });
assert.equal(
  p.releases.at(-1).files["app.js"],
  "const version = 'search';",
  "반환한 미변경 기준 파일이 다른 팀의 수정을 되돌리면 안 됨",
);
assert.equal(p.releases.at(-1).files["styles.css"], "body { color: navy; }");
assert.equal(
  analyzeIntegration(p, [p.runs.find((r) => r.id === rb.id)]).conflicts[0]
    .reason,
  "stale",
);
const releaseBefore = p.releases.at(-1);
await op("release.create", { title: "충돌", runIds: [rb.id] }, 400);
await op(
  "release.create",
  {
    title: "근거 누락",
    runIds: [rb.id],
    resolutions: { "app.js": { content: "merged", reason: "" } },
  },
  400,
);
await op(
  "release.create",
  {
    title: "임의 파일 주입",
    runIds: [rb.id],
    resolutions: { "evil.js": { content: "x", reason: "x" } },
  },
  400,
);
const merged = "const version = 'search-and-totals';";
const oldVersion = p.version;
await op("conversation.save", { title: "동시 변경" });
await op(
  "release.create",
  {
    version: oldVersion,
    title: "오래된 검토",
    runIds: [rb.id],
    resolutions: { "app.js": { content: merged, reason: "양쪽 변경 유지" } },
  },
  409,
);
await op("release.create", {
  title: "검색과 합계 통합",
  resolutionSource: "합성 수동 해결안 출처",
  runIds: [rb.id],
  resolutions: {
    "app.js": {
      content: merged,
      reason: "검색과 합계의 변경을 합쳤으며 실제 동작은 아직 미검증",
    },
  },
});
assert.equal(p.releases.at(-1).files["app.js"], merged);
assert.equal(p.releases.at(-1).baseReleaseId, releaseBefore.id);
assert.equal(p.releases.at(-1).resolutions[0].actorId, "jimin");
assert.equal(p.releases.at(-1).resolutionSource, "합성 수동 해결안 출처");
assert.equal(
  p.runs.find((r) => r.id === rb.id).files["app.js"],
  "const version = 'totals';",
  "원 제출 결과를 보존한다",
);
assert.equal(p.releases[0].files["app.js"], "const version = 'base';");
await op("item.delete", { collection: "releases", id: original.id });
const archivedBase = analyzeIntegration(p, [
  { ...rb, files: { "app.js": "const version = 'next';" } },
]);
assert.equal(archivedBase.conflicts[0].proposals[0].baselineKnown, true);
assert.equal(
  archivedBase.conflicts[0].proposals[0].baseline,
  "const version = 'base';",
);
const legacy = {
  ...rb,
  baseReleaseId: undefined,
  files: { "app.js": "legacy" },
};
assert.equal(analyzeIntegration(p, [legacy]).conflicts[0].reason, "unknown");
assert.equal(
  analyzeIntegration(p, [{ ...legacy, files: { "app.js": merged } }]).conflicts
    .length,
  0,
);
await op("project.delete");
writeFileSync(
  "evidence/integration-baseline-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      projectId: p.id,
      status: "passed",
      checks: [
        "작업 시작 릴리스와 코드 프롬프트 고정",
        "동시 제출의 서로 다른 파일 내용 충돌",
        "미변경 기준 파일 재제출 시 최신 변경 보존",
        "늦게 도착한 결과의 기존 파일 덮어쓰기 차단",
        "해결 근거 없는 통합·무관 파일 주입 차단",
        "동시 저장 후 오래된 검토 409",
        "명시적 해결 및 현재 릴리스 연결 보존",
        "이전 릴리스와 제출 원본 보존",
        "휴지통 릴리스를 시작 기준으로 조회",
        "기록 없는 예전 작업의 직접 비교 요구",
      ],
      note: "API 계약과 순수 비교 로직 검사. 합성 코드의 기능 실행 검증 아님.",
    },
    null,
    2,
  ),
);
console.log(
  "PASS integration baselines: source context, three-way file preservation, conflict resolution and audit.",
);
if (process.env.TEAMVIBE_INTEGRATION_BROWSER_FIXTURE === "1") {
  await create("병렬 결과 통합 · 충돌 해결 시연");
  const start = await story("초기 안내 화면");
  await op("run.start", { storyIds: [start] });
  await submit(p.runs.at(-1).id, {
    "index.html": "<h1>합성 비품 앱</h1><p>초기 안내</p>",
  });
  await op("release.create", {
    title: "기준 화면",
    runIds: [p.runs.at(-1).id],
  });
  const left = await story("신청 검색 안내"),
    right = await story("품목 합계 안내");
  await op("run.start", { storyIds: [left, right] });
  const [leftRun, rightRun] = p.runs.slice(-2);
  await submit(leftRun.id, {
    "index.html":
      "<h1>합성 비품 앱</h1><p>신청 검색 안내가 추가되었습니다.</p>",
  });
  await submit(rightRun.id, {
    "index.html":
      "<h1>합성 비품 앱</h1><p>품목 합계 안내가 추가되었습니다.</p>",
  });
  await op("release.create", {
    title: "검색 안내 먼저 반영",
    runIds: [leftRun.id],
  });
  writeFileSync(
    "evidence/integration-browser-fixture.json",
    JSON.stringify(p, null, 2),
  );
  console.log("Browser fixture:", p.id);
}
