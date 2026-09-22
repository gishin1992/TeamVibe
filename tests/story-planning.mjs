import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { readStoryPlan, storyPlanPrompt } from "../lib/teamvibe/story-plan.ts";
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
let p = await call(
  "projects",
  {
    name: "스토리 설계 반입 검사 " + Date.now(),
    description: "API 계약 검증용 합성 프로젝트",
    goal: "합의된 PRD의 작은 작업을 일괄 검토해 병렬 개발한다.",
  },
  201,
);
async function op(type, data = {}, status = 200) {
  const result = await call(
    "projects/" + p.id,
    { type, version: p.version, ...data },
    status,
  );
  if (status === 200) p = result;
  else
    assert.deepEqual(
      await call("projects/" + p.id),
      p,
      "실패한 변경은 일부라도 저장되면 안 됨",
    );
  return result;
}
await op("requirement.save", {
  title: "비품 신청 관리",
  description: "합성 비품 신청을 생성·수정·취소하고 모바일에서 확인한다.",
  priority: "must",
  status: "accepted",
  decision: "로컬 합성 데이터로 검증",
  sourceIds: [],
});
await op("prd.generate");
function plan(project, planId) {
  const common = {
    acceptance: ["정상·오류 흐름을 검토할 수 있다."],
    tests: ["합성 입력으로 동작하고 예상 결과와 비교한다."],
    requirementIds: [project.requirements[0].id],
    ownerId: "",
    dependencies: [],
    existingDependencies: [],
  };
  return {
    planId,
    projectId: project.id,
    prdRevision: project.prd.revision,
    source: "tests/story-planning.mjs 합성 설계 · 실제 ChatGPT 응답 아님",
    stories: [
      {
        ...common,
        key: "app",
        title: "비품 신청 생성·수정·취소",
        description:
          "팀원으로서 신청을 작성하고 수정·취소한다. index.html과 app.js를 담당하며 .request-form과 .request-list를 제공한다.",
        acceptance: [
          "품목과 1 이상의 수량으로 신청한다.",
          "신청 수정과 취소가 화면에 반영된다.",
          "빈 품목과 0 수량은 이유를 표시한다.",
        ],
        tests: [
          "키보드 2개 신청 후 목록에서 확인한다.",
          "수량을 3개로 수정한 뒤 신청을 취소한다.",
          "빈 품목과 수량 0을 각각 입력해 저장 차단을 확인한다.",
        ],
      },
      {
        ...common,
        key: "style",
        title: "모바일 신청 화면",
        description:
          "모바일 팀원으로서 좁은 화면에서도 신청한다. styles.css만 담당하고 .request-form과 .request-list 클래스 계약을 사용한다.",
        acceptance: ["390px 화면에서 입력과 버튼이 잘리지 않는다."],
        tests: ["390px와 1440px 화면에서 입력과 목록을 확인한다."],
      },
      {
        ...common,
        key: "summary",
        title: "신청 수량 요약",
        description:
          "담당자로서 신청 변경 뒤 품목별 수량 합계를 확인한다. 완성된 신청 기능에 연결한다.",
        dependencies: ["app"],
        acceptance: ["신청 추가·수정·취소 후 합계가 갱신된다."],
        tests: [
          "키보드 2개와 3개 신청은 합계 5개이며 하나 취소하면 합계가 줄어든다.",
        ],
      },
    ],
  };
}
let input = plan(p, "api-plan-" + Date.now());
await op("story.import", { plan: input }, 400);
await op("prd.approve");
for (const change of [
  (x) => {
    x.projectId = "foreign-project";
  },
  (x) => {
    x.prdRevision = 999;
  },
  (x) => {
    x.stories[1].key = "app";
  },
  (x) => {
    x.stories[0].dependencies = ["summary"];
  },
  (x) => {
    x.stories[1].dependencies = ["missing"];
  },
  (x) => {
    x.stories[2].existingDependencies = ["missing"];
  },
  (x) => {
    x.stories[1].tests = [];
  },
  (x) => {
    x.stories[1].acceptance = [" "];
  },
  (x) => {
    x.stories[2].requirementIds = ["missing"];
  },
  (x) => {
    x.stories[2].ownerId = "outsider";
  },
  (x) => {
    x.stories = Array.from({ length: 21 }, (_, i) => ({
      ...x.stories[0],
      key: "key" + i,
    }));
  },
  (x) => {
    x.source = "";
  },
]) {
  const invalid = structuredClone(input);
  change(invalid);
  await op("story.import", { plan: invalid }, 400);
}
const staleVersion = p.version;
await op("prd.unapprove");
await op("story.import", { plan: input, version: staleVersion }, 409);
await op("prd.approve");
await op("story.import", { plan: input });
assert.equal(p.stories.length, 3);
assert.ok(p.stories.every((s) => s.status === "backlog" && s.revision === 1));
assert.equal(p.stories[2].dependencies[0], p.stories[0].id);
assert.equal(p.storyPlanImports[0].source, input.source);
assert.equal(p.stories[0].planningSource.planId, input.planId);
await op("story.import", { plan: input }, 400);
const dependent = p.stories[2];
await op("story.save", {
  ...dependent,
  title: "수정한 신청 수량 요약",
  status: "ready",
});
await op("run.start", { storyIds: [dependent.id] }, 400);
await op("item.delete", { collection: "stories", id: dependent.id });
assert.ok(p.stories[2].deletedAt);
await op("item.restore", { collection: "stories", id: dependent.id });
assert.equal(p.stories[2].title, "수정한 신청 수량 요약");
assert.equal(p.stories[2].planningSource.source, input.source);
for (const story of p.stories.slice(0, 2))
  await op("story.save", { ...story, status: "ready" });
await op("run.start", { storyIds: p.stories.slice(0, 2).map((s) => s.id) });
assert.equal(p.runs.length, 2);
assert.ok(p.runs.every((r) => r.status === "running"));
const extra = plan(p, "existing-dependency-" + Date.now());
extra.stories = [
  {
    ...extra.stories[0],
    key: "existing",
    existingDependencies: [p.stories[0].id],
  },
];
await op("story.import", { plan: extra });
assert.deepEqual(p.stories[3].dependencies, [p.stories[0].id]);
assert.ok(storyPlanPrompt(p, "test-plan").includes(p.prd.body));
assert.deepEqual(
  readStoryPlan("```json\n" + JSON.stringify(input) + "\n```"),
  input,
);
assert.throws(() => readStoryPlan("bad-json"));
assert.throws(() => readStoryPlan("x".repeat(200001)));
for (const run of p.runs) await op("run.cancel", { id: run.id });
await op("project.delete");
writeFileSync(
  "evidence/story-planning-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      projectId: p.id,
      status: "passed",
      checks: [
        "미합의 PRD 반입 차단",
        "잘못된 형식·참조·순환 12종 원자적 차단",
        "프로젝트 버전 충돌 409",
        "묶음 중복 차단",
        "의존 key를 영구 ID로 연결",
        "백로그 등록·출처 보존",
        "수정·휴지통·복원",
        "선행 미완료 작업 시작 차단",
        "독립 스토리 2개 작업 생성",
        "기존 스토리 의존성 연결",
        "코드 블록 JSON 읽기",
      ],
      note: "로컬 API 계약 검사. 실제 AI 실행이나 개발 코드 테스트를 뜻하지 않음.",
    },
    null,
    2,
  ),
);
console.log(
  "PASS story planning: atomic imports, PRD/version gates, references/DAG, provenance and lifecycle.",
);
if (process.env.TEAMVIBE_PLANNING_BROWSER_FIXTURE === "1") {
  p = await call(
    "projects",
    {
      name: "ChatGPT 스토리 설계 · 합성 시연",
      description:
        "실제 ChatGPT 응답이 아닌 합성 설계로 수동 반입 화면을 검증합니다.",
      goal: "비품 신청 앱을 작은 작업으로 분할하고 의존성과 병렬 작업 후보를 검토한다.",
    },
    201,
  );
  await op("requirement.save", {
    title: "비품 신청 관리",
    description: "신청 생성·수정·취소와 모바일 조회",
    status: "accepted",
    priority: "must",
    decision: "합성 데이터만 사용",
    sourceIds: [],
  });
  await op("prd.generate");
  await op("prd.approve");
  writeFileSync(
    "evidence/story-planning-browser-fixture.json",
    JSON.stringify(p, null, 2),
  );
  writeFileSync(
    "data/sample-story-plan.json",
    JSON.stringify(plan(p, "browser-plan-" + Date.now()), null, 2),
  );
  console.log("Browser fixture ready:", p.id);
}
