import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  integrationDraftKey,
  createIntegrationDraft,
  editIntegrationDraft,
  completeIntegrationDraft,
} from "../lib/teamvibe/integration-drafts.ts";

const pair = integrationDraftKey("jimin", "a", ["run-1", "run-2"]);
assert.equal(pair, integrationDraftKey("jimin", "a", ["run-2", "run-1"]));
const keys = [
  pair,
  integrationDraftKey("jimin", "a", ["run-1"]),
  integrationDraftKey("jimin", "b", ["run-1", "run-2"]),
  integrationDraftKey("seoyeon", "a", ["run-1", "run-2"]),
];
assert.equal(new Set(keys).size, 4);
let drafts = {};
const initial = createIntegrationDraft(1);
for (const key of keys)
  drafts = editIntegrationDraft(drafts, key, initial, { title: key });
drafts = editIntegrationDraft(drafts, pair, initial, {
  version: 5,
  resolutions: {
    "obsolete.js": { content: null, reason: "No longer referenced" },
  },
  chosenPaths: ["obsolete.js"],
  transferPrompt: { text: "request", version: 5 },
  transferRaw: "response",
});
const preserved = structuredClone(drafts[pair]);
drafts = editIntegrationDraft(
  drafts,
  pair,
  createIntegrationDraft(99, 99),
  (current) => ({
    resolutions: {
      ...current.resolutions,
      "index.html": { content: "merged code", reason: "Keep both changes" },
    },
    chosenPaths: [...current.chosenPaths, "index.html"],
  }),
);
assert.equal(
  drafts[pair].version,
  5,
  "Remount defaults cannot silently acknowledge a newer server version.",
);
assert.deepEqual(
  drafts[pair].resolutions["obsolete.js"],
  preserved.resolutions["obsolete.js"],
);
assert.equal(drafts[pair].transferRaw, preserved.transferRaw);
assert.equal(drafts[pair].transferPrompt.version, 5);
const submitted = drafts[pair];
drafts = editIntegrationDraft(drafts, pair, initial, { title: "New edit" });
assert.equal(completeIntegrationDraft(drafts, pair, submitted), drafts);
drafts = editIntegrationDraft(drafts, pair, initial, {
  title: submitted.title,
});
assert.equal(
  completeIntegrationDraft(drafts, pair, submitted),
  drafts,
  "Identical retyping remains a newer snapshot.",
);
const imported = drafts[pair];
const cleared = completeIntegrationDraft(drafts, pair, imported);
assert.equal(cleared[pair], undefined);
keys.slice(1).forEach((key) => assert.equal(cleared[key], drafts[key]));
const reset = editIntegrationDraft(
  drafts,
  pair,
  initial,
  createIntegrationDraft(2, 8),
);
assert.deepEqual(reset[pair], createIntegrationDraft(2, 8));
assert.equal(drafts[pair], imported);
keys.slice(1).forEach((key) => assert.equal(reset[key], drafts[key]));
writeFileSync(
  "evidence/integration-drafts-unit-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      passed: true,
      checks: [
        "same run set regardless of order",
        "user/project/run-set separation",
        "old review version remains stale after remount",
        "null file deletion and request/response preserved",
        "functional resolution updates",
        "delayed success and identical retyping protected",
        "reset/success affect only current group",
        "prior state immutable",
      ],
      scope: "State helper; browser checks are separate.",
    },
    null,
    2,
  ),
);
console.log(
  "PASS integration drafts: stable work-group scope, retained review version, file choices, reset and late-completion protection.",
);
