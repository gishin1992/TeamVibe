import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { standaloneDocument } from "../lib/teamvibe/sandbox.ts";

const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname),
  "로컬 주소만 사용하세요.",
);
const projectId =
  process.argv[2] ||
  JSON.parse(readFileSync("evidence/demo-preparation.json", "utf8")).projectId;
const login = await fetch(base + "/api/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: "jimin" }),
});
assert.equal(login.status, 200);
const response = await fetch(
  base + "/api/projects/" + encodeURIComponent(projectId),
  { headers: { Cookie: login.headers.get("set-cookie").split(";")[0] } },
);
assert.equal(response.status, 200);
const project = await response.json();
const release = project.releases.find(
  (r) => !r.deletedAt && r.status === "active",
);
assert.ok(release, "활성 릴리스가 필요합니다.");
const output = resolve("evidence/demo-code");
mkdirSync(output, { recursive: true });
for (const [path, content] of Object.entries(release.files)) {
  const target = resolve(output, path);
  assert.ok(target.startsWith(output + "/"), "내보내기 경로 이탈");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}
writeFileSync(
  "evidence/demo-preview.html",
  standaloneDocument(release.files, release.title),
);
writeFileSync(
  "evidence/demo-final-project.json",
  JSON.stringify(project, null, 2),
);
writeFileSync(
  "evidence/demo-export.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      projectId,
      releaseId: release.id,
      files: Object.keys(release.files),
      tests: project.testResults
        .filter((t) => !t.deletedAt)
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          coverage: t.coverage,
        })),
      stories: project.stories
        .filter((s) => !s.deletedAt)
        .map((s) => ({ id: s.id, title: s.title, status: s.status })),
      note: "기존 프로젝트의 읽기 전용 내보내기. 실행 HTML은 동일한 격리 iframe을 포함한다.",
    },
    null,
    2,
  ),
);
console.log(
  "Exported project, source files, and portable preview to evidence/.",
);
