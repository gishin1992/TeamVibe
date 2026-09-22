import assert from "node:assert/strict";
import {
  conversationDraftKey as key,
  editConversationDraft as edit,
  completeConversationSend as complete,
} from "../lib/teamvibe/conversation-drafts.ts";

const a = key("jimin", "project-a", "conversation-a");
const b = key("jimin", "project-a", "conversation-b");
const otherProject = key("jimin", "project-b", "conversation-a");
const otherUser = key("seoyeon", "project-a", "conversation-a");
assert.equal(new Set([a, b, otherProject, otherUser]).size, 4);
assert.notEqual(key("a:b", "c", "d"), key("a", "b:c", "d"));

let drafts = edit({}, a, "신청 초안");
const submitted = drafts[a];
drafts = edit(drafts, b, "승인 초안");
drafts = edit(drafts, otherProject, "다른 프로젝트 초안");
drafts = edit(drafts, otherUser, "다른 사용자 초안");
const sent = complete(drafts, a, submitted);
assert.equal(sent[a], undefined);
for (const k of [b, otherProject, otherUser]) assert.equal(sent[k], drafts[k]);
assert.equal(drafts[a].text, "신청 초안", "earlier state remains immutable");

// A deferred response resolves after a new edit and a conversation switch.
let resolve;
const response = new Promise((r) => {
  resolve = r;
});
const request = response.then(() => {
  drafts = complete(drafts, a, submitted);
});
drafts = edit(drafts, a, "전송 중 작성한 다음 내용");
resolve();
await request;
assert.equal(drafts[a].text, "전송 중 작성한 다음 내용");
assert.equal(drafts[b].text, "승인 초안");

// Deleting/retyping the same text must not make an old response erase a new draft.
drafts = edit(drafts, a, "");
drafts = edit(drafts, a, submitted.text);
assert.equal(complete(drafts, a, submitted), drafts);
const beforeFailure = drafts;
await Promise.reject(new Error("synthetic request failure")).then(
  () => {
    drafts = complete(drafts, a, drafts[a]);
  },
  () => {},
);
assert.equal(drafts, beforeFailure);
console.log(
  "PASS conversation drafts: destination/author isolation, deferred success, newer edits, identical retyping, failed-send retention",
);
