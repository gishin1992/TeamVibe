// Prepare a second local user to change an item while its UI editor stays open.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
const mode = process.argv[2] || "prepare";
async function client(userId) {
  const r = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie").split(";")[0];
  return async (path, body, status = 200) => {
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
  };
}
const owner = await client("jimin"),
  teammate = await client("seoyeon");
if (mode === "prepare") {
  let p = await owner(
    "projects",
    {
      name: "동시 편집 · 요구사항 검증 " + Date.now(),
      description: "두 시연 프로필의 동시 편집 보존을 확인하는 합성 프로젝트",
      goal: "서로 다른 필드의 수정은 보존하고 같은 필드의 충돌은 선택하여 해결한다.",
    },
    201,
  );
  p = await teammate("join", { code: p.inviteCode });
  p = await owner("projects/" + p.id, {
    type: "requirement.save",
    version: p.version,
    title: "합성 원본 제목",
    description: "합성 원본 내용",
    priority: "must",
    status: "proposed",
    decision: "검토할 결정 근거",
    sourceIds: [],
  });
  const metadata = {
    at: new Date().toISOString(),
    projectId: p.id,
    projectName: p.name,
    requirementId: p.requirements[0].id,
  };
  writeFileSync(
    "evidence/edit-conflict-preparation.json",
    JSON.stringify(metadata, null, 2),
  );
  console.log(JSON.stringify(metadata, null, 2));
} else {
  const meta = JSON.parse(
    readFileSync("evidence/edit-conflict-preparation.json", "utf8"),
  );
  let p = await teammate("projects/" + meta.projectId);
  const req = p.requirements.find((r) => r.id === meta.requirementId);
  const version = p.version;
  if (mode === "independent")
    p = await teammate("projects/" + p.id, {
      ...req,
      type: "requirement.save",
      version,
      description: "이서연이 별도 세션에서 수정한 최신 내용",
    });
  else if (mode === "same-field")
    p = await teammate("projects/" + p.id, {
      ...req,
      type: "requirement.save",
      version,
      title: "이서연이 제안한 공동 제목",
    });
  else if (mode === "delete" || mode === "restore")
    p = await teammate("projects/" + p.id, {
      type: mode === "delete" ? "item.delete" : "item.restore",
      version,
      collection: "requirements",
      id: meta.requirementId,
    });
  else assert.equal(mode, "snapshot", "지원하지 않는 검사 단계");
  const record = {
    at: new Date().toISOString(),
    mode,
    projectId: p.id,
    beforeVersion: version,
    afterVersion: p.version,
    requirement: p.requirements.find((r) => r.id === meta.requirementId),
  };
  writeFileSync(
    "evidence/edit-conflict-" + mode + ".json",
    JSON.stringify(record, null, 2),
  );
  console.log(JSON.stringify(record, null, 2));
}
