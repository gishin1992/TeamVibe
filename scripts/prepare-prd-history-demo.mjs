import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
async function client(userId) {
  const r = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie").split(";")[0];
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
const jimin = await client("jimin"),
  seoyeon = await client("seoyeon");
let p = await jimin(
  "projects",
  {
    name: "공동 PRD · 작성과 복원 이력",
    description: "두 팀원이 작성한 문서와 이전 본문 복원을 구분하는 합성 예제",
    goal: "과거 문서의 작성자와 새 버전으로 가져온 경위를 보존한다.",
  },
  201,
);
p = await seoyeon("join", { code: p.inviteCode });
const op = async (type, data = {}, who = jimin) =>
  (p = await who("projects/" + p.id, { type, version: p.version, ...data }));
await op("requirement.save", {
  title: "비품 신청과 취소",
  description: "합성 비품을 신청하고 당일 취소한다.",
  priority: "must",
  status: "accepted",
  decision: "첫 시연은 신청과 취소의 기본 흐름으로 합의",
  sourceIds: [],
});
await op("prd.save", {
  body: "# 비품 신청과 취소\n\n직원은 품목과 수량을 입력해 신청한다.\n신청 당일에 취소할 수 있다.\n합성 데이터만 사용한다.",
});
await op("prd.approve");
await op("prd.approve", {}, seoyeon);
await op(
  "prd.save",
  {
    body:
      p.prd.body +
      "\n\n## 검토 제안\n신청 사유와 취소 사유를 필수로 받을지 팀이 검토한다.",
  },
  seoyeon,
);
await op("prd.approve");
await op("prd.approve", {}, seoyeon);
writeFileSync(
  "evidence/prd-history-browser-before.json",
  JSON.stringify(p, null, 2),
);
writeFileSync(
  "evidence/prd-history-preparation.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      projectId: p.id,
      projectName: p.name,
      firstWriter: "jimin",
      secondWriter: "seoyeon",
      currentRevision: p.prd.revision,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    { projectId: p.id, projectName: p.name, currentRevision: p.prd.revision },
    null,
    2,
  ),
);
