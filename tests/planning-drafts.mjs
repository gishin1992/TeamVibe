import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  planningDraftKey,
  editPlanningDraft,
  clearPlanningDraft,
} from "../lib/teamvibe/planning-drafts.ts";

const keys = [
  planningDraftKey("jimin", "project-a", "requirements"),
  planningDraftKey("jimin", "project-a", "stories"),
  planningDraftKey("jimin", "project-b", "requirements"),
  planningDraftKey("seoyeon", "project-a", "requirements"),
];
assert.equal(new Set(keys).size, 4);
let drafts = {};
for (const [index, key] of keys.entries())
  drafts = editPlanningDraft(drafts, key, { raw: `response-${index}` });
const previous = structuredClone(drafts);
drafts = editPlanningDraft(drafts, keys[0], {
  prompt: { text: "request-a", version: 3 },
});
assert.equal(drafts[keys[0]].raw, "response-0");
keys.slice(1).forEach((key) => assert.deepEqual(drafts[key], previous[key]));
const submitted = drafts[keys[0]];
drafts = editPlanningDraft(drafts, keys[0], { raw: "newer-response" });
assert.deepEqual(drafts[keys[0]].prompt, submitted.prompt);
assert.equal(clearPlanningDraft(drafts, keys[0], submitted), drafts);
drafts = editPlanningDraft(drafts, keys[0], { raw: submitted.raw });
assert.equal(
  clearPlanningDraft(drafts, keys[0], submitted),
  drafts,
  "Identical retyping is still a newer draft.",
);
const imported = drafts[keys[0]];
const cleared = clearPlanningDraft(drafts, keys[0], imported);
assert.equal(cleared[keys[0]], undefined);
keys.slice(1).forEach((key) => assert.equal(cleared[key], drafts[key]));
const reset = clearPlanningDraft(drafts, keys[1]);
assert.equal(reset[keys[1]], undefined);
assert.equal(reset[keys[0]], drafts[keys[0]]);
assert.equal(drafts[keys[1]].raw, "response-1", "Earlier state is immutable.");
writeFileSync(
  "evidence/planning-drafts-unit-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      passed: true,
      checks: [
        "user/project/kind separation",
        "partial edits preserve paired request or response",
        "late import cannot clear newer or identically retyped draft",
        "success and explicit reset clear only selected draft",
        "immutable prior state",
      ],
      scope: "Page-state helper; actual browser behavior verified separately.",
    },
    null,
    2,
  ),
);
console.log(
  "PASS planning drafts: scoped request/response pairs, explicit reset, and late-import isolation.",
);
