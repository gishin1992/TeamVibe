import { fixtureResultData } from "../scripts/result-context.mjs";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  resolutionPrompt,
  readResolutionPlan,
} from "../lib/teamvibe/integration.ts";
const p = {
  id: "fixture",
  name: "합성 통합",
  version: 7,
  prd: { body: "두 팀의 안내 유지" },
  stories: [],
  releases: [{ id: "r1", status: "active", files: { "index.html": "base" } }],
};
const runs = [
  {
    id: "a",
    title: "팀 A",
    status: "submitted",
    baseReleaseId: "r1",
    files: { "index.html": "A" },
  },
  {
    id: "b",
    title: "팀 B",
    status: "submitted",
    baseReleaseId: "r1",
    files: { "index.html": "B" },
  },
];
const valid = {
  projectId: p.id,
  projectVersion: p.version,
  activeReleaseId: "r1",
  runIds: ["a", "b"],
  source: "합성 해결안",
  resolutions: {
    "index.html": {
      content: "A + B",
      reason: "두 안내를 유지하고 실제 표시를 확인한다.",
    },
  },
};
assert.deepEqual(readResolutionPlan(JSON.stringify(valid), p, runs), valid);
assert.deepEqual(
  readResolutionPlan("```json\n" + JSON.stringify(valid) + "\n```", p, runs),
  valid,
);
const text = resolutionPrompt(p, runs);
assert.ok(
  text.includes('"current": "base"') &&
    text.includes('"content": "A"') &&
    text.includes('"content": "B"') &&
    text.includes(p.prd.body),
);
const checks = [
  (x) => {
    x.projectId = "foreign";
  },
  (x) => {
    x.projectVersion = 6;
  },
  (x) => {
    x.activeReleaseId = "old";
  },
  (x) => {
    x.runIds = ["a"];
  },
  (x) => {
    x.runIds = ["a", "a"];
  },
  (x) => {
    x.runIds = ["a", "foreign"];
  },
  (x) => {
    x.source = " ";
  },
  (x) => {
    x.resolutions = {};
  },
  (x) => {
    x.resolutions["other.js"] = { content: "x", reason: "x" };
  },
  (x) => {
    x.resolutions["index.html"].content = null;
  },
  (x) => {
    x.resolutions["index.html"].reason = " ";
  },
  (x) => {
    x.resolutions["index.html"].content = "x".repeat(300001);
  },
];
for (const change of checks) {
  const invalid = structuredClone(valid);
  change(invalid);
  assert.throws(() => readResolutionPlan(JSON.stringify(invalid), p, runs));
}
assert.throws(() => readResolutionPlan("oops", p, runs));
assert.throws(() => readResolutionPlan("x".repeat(1200001), p, runs));
assert.throws(() =>
  readResolutionPlan(JSON.stringify(valid), p, [
    { ...runs[0], status: "cancelled" },
    runs[1],
  ]),
);
assert.throws(() => readResolutionPlan(JSON.stringify(valid), p, []));
writeFileSync(
  "evidence/resolution-transfer-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      status: "passed",
      checks: [
        "현재/시작/제출 코드와 PRD 요청 구성",
        "일반 JSON과 코드 블록 반입",
        "잘못된 프로젝트·버전·릴리스·작업·파일·출처·코드·근거 12종 거절",
        "비정상 JSON·초과 길이·취소 작업·빈 작업 거절",
      ],
      note: "순수 검증 로직 검사. ChatGPT 호출이나 UI 통합 결과가 아님.",
    },
    null,
    2,
  ),
);
console.log(
  "PASS resolution transfer: explicit context, envelope/version guards and complete file resolution validation.",
);

if (process.env.TEAMVIBE_RESOLUTION_BROWSER_FIXTURE === "1") {
  const root = (process.env.TEAMVIBE_URL || "http://localhost:5174") + "/api/";
  const login = await fetch(root + "session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: "jimin" }),
  });
  const headers = {
    Cookie: login.headers.get("set-cookie").split(";")[0],
    "Content-Type": "application/json",
  };
  async function call(path, body) {
    const r = await fetch(root + path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    assert.ok(r.ok, await r.clone().text());
    return r.json();
  }
  let project = await call("projects", {
    name: "ChatGPT 충돌 해결안 · 합성 반입",
    description:
      "ChatGPT를 호출하지 않고 합성 JSON으로 수동 해결안 반입을 검증한다.",
    goal: "두 팀의 안내를 유지한 해결안을 검토하고 통합한다.",
  });
  async function op(type, data = {}) {
    project = await call("projects/" + project.id, {
      type,
      version: project.version,
      ...fixtureResultData(project, type, data),
    });
  }
  await op("prd.save", {
    body: "# 합성 안내 앱\n신청 안내와 취소 안내를 함께 표시한다.",
  });
  await op("prd.approve");
  for (const title of ["신청 안내 표시", "취소 안내 표시"])
    await op("story.save", {
      title,
      description: title,
      acceptance: ["사용자가 안내 문장을 읽을 수 있다."],
      tests: ["실제 미리보기에서 안내 문장 표시 확인"],
      dependencies: [],
      requirementIds: [],
      ownerId: "jimin",
      status: "ready",
    });
  await op("run.start", { storyIds: project.stories.map((s) => s.id) });
  for (const run of project.runs)
    await op("run.submit", {
      id: run.id,
      files: { "index.html": `<h1>합성 안내</h1><p>${run.title}</p>` },
      log: "합성 HTML. 렌더 미검증.",
      source: "tests/resolution-transfer.mjs",
    });
  const response = {
    projectId: project.id,
    projectVersion: project.version,
    activeReleaseId: "",
    runIds: project.runs.map((r) => r.id),
    source: "TeamVibe 합성 해결안 · 실제 ChatGPT 응답 아님",
    resolutions: {
      "index.html": {
        content:
          '<!doctype html><html lang="ko"><meta charset="utf-8"><title>합성 안내 통합</title><body><h1>합성 안내</h1><p>신청 안내 표시</p><p>취소 안내 표시</p></body></html>',
        reason:
          "신청 안내와 취소 안내를 둘 다 유지했다. 두 문장이 표시되는지 브라우저에서 확인해야 한다. 아직 실행하지 않았다.",
      },
    },
  };
  writeFileSync(
    "evidence/resolution-transfer-browser-fixture.json",
    JSON.stringify(project, null, 2),
  );
  writeFileSync(
    "data/sample-resolution-plan.json",
    JSON.stringify(response, null, 2),
  );
  console.log("Browser fixture:", project.id);
}
