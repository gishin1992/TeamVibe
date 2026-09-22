import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { resolve, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

export function verifySubmission(root) {
  const manifest = JSON.parse(
    readFileSync(join(root, "SUBMISSION-MANIFEST.json"), "utf8"),
  );
  if (
    manifest.format !== "teamvibe-submission-v1" ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length
  )
    throw new Error("올바른 TeamVibe 제출 목록이 아닙니다.");
  const seen = new Set();
  for (const file of manifest.files) {
    const path = file.path;
    if (
      typeof path !== "string" ||
      path.startsWith("/") ||
      path.includes("\\") ||
      path.includes(":") ||
      path.includes("\0") ||
      posix.normalize(path) !== path ||
      path.split("/").some((x) => !x || x === "." || x === "..") ||
      seen.has(path)
    )
      throw new Error("제출 목록의 경로가 잘못되었거나 중복됩니다.");
    seen.add(path);
    let target = root;
    for (const segment of path.split("/")) {
      target = join(target, segment);
      if (lstatSync(target).isSymbolicLink())
        throw new Error(`심볼릭 링크를 검증하지 않습니다: ${path}`);
    }
    if (!lstatSync(target).isFile())
      throw new Error(`일반 파일이 아닙니다: ${path}`);
    const buffer = readFileSync(target);
    if (
      buffer.length !== file.bytes ||
      createHash("sha256").update(buffer).digest("hex") !== file.sha256
    )
      throw new Error(`제출 이후 내용이 달라졌습니다: ${path}`);
  }
  return {
    ok: true,
    files: seen.size,
    capturedAt: manifest.capturedAt,
    note: "목록에 있는 파일의 무결성 검사입니다. 앱 실행·기능 통과를 뜻하지 않으며 추가 파일은 검사하지 않습니다.",
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(
      JSON.stringify(
        verifySubmission(resolve(process.argv[2] || ".")),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(`제출 자료 확인 실패: ${error.message}`);
    process.exitCode = 1;
  }
}
