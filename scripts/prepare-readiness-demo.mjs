import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
const login = await fetch(base + "/api/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: "jimin" }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";")[0];
async function call(path, body, status = 200) {
  const result = await fetch(base + "/api/" + path, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const value = await result.json();
  assert.equal(result.status, status, JSON.stringify(value));
  return value;
}
let p = await call(
  "projects",
  {
    name: "개발 시작 조건 · 선행 작업 시연",
    description:
      "준비 상태와 실제 선행 검증에 따라 선택 가능 여부를 안내하는 합성 시연",
    goal: "막힌 이유를 미리 확인하고 독립 작업을 시작한다.",
  },
  201,
);
async function op(type, data = {}) {
  p = await call("projects/" + p.id, { type, version: p.version, ...data });
}
await op("prd.save", {
  body: "# 선행 작업 합성 시연\n선행 제목 화면을 확인하고 후속 작업을 시작한다. 다른 독립 작업은 먼저 진행할 수 있다.",
});
await op("prd.approve");
async function story(title, dependencies = []) {
  await op("story.save", {
    title,
    description: title + "을 구현한다.",
    acceptance: ["선행 화면 확인 제목을 볼 수 있다."],
    tests: ["미리보기에서 선행 화면 확인 제목이 표시되는지 확인한다."],
    dependencies,
    requirementIds: [],
    ownerId: "jimin",
    status: "ready",
  });
  return p.stories.at(-1).id;
}
const root = await story("선행 제목 화면");
const followup = await story("선행 완료 후 상세 화면", [root]);
const independent = await story("별도 안내 작업");
writeFileSync(
  "evidence/readiness-browser-project.json",
  JSON.stringify(p, null, 2),
);
writeFileSync(
  "evidence/readiness-browser-fixture.json",
  JSON.stringify(
    {
      projectId: p.id,
      rootStoryId: root,
      followupStoryId: followup,
      independentStoryId: independent,
    },
    null,
    2,
  ),
);
console.log("Prepared synthetic readiness fixture:", p.id);
