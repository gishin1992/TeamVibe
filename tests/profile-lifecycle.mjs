import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = (process.env.TEAMVIBE_URL || "http://localhost:5174") + "/api/";
const post = async (path, body, cookie = "") => {
  const r = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  assert.equal(r.status, path === "users" ? 201 : 200, JSON.stringify(d));
  return { d, cookie: r.headers.get("set-cookie")?.split(";")[0] };
};
const u = (await post("users", { name: "프로필 검증 합성 사용자", role: "QA" }))
  .d;
const session = await post("session", { userId: u.id });
const edited = (
  await post(
    "users/edit",
    { name: "수정된 합성 사용자", role: "검증 완료" },
    session.cookie,
  )
).d;
assert.equal(edited.name, "수정된 합성 사용자");
await post("users/archive", {}, session.cookie);
const hidden = await fetch(base + "bootstrap", {
  headers: { Cookie: session.cookie },
}).then((r) => r.json());
assert.equal(hidden.user, null);
assert.equal(hidden.users.find((x) => x.id === u.id).archived, 1);
await post("users/restore", { userId: u.id });
const restored = await post("session", { userId: u.id });
await post("users/archive", {}, restored.cookie);
writeFileSync(
  "evidence/profile-lifecycle-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      userId: u.id,
      result: "passed",
      checks: [
        "create",
        "edit",
        "soft-delete",
        "session-rejected-after-delete",
        "restore",
        "login-after-restore",
      ],
      cleanup: "합성 검증 프로필을 휴지통 보관",
    },
    null,
    2,
  ),
);
console.log(
  "PASS profile create, edit, archive, restore, session invalidation.",
);
