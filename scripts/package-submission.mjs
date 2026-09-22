import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { verifySubmission } from "./verify-submission.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const required = [
  "app",
  "components",
  "lib",
  "db",
  "drizzle",
  "hooks",
  "public",
  "build",
  "vendor",
  "scripts",
  "tests",
  "data",
  "docs",
  "evidence",
  ".openai/hosting.json",
  "README.md",
  "package.json",
  "package-lock.json",
  ".npmrc",
  ".gitignore",
  "cloudflare-env.d.ts",
  "components.json",
  "drizzle.config.ts",
  "eslint.config.mjs",
  "next.config.ts",
  "postcss.config.mjs",
  "tsconfig.json",
  "vite.config.ts",
  "wrangler.local.json",
];
const omitted = new Set([
  "node_modules",
  ".git",
  ".wrangler",
  ".sites-runtime",
  ".next",
  ".vinext",
  "dist",
  "outputs",
  ".DS_Store",
]);
const files = [];
function walk(relative) {
  if (
    relative
      .split("/")
      .some(
        (name) =>
          omitted.has(name) ||
          /^\.env(?:\.|$)/.test(name) ||
          /\.(pem|key)$/i.test(name),
      )
  )
    return;
  const target = join(root, relative),
    stat = lstatSync(target);
  if (stat.isSymbolicLink())
    throw new Error(
      `심볼릭 링크는 제출 대상에서 제거한 뒤 다시 실행하세요: ${relative}`,
    );
  if (stat.isDirectory()) {
    for (const child of readdirSync(target).sort())
      walk(relative + "/" + child);
  } else if (stat.isFile()) files.push(relative);
  else throw new Error(`일반 파일이 아닙니다: ${relative}`);
}
try {
  if (process.argv.length > 2)
    throw new Error("추가 인자 없이 npm run submission:pack을 사용하세요.");
  required.forEach(walk);
  for (const file of [
    "docs/START_HERE.md",
    "evidence/demo-final-project.json",
    "evidence/demo-preview.html",
    "evidence/agent-sessions/manifest.json",
  ])
    if (!files.includes(file))
      throw new Error(`필수 제출 자료가 없습니다: ${file}`);
  const sessionManifest = JSON.parse(
    readFileSync(join(root, "evidence/agent-sessions/manifest.json"), "utf8"),
  );
  const sessionFile = sessionManifest.target;
  if (!files.includes(sessionFile))
    throw new Error("보존한 실제 세션 로그가 없습니다.");
  const sessionBytes = readFileSync(join(root, sessionFile));
  if (
    sessionBytes.length !== sessionManifest.bytes ||
    createHash("sha256").update(sessionBytes).digest("hex") !==
      sessionManifest.sha256
  )
    throw new Error(
      "실제 세션 로그가 보존 목록과 다릅니다. 보존 후 다시 묶으세요.",
    );
  const capturedAt = new Date().toISOString();
  const output = join(root, "outputs", "submissions");
  mkdirSync(output, { recursive: true });
  const directory = mkdtempSync(
    join(output, capturedAt.replaceAll(":", "-").replaceAll(".", "-") + "-"),
  );
  const staged = join(directory, "TeamVibe");
  mkdirSync(staged);
  const entries = files.sort().map((path) => {
    const buffer = readFileSync(join(root, path));
    const destination = join(staged, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, buffer, {
      flag: "wx",
      mode: lstatSync(join(root, path)).mode & 0o777,
    });
    return {
      path,
      bytes: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex"),
    };
  });
  writeFileSync(
    join(staged, "SUBMISSION-MANIFEST.json"),
    JSON.stringify(
      {
        format: "teamvibe-submission-v1",
        capturedAt,
        files: entries,
        sessionSnapshot: {
          capturedAt: sessionManifest.capturedAt,
          bytes: sessionManifest.bytes,
          sha256: sessionManifest.sha256,
        },
        excluded: [
          "Installed dependencies",
          "Local databases and tool state",
          "Build output",
          "Environment files and key files",
          "Prior submission archives",
        ],
        note: "실제 원본 로그는 명시된 보존 시점까지의 스냅샷입니다. 파일 무결성은 실행·기능 검증을 대신하지 않습니다.",
      },
      null,
      2,
    ),
  );
  const verified = verifySubmission(staged);
  const archive = join(directory, "TeamVibe.tar.gz");
  const tar = spawnSync("tar", ["-czf", archive, "-C", directory, "TeamVibe"], {
    encoding: "utf8",
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
  if (tar.error) throw tar.error;
  if (tar.status !== 0) throw new Error(`tar 압축 실패: ${tar.stderr}`);
  const archiveBytes = readFileSync(archive);
  const result = {
    at: capturedAt,
    archive,
    staged,
    fileCount: verified.files,
    bytes: archiveBytes.length,
    sha256: createHash("sha256").update(archiveBytes).digest("hex"),
    sessionCapturedAt: sessionManifest.capturedAt,
    localOnly: true,
  };
  writeFileSync(
    join(directory, "archive.json"),
    JSON.stringify(result, null, 2),
  );
  writeFileSync(
    join(root, "outputs", "latest-submission.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`제출 자료 묶기 실패: ${error.message}`);
  process.exitCode = 1;
}
