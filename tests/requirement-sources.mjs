import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { requirementSourceOptions } from "../lib/teamvibe/source-options.ts";
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
}
let p = await call(
  "projects",
  {
    name: "요구사항 출처 연결 검사 " + Date.now(),
    description: "원문 연결 변경 이력의 합성 API 검사",
    goal: "출처 교체와 해제, 버전 재검토를 보존한다.",
  },
  201,
);
async function op(type, data = {}, status = 200) {
  const d = await call(
    "projects/" + p.id,
    { type, version: p.version, ...data },
    status,
  );
  if (status === 200) p = d;
  else assert.deepEqual(await call("projects/" + p.id), p);
  return d;
}
await op("conversation.save", { title: "원래 의견" });
const a = p.conversations[0].id;
await op("message.save", {
  conversationId: a,
  text: "원래 신청은 당일 취소합니다.",
});
const aid = p.conversations[0].messages[0].id,
  guide = p.conversations[0].messages[1].id;
await op("conversation.save", { title: "보완한 의견" });
const b = p.conversations[1].id;
await op("message.save", {
  conversationId: b,
  text: "신청 후 하루 동안 취소합니다.",
  kind: "chatgpt",
  source: "합성 ChatGPT 응답",
});
const bid = p.conversations[1].messages[0].id;
await op("conversation.save", { title: "추가 근거" });
const c = p.conversations[2].id;
await op("message.save", {
  conversationId: c,
  text: "취소 사유도 확인합니다.",
});
const cid = p.conversations[2].messages[0].id;
await op("requirement.save", {
  title: "신청 취소",
  description: "취소 기간을 확인한다.",
  priority: "must",
  status: "accepted",
  decision: "합성 정책 선택",
  sourceIds: [aid],
});
const rid = p.requirements[0].id;
const req = () => p.requirements.find((r) => r.id === rid);
async function edit(values = {}, status = 200) {
  await op("requirement.save", { ...req(), ...values }, status);
}
await op("prd.generate");
await op("prd.approve");
await edit({ sourceIds: [bid] });
assert.equal(req().sourceRevisions[bid], 1);
assert.deepEqual(req().sourceHistory[0].sourceIds, [aid]);
assert.equal(req().sourceHistory[0].sourceRevisions[aid], 1);
assert.equal(req().sourceHistory[0].authorId, "jimin");
assert.equal(p.prd.approvals.length, 0);
await edit({ sourceIds: [bid, guide] }, 400);
await edit({ sourceIds: ["unknown"] }, 400);
await op("message.delete", { conversationId: b, id: bid });
const options = requirementSourceOptions(
  p,
  [{ id: "jimin", name: "김지민", role: "합성", color: "blue" }],
  [bid],
  [bid],
);
assert(
  options.find((o) => o.value === bid).label.includes("휴지통의 기존 출처"),
);
assert(!options.some((o) => o.value === guide));
await edit({ title: "기존 휴지통 출처 보존" });
assert.equal(req().sourceHistory.length, 1);
await edit({ sourceIds: [] });
assert.deepEqual(req().sourceHistory[1].sourceIds, [bid]);
assert.equal(Object.keys(req().sourceRevisions).length, 0);
await edit({ sourceIds: [bid] }, 400);
await op("message.restore", { conversationId: b, id: bid });
await edit({ sourceIds: [bid] });
assert.deepEqual(req().sourceHistory[2].sourceIds, []);
await op("message.save", {
  conversationId: b,
  id: bid,
  text: "신청 후 이틀 동안 취소합니다.",
});
assert.equal(req().status, "proposed");
assert.equal(req().sourceRevisions[bid], 1);
await edit({ status: "accepted", decision: "합성 원문 v2를 검토" });
assert.equal(req().sourceRevisions[bid], 2);
assert.equal(req().sourceHistory.at(-1).sourceRevisions[bid], 1);
const historyLength = req().sourceHistory.length;
await edit();
assert.equal(req().sourceHistory.length, historyLength);
await op("item.delete", { collection: "conversations", id: c });
await edit({ sourceIds: [bid, cid] }, 400);
const pendingOptions = requirementSourceOptions(p, [], [cid], []);
assert(
  pendingOptions.find((o) => o.value === cid).label.includes("연결 해제 필요"),
);
await op("item.restore", { collection: "conversations", id: c });
await edit({ sourceIds: [bid, cid] });
const beforeOrder = req().sourceHistory.length;
await edit({ sourceIds: [cid, bid] });
assert.equal(req().sourceHistory.length, beforeOrder);
assert.equal(
  latestFormValues(p, { type: "requirement.save", id: rid }, { sourceIds: "" })
    .sourceIds,
  [cid, bid].join("\n"),
);
await edit({ sourceIds: [bid] });
await op("requirement.save", {
  title: "추가 출처 요구",
  description: "취소 사유 확인",
  priority: "must",
  status: "proposed",
  decision: "",
  sourceIds: [cid],
});
const mergedSource = p.requirements.at(-1).id;
await op("requirement.merge", {
  targetId: rid,
  sourceId: mergedSource,
  title: "기간과 사유",
  description: "취소 기간과 사유를 확인한다.",
  decision: "합성 중복 통합",
});
assert.deepEqual(req().sourceHistory.at(-1).sourceIds, [bid]);
assert.deepEqual(req().sourceIds, [bid, cid]);
assert.equal(
  p.requirements.find((r) => r.id === mergedSource).sourceIds[0],
  cid,
);
const finalHistory = structuredClone(req().sourceHistory);
await op("item.delete", { collection: "requirements", id: rid });
await op("item.restore", { collection: "requirements", id: rid });
assert.deepEqual(req().sourceHistory, finalHistory);
const oldVersion = p.version;
await edit({ sourceIds: [aid] });
await call(
  "projects/" + p.id,
  { type: "requirement.save", version: oldVersion, ...req(), sourceIds: [bid] },
  409,
);
assert.deepEqual(await call("projects/" + p.id), p);
const result = {
  at: new Date().toISOString(),
  projectId: p.id,
  historyCount: req().sourceHistory.length,
  checks: [
    "replacement/unlink history",
    "retained archived sources",
    "new guide/archived/foreign source rejected atomically",
    "reaccept records old revision",
    "same sources or order only do not duplicate history",
    "merge and recycle preserve history",
    "CAS preserves newer links",
    "named options and editor rebase values",
  ],
  note: "Synthetic API state and pure option checks; browser behavior recorded separately.",
};
await op("project.delete");
writeFileSync(
  "evidence/requirement-sources-api-result.json",
  JSON.stringify(result, null, 2),
);
console.log(
  "PASS requirement source links: editable references, immutable prior links/revisions, archived-source guards, merge/recycle and CAS.",
);
