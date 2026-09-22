import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
const reproduce = process.argv.includes("--reproduce-before");
const login = await fetch(base + "/api/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: "jimin" }),
});
const cookie = login.headers.get("set-cookie").split(";")[0];
async function call(path, data, status = 200) {
  const response = await fetch(base + "/api/" + path, {
    method: data ? "POST" : "GET",
    headers: {
      Cookie: cookie,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result;
}
let p = await call(
  "projects",
  {
    name: reproduce
      ? "복원 출처 재검토 · 수정 전 재현"
      : "보관한 요구사항 · 변경된 원문 재검토",
    description: "요구사항이 휴지통에 있는 동안 원문이 수정된 합성 예제",
    goal: "복원한 요구사항의 이전 합의와 변경된 원문을 비교한다.",
  },
  201,
);
const op = async (type, data = {}) =>
  (p = await call("projects/" + p.id, { type, version: p.version, ...data }));
await op("conversation.save", { title: "신청 취소 기한" });
const conversationId = p.conversations[0].id;
await op("message.save", {
  conversationId,
  text: "신청 당일에만 취소할 수 있어야 합니다.",
  source: "합성 팀원 의견",
});
const messageId = p.conversations[0].messages[0].id;
await op("requirement.save", {
  title: "신청 취소 기한",
  description: "신청 당일에만 취소한다.",
  priority: "must",
  status: "accepted",
  decision: "초기 당일 취소 범위에 합의",
  sourceIds: [messageId],
});
const requirementId = p.requirements[0].id;
await op("prd.generate");
await op("prd.approve");
await op("item.delete", { collection: "requirements", id: requirementId });
await op("message.save", {
  conversationId,
  id: messageId,
  text: "신청 후 3일 동안 취소할 수 있어야 합니다.",
  source: "기한을 확장한 합성 의견",
});
if (reproduce) {
  await op("item.restore", { collection: "requirements", id: requirementId });
  await op("prd.generate");
  await op("prd.approve");
  assert.equal(p.requirements[0].status, "accepted");
  assert.equal(p.requirements[0].sourceRevisions[messageId], 1);
  assert.equal(p.conversations[0].messages[0].revision, 2);
  writeFileSync(
    "evidence/requirement-restore-before-fix.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        observation:
          "Archived requirement restored accepted with source v1 while message v2; fresh PRD approval was allowed.",
        project: p,
      },
      null,
      2,
    ),
  );
  await op("project.delete");
} else {
  writeFileSync(
    "evidence/requirement-restore-browser-before.json",
    JSON.stringify(p, null, 2),
  );
  writeFileSync(
    "evidence/requirement-restore-preparation.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        projectId: p.id,
        projectName: p.name,
        conversationId,
        messageId,
        requirementId,
      },
      null,
      2,
    ),
  );
}
console.log(
  JSON.stringify({ projectId: p.id, projectName: p.name, reproduce }, null, 2),
);
