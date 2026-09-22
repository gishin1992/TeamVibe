import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fixtureResultData } from "./result-context.mjs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
const login = await fetch(base + "/api/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: "jimin" }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";")[0];
const call = async (path, data, status = 200) => {
  const r = await fetch(base + "/api/" + path, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const value = await r.json();
  assert.equal(r.status, status, JSON.stringify(value));
  return value;
};
let p = await call(
  "projects",
  {
    name: "결과 파일 읽기 · 재시도와 입력 보호",
    description: "잘못된 파일과 같은 파일 재선택을 확인하는 합성 시연",
    goal: "파일 오류나 늦은 읽기가 다른 입력을 덮어쓰지 않는다.",
  },
  201,
);
const op = async (type, data = {}) =>
  (p = await call("projects/" + p.id, { type, version: p.version, ...data }));
await op("prd.save", {
  body: "# 합성 파일 반입 검토\n서로 다른 작업의 결과를 정확한 작업에 반입한다.",
});
await op("prd.approve");
for (const title of ["첫 안내 화면", "별도 안내 화면"])
  await op("story.save", {
    title,
    description: "합성 안내 제목을 화면에 표시한다.",
    acceptance: ["화면에 안내 제목을 표시한다."],
    tests: ["실제 미리보기에서 제목을 확인한다."],
    dependencies: [],
    requirementIds: [],
    ownerId: "jimin",
    status: "ready",
  });
await op("run.start", { storyIds: p.stories.map((s) => s.id) });
const { id, ...result } = fixtureResultData(p, "run.submit", {
  id: p.runs[0].id,
  files: {
    "index.html":
      "<!doctype html><html lang=ko><meta charset=utf-8><body><h1>첫 안내 화면</h1></body></html>",
  },
  log: "합성 파일을 작성했습니다. 브라우저 실행은 하지 않았습니다.",
  source: "파일 선택 흐름 검증용 합성 결과",
});
writeFileSync("evidence/file-import-before.json", JSON.stringify(p, null, 2));
writeFileSync(
  "evidence/file-import-valid.json",
  JSON.stringify(result, null, 2),
);
writeFileSync("evidence/file-import-invalid.json", "{ invalid JSON");
writeFileSync(
  "evidence/file-import-oversize.json",
  " ".repeat(1_199_999) + "{}",
);
console.log(
  JSON.stringify({ projectId: p.id, runIds: p.runs.map((r) => r.id) }, null, 2),
);
