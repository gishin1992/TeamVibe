import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
async function client(userId) {
  const response = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie").split(";")[0];
  return async (path, data, expected = 200) => {
    const response = await fetch(base + "/api/" + path, {
      method: data ? "POST" : "GET",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    return result;
  };
}
const jimin = await client("jimin"),
  seoyeon = await client("seoyeon");
let project = await jimin(
  "projects",
  {
    name: "편집 중인 문서 · 닫기 전 입력 보존",
    description:
      "창 닫기, 계속 작성, 입력 버리기와 동시 편집을 확인하는 합성 프로젝트",
    goal: "팀원이 작성하던 문서를 실수로 닫아 잃지 않게 한다.",
  },
  201,
);
project = await seoyeon("join", { code: project.inviteCode });
project = await jimin("projects/" + project.id, {
  type: "prd.save",
  version: project.version,
  body: "# 비품 신청 검토\n\n직원은 품목과 수량을 입력한다.\n팀은 신청 내역을 함께 확인한다.\n합성 데이터만 사용한다.",
});
writeFileSync(
  "evidence/unsaved-form-browser-before.json",
  JSON.stringify(project, null, 2),
);
console.log(
  JSON.stringify({ projectId: project.id, projectName: project.name }, null, 2),
);
