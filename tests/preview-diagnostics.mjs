import assert from "node:assert/strict";
import {
  readPreviewDiagnostic,
  previewDiagnosticReport,
} from "../lib/teamvibe/preview-diagnostics.ts";
import {
  previewDocument,
  standaloneDocument,
} from "../lib/teamvibe/sandbox.ts";

const valid = {
  type: "teamvibe.preview.diagnostic",
  token: "current",
  kind: "script",
  message: "합성 오류",
};
assert.deepEqual(readPreviewDiagnostic(valid, "current"), {
  kind: "script",
  message: "합성 오류",
});
for (const value of [
  null,
  [],
  "text",
  { ...valid, token: "previous" },
  { ...valid, type: "other" },
  { ...valid, kind: "__proto__" },
  { ...valid, kind: "toString" },
  { ...valid, message: " " },
  { ...valid, message: {} },
])
  assert.equal(readPreviewDiagnostic(value, "current"), null);
assert.equal(
  readPreviewDiagnostic({ ...valid, message: "x".repeat(3000) }, "current")
    .message.length,
  2000,
);
for (const kind of ["promise", "resource", "policy"])
  assert.equal(readPreviewDiagnostic({ ...valid, kind }, "current").kind, kind);
const report = previewDiagnosticReport("합성 릴리스", "release-1", [
  { kind: "promise", message: "테스트 오류" },
]);
assert(
  report.includes("release-1") &&
    report.includes("비동기 실행 오류: 테스트 오류"),
);
assert(report.includes("테스트 통과를 의미하지 않습니다"));
const files = {
  "index.html": '<script src="app.js"></script>',
  "app.js": 'throw new Error("fixture")',
};
const html = previewDocument(files, {
  token: "token</script><script>wrong()",
  parentOrigin: "http://localhost:5174",
});
assert(
  html.indexOf("Content-Security-Policy") <
    html.indexOf("teamvibe.preview.diagnostic"),
);
assert(
  html.indexOf("teamvibe.preview.diagnostic") <
    html.indexOf('throw new Error("fixture")'),
);
assert(!html.includes("token</script>"));
assert(
  html.includes("connect-src 'none'") && html.includes("form-action 'none'"),
);
assert(!previewDocument(files).includes("teamvibe.preview.diagnostic"));
const portable = standaloneDocument(files, "합성");
assert(portable.includes('sandbox="allow-scripts allow-forms"'));
assert(
  !portable.includes("allow-same-origin") &&
    !portable.includes("teamvibe.preview.diagnostic"),
);
console.log(
  "PASS preview diagnostic data: execution token, allowed kinds, bounded text, portable isolation markup. Browser execution is verified separately.",
);
