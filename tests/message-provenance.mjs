import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
async function client(userId) {
  const r = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie").split(";")[0];
  return async (path, body, status = 200) => {
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
  };
}
const owner = await client("jimin"),
  teammate = await client("seoyeon");
let p = await owner(
  "projects",
  {
    name: "대화 출처와 수정 이력 검사 " + Date.now(),
    description: "수정·복원 뒤에도 요구사항의 근거를 보존하는 합성 검사",
    goal: "대화와 요구사항의 변경 맥락을 함께 확인한다.",
  },
  201,
);
p = await teammate("join", { code: p.inviteCode });
const op = async (type, data = {}, status = 200, who = owner) => {
  const result = await who(
    "projects/" + p.id,
    { type, version: p.version, ...data },
    status,
  );
  if (status === 200) p = result;
  return result;
};
await op("conversation.save", { title: "비품 신청의 대상 범위" });
const conversationId = p.conversations[0].id;
await op("message.save", {
  conversationId,
  text: "합성 키보드 신청은 팀원 누구나 할 수 있어야 합니다.",
  source: "최초 합성 의견",
  kind: "user",
});
const messageId = p.conversations[0].messages[0].id;
const message = () => p.conversations[0].messages[0];
await op("requirement.save", {
  title: "팀원의 비품 신청",
  description: message().text,
  priority: "must",
  status: "accepted",
  decision: "모든 팀원이 신청한다.",
  sourceIds: [messageId],
});
const requirementId = p.requirements[0].id;
assert.equal(p.requirements[0].sourceRevisions[messageId], 1);
await op("prd.generate");
await op("prd.approve");
await op("prd.approve", {}, 200, teammate);
await op("message.save", {
  conversationId,
  id: messageId,
  text: "합성 키보드와 마우스를 팀원 누구나 신청할 수 있어야 합니다.",
  source: "범위 확장 합성 의견",
});
assert.equal(message().revision, 2);
assert.equal(
  message().history[0].text,
  "합성 키보드 신청은 팀원 누구나 할 수 있어야 합니다.",
);
assert.equal(message().history[0].source, "최초 합성 의견");
assert.equal(p.requirements[0].status, "proposed");
assert.equal(p.requirements[0].sourceRevisions[messageId], 1);
assert.equal(p.prd.approvals.length, 0);
await op("prd.approve", {}, 400);
await op("message.save", {
  conversationId,
  id: messageId,
  text: message().text,
  source: message().source,
});
assert.equal(message().revision, 2);
await op(
  "message.revert",
  { conversationId, id: messageId, revision: 1 },
  403,
  teammate,
);
await op(
  "message.revert",
  { conversationId, id: messageId, revision: 999 },
  400,
);
await op(
  "message.save",
  { conversationId, id: p.conversations[0].messages[1].id, text: "안내 위조" },
  400,
);
await op("requirement.save", {
  ...p.requirements[0],
  status: "accepted",
  description: message().text,
  decision: "키보드와 마우스로 범위 확대",
});
assert.equal(p.requirements[0].sourceRevisions[messageId], 2);
await op("message.revert", { conversationId, id: messageId, revision: 1 });
assert.equal(message().revision, 3);
assert.equal(message().source, "최초 합성 의견");
assert.deepEqual(
  message().history.map((revision) => revision.revision),
  [1, 2],
);
assert.equal(p.requirements[0].status, "proposed");
await op("message.delete", { conversationId, id: messageId });
assert.equal(message().history.length, 2);
assert.ok(message().deletedAt);
await op("message.revert", { conversationId, id: messageId, revision: 1 }, 400);
await op("message.restore", { conversationId, id: messageId });
await op("item.delete", { collection: "conversations", id: conversationId });
assert.equal(p.requirements[0].sourceIds[0], messageId);
assert.equal(message().history[1].source, "범위 확장 합성 의견");
await op("item.restore", { collection: "conversations", id: conversationId });
await op("requirement.save", {
  ...p.requirements[0],
  status: "accepted",
  description: message().text,
  decision: "초기 범위를 다시 채택",
});
assert.equal(p.requirements[0].sourceRevisions[messageId], 3);
await op("prd.generate");
await op("prd.approve");
await op("prd.approve", {}, 200, teammate);
writeFileSync(
  "evidence/message-provenance-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      status: "passed",
      projectId: p.id,
      projectName: p.name,
      conversationId,
      messageId,
      requirementId,
      checks: [
        "편집 전 메시지·출처 원문 보존",
        "출처 수정 시 연결 요구사항 검토 대기 및 PRD 재동의",
        "같은 내용 저장 시 이력 중복 방지",
        "다른 작성자의 복원과 안내 수정 차단",
        "이전 버전 복원 시 새 버전과 전체 이력 보존",
        "메시지/대화 휴지통 이동 후 근거 보존",
        "재합의 시 검토한 출처 버전 갱신",
      ],
    },
    null,
    2,
  ),
);
writeFileSync(
  "evidence/message-provenance-project.json",
  JSON.stringify(p, null, 2),
);
console.log(
  "PASS message revision history, source version provenance, review invalidation, and soft-delete retention.",
);
