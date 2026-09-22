import type { Project, User } from "./types";

export function requirementSourceOptions(
  project: Project,
  users: User[],
  selectedIds: string[],
  existingIds: string[] = [],
) {
  const options = project.conversations.flatMap((conversation) =>
    conversation.messages
      .filter(
        (message) =>
          (!conversation.deletedAt &&
            !message.deletedAt &&
            message.kind !== "guide") ||
          selectedIds.includes(message.id),
      )
      .map((message) => {
        const archived = conversation.deletedAt || message.deletedAt;
        const author =
          users.find((user) => user.id === message.authorId)?.name ||
          "이전 사용자";
        const snippet =
          message.text.replace(/\s+/g, " ").slice(0, 160) +
          (message.text.replace(/\s+/g, " ").length > 160 ? "…" : "");
        const state = archived
          ? existingIds.includes(message.id)
            ? " · 휴지통의 기존 출처, 유지 또는 해제"
            : " · 휴지통으로 이동됨, 연결 해제 필요"
          : "";
        return {
          value: message.id,
          label: `${conversation.title} · ${author} · ${message.kind === "chatgpt" ? "ChatGPT 응답" : message.kind === "guide" ? "이전 로컬 안내" : "팀원 의견"} · v${message.revision || 1}${state}\n${snippet}`,
        };
      }),
  );
  for (const id of selectedIds)
    if (!options.some((option) => option.value === id))
      options.push({
        value: id,
        label: "원문을 찾을 수 없는 이전 연결 · 연결 해제 필요",
      });
  return options;
}
