import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  MAX_RESULT_FILE_BYTES,
  readJsonFile,
  applyJsonFileValue,
} from "../lib/teamvibe/json-file-import.ts";
const value = '{"files":{"index.html":"합성 파일"}}\n';
assert.equal(
  await readJsonFile({
    size: Buffer.byteLength(value),
    text: async () => value,
  }),
  value,
);
const exact = " ".repeat(MAX_RESULT_FILE_BYTES - 2) + "{}";
assert.equal(
  await readJsonFile({ size: MAX_RESULT_FILE_BYTES, text: async () => exact }),
  exact,
);
let reads = 0;
await assert.rejects(
  readJsonFile({
    size: MAX_RESULT_FILE_BYTES + 1,
    text: async () => {
      reads++;
      return "{}";
    },
  }),
  /1.2 MB/,
);
assert.equal(reads, 0);
await assert.rejects(
  readJsonFile({ size: 10, text: async () => "{ invalid" }),
  /올바른 JSON/,
);
await assert.rejects(
  readJsonFile({
    size: 10,
    text: async () => {
      throw new Error("I/O error");
    },
  }),
  /파일을 읽지 못했습니다/,
);

const started = {
  title: "작업 A",
  values: { payload: "원래 입력", source: "보존할 필드" },
};
const changed = applyJsonFileValue(started, started, "payload", value);
assert.equal(changed.values.payload, value);
assert.equal(changed.values.source, started.values.source);
assert.equal(started.values.payload, "원래 입력");
for (const [name, next] of [
  ["closed", null],
  ["different form", { title: "작업 B", values: { payload: "B 입력" } }],
  [
    "new input",
    { ...started, values: { ...started.values, payload: "새 입력" } },
  ],
  ["identical retyping", { ...started, values: { ...started.values } }],
]) {
  let resolve;
  let current = started;
  const pending = readJsonFile({
    size: value.length,
    text: () => new Promise((r) => (resolve = r)),
  }).then(
    (text) => (current = applyJsonFileValue(current, started, "payload", text)),
  );
  current = next;
  resolve(value);
  await pending;
  assert.equal(
    current,
    next,
    `${name}: late read must not overwrite current form`,
  );
}
writeFileSync(
  "evidence/json-file-import-unit-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      passed: true,
      checks: [
        "valid bytes preserved",
        "exact size limit accepted",
        "oversize rejected before read",
        "syntax and I/O error messages distinct",
        "unchanged form receives file while other fields and original snapshot preserved",
        "deferred read cannot reopen closed form",
        "cannot replace new form",
        "cannot overwrite newer edits or identical retyping",
      ],
      scope:
        "Actual helper calls with controlled asynchronous readers, not delayed browser File.text.",
    },
    null,
    2,
  ),
);
console.log(
  "PASS JSON file import: byte limit, read/syntax failures, deferred close/reopen/edit isolation.",
);
