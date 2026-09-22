import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { verifySubmission } from "../scripts/verify-submission.mjs";
mkdirSync(".sites-runtime", { recursive: true });
const directory = resolve(mkdtempSync(".sites-runtime/submission-integrity-"));
mkdirSync(join(directory, "docs"));
const content = "Synthetic submission file\n",
  path = "docs/example.md";
const manifest = {
  format: "teamvibe-submission-v1",
  capturedAt: new Date().toISOString(),
  files: [
    {
      path,
      bytes: Buffer.byteLength(content),
      sha256: createHash("sha256").update(content).digest("hex"),
    },
  ],
};
const saveManifest = (data) =>
  writeFileSync(
    join(directory, "SUBMISSION-MANIFEST.json"),
    JSON.stringify(data),
  );
const file = join(directory, path);
writeFileSync(file, content);
saveManifest(manifest);
assert.equal(verifySubmission(directory).files, 1);
writeFileSync(
  join(directory, "unlisted.txt"),
  "Additional files are outside this integrity check.",
);
assert(verifySubmission(directory).ok);
writeFileSync(file, content.replace("Synthetic", "Modified!"));
assert.throws(() => verifySubmission(directory), /내용이 달라졌습니다/);
writeFileSync(file, content + "extra");
assert.throws(() => verifySubmission(directory), /내용이 달라졌습니다/);
renameSync(file, file + ".saved");
assert.throws(() => verifySubmission(directory), /ENOENT/);
renameSync(file + ".saved", file);
writeFileSync(file, content);
for (const badPath of [
  "../outside.md",
  "/outside.md",
  "docs/../example.md",
  "docs\\example.md",
  "C:/example.md",
  "docs//example.md",
  "docs/./example.md",
  "docs/example.md\0",
]) {
  saveManifest({
    ...manifest,
    files: [{ ...manifest.files[0], path: badPath }],
  });
  assert.throws(() => verifySubmission(directory), /경로가 잘못/);
}
saveManifest({ ...manifest, files: [...manifest.files, ...manifest.files] });
assert.throws(() => verifySubmission(directory), /중복/);
saveManifest(manifest);
renameSync(file, file + ".original");
symlinkSync(file + ".original", file);
assert.throws(() => verifySubmission(directory), /심볼릭 링크/);
renameSync(file, file + ".symlink");
renameSync(file + ".original", file);
renameSync(join(directory, "docs"), join(directory, "docs-original"));
symlinkSync(join(directory, "docs-original"), join(directory, "docs"));
assert.throws(() => verifySubmission(directory), /심볼릭 링크/);
renameSync(join(directory, "docs"), join(directory, "docs-symlink"));
renameSync(join(directory, "docs-original"), join(directory, "docs"));
assert(verifySubmission(directory).ok);
assert.equal(readFileSync(file, "utf8"), content);
writeFileSync(
  "evidence/submission-integrity-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      directory,
      checks: [
        "clean matching files",
        "same-size tamper and changed-size tamper",
        "missing file",
        "unsafe and duplicate manifest paths",
        "symlink file and parent directory",
        "explicitly limited listed-file scope",
      ],
      note: "Synthetic files only. No app execution; no existing files deleted.",
    },
    null,
    2,
  ),
);
console.log(
  "PASS submission integrity: content hashes, required files, path/symlink boundaries, explicit additional-file scope.",
);
