// Unsent text lives only in this page's memory, scoped to its author and destination.
export type ConversationDraft = { text: string };
export type ConversationDrafts = Record<string, ConversationDraft>;

export function conversationDraftKey(
  userId: string,
  projectId: string,
  conversationId: string,
) {
  return JSON.stringify([userId, projectId, conversationId]);
}

export function editConversationDraft(
  drafts: ConversationDrafts,
  key: string,
  text: string,
): ConversationDrafts {
  return { ...drafts, [key]: { text } };
}

export function completeConversationSend(
  drafts: ConversationDrafts,
  key: string,
  submitted: ConversationDraft,
): ConversationDrafts {
  // Even editing back to identical text is a new draft. A late response may only
  // clear the exact snapshot submitted, never a newer edit or another conversation.
  if (drafts[key] !== submitted) return drafts;
  const next = { ...drafts };
  delete next[key];
  return next;
}
