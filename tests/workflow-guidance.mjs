import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { nextProjectWork } from "../lib/teamvibe/workflow.ts";

const complete = {
  prd: { body: "합의한 합성 문서", revision: 1 },
  requirements: [{ id: "requirement", status: "accepted" }],
  stories: [
    { id: "screen", status: "done", revision: 1 },
    { id: "style", status: "done", revision: 1 },
  ],
  runs: [
    {
      id: "run-screen",
      storyId: "screen",
      status: "integrated",
      prdRevision: 1,
      storyRevision: 1,
    },
    {
      id: "run-style",
      storyId: "style",
      status: "integrated",
      prdRevision: 1,
      storyRevision: 1,
    },
  ],
  releases: [{ id: "release", status: "active" }],
  feedback: [],
};
assert.deepEqual(nextProjectWork(complete, true).destination, {
  tab: "test",
  section: "results",
});
assert.deepEqual(
  nextProjectWork(complete, false).destination,
  { tab: "prd", section: "document" },
  "기존 릴리스가 있어도 현재 PRD 합의가 먼저다",
);
const fixture = () => structuredClone(complete);
let p = fixture();
p.requirements[0].status = "conflict";
assert.deepEqual(nextProjectWork(p, false).destination, {
  tab: "prd",
  section: "requirements",
});
p = fixture();
p.feedback.push({ id: "open", status: "open" });
assert.deepEqual(nextProjectWork(p, true).destination, {
  tab: "test",
  section: "feedback",
});
p.feedback.at(-1).deletedAt = "archived";
assert.equal(nextProjectWork(p, true).destination.section, "results");
p = fixture();
p.stories[0].status = "review";
assert.equal(nextProjectWork(p, true).destination.section, "preview");
p = fixture();
p.runs[0].status = "running";
assert.equal(nextProjectWork(p, true).step, 3);
assert.equal(nextProjectWork(p, true).destination.section, "runs");
assert.match(nextProjectWork(p, true).body, /자동 실행하지는 않습니다/);
p.runs[0].status = "submitted";
assert.match(nextProjectWork(p, true).title, /통합/);
p.runs[0].prdRevision = 0;
assert.match(nextProjectWork(p, true).title, /이전 기준/);
p.runs[0].deletedAt = "archived";
assert.equal(nextProjectWork(p, true).destination.section, "results");
p = fixture();
p.releases = [];
p.stories[0].status = "ready";
p.runs.forEach((run) => {
  run.status = "cancelled";
});
assert.equal(
  nextProjectWork(p, true).step,
  2,
  "취소 이력만 있으면 병렬 개발 중이라고 안내하지 않는다",
);
assert.equal(nextProjectWork(p, true).destination.section, "board");
p.stories = [];
assert.equal(nextProjectWork(p, true).destination.section, "board");
p.prd.body = "";
p.requirements = [];
assert.equal(nextProjectWork(p, false).step, 0);
assert.equal(nextProjectWork(p, false).destination.tab, "conversation");
writeFileSync(
  "evidence/workflow-guidance-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      status: "passed",
      checks: [
        "기존 릴리스보다 현재 PRD 합의 검토 우선",
        "미합의 요구사항의 검토 화면 연결",
        "완료 후 검증 기록·열린 피드백 연결",
        "현재 통합 결과 검증, 제출 결과 통합, 수동 결과 대기 안내",
        "이전 기준의 대기 작업 재시작 안내",
        "보관·취소 작업을 진행 중으로 오인하지 않음",
        "초기 아이디어와 개발 준비 화면 구분",
      ],
      note: "합성 상태의 복제본을 사용한 안내 판단 검사. 권한·완료 판정은 기존 API 규칙이 수행함.",
    },
    null,
    2,
  ),
);
console.log(
  "PASS workflow guidance: current agreement, pending work, cancelled history, test review and follow-up priorities.",
);

if (process.env.TEAMVIBE_WORKFLOW_BROWSER_FIXTURE === "1") {
  const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
  const login = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: "jimin" }),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  async function call(path, body, status = 200) {
    const response = await fetch(base + "/api/" + path, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  }
  let project = await call(
    "projects",
    {
      name: "다음 작업 안내 · 단계 이동 시연",
      description: "단계별 이동과 수동 개발 상태 안내를 확인하는 합성 프로젝트",
      goal: "비개발자가 아이디어부터 테스트까지 다음 작업을 찾아 이동한다.",
    },
    201,
  );
  async function op(type, values = {}) {
    project = await call("projects/" + project.id, {
      type,
      version: project.version,
      ...values,
    });
  }
  await op("prd.save", {
    body: "# 합성 단계 이동\n안내 문구와 확인 버튼을 구현하고 상태에 맞는 다음 작업으로 이동한다.",
  });
  await op("prd.approve");
  for (const title of ["안내와 확인 버튼", "독립적인 화면 스타일"])
    await op("story.save", {
      title,
      description: title + "을 만든다.",
      acceptance: ["안내 화면을 직접 확인한다."],
      tests: ["표시와 버튼 상태 변화를 확인한다."],
      dependencies: [],
      requirementIds: [],
      ownerId: "jimin",
      status: "ready",
    });
  writeFileSync(
    "evidence/workflow-browser-project.json",
    JSON.stringify(project, null, 2),
  );
  console.log("Browser fixture:", project.id);
}
