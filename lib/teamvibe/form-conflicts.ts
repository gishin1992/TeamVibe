import type { Operation, Project } from "./types";

export function storyEditorStatus(
  status?: Project["stories"][number]["status"],
): string {
  if (!status || status === "backlog") return "backlog";
  return status === "ready" ? "ready" : "keep";
}

export type FormValues = Record<string, string>;
export type FieldComparison = {
  key: string;
  before: string;
  mine: string;
  latest: string;
  conflict: boolean;
  merged: string;
};

export function compareFields(
  baseline: FormValues,
  mine: FormValues,
  latest: FormValues,
): FieldComparison[] {
  return Object.keys(mine).map((key) => {
    const before = baseline[key] ?? "";
    const local = mine[key] ?? "";
    const remote = latest[key] ?? before;
    return {
      key,
      before,
      mine: local,
      latest: remote,
      conflict: local !== before && remote !== before && local !== remote,
      merged: local === before ? remote : local,
    };
  });
}

// Read only fields represented by the editor. Missing/deleted targets cannot
// be rebased; newly created items keep their draft values across project edits.
export function latestFormValues(
  project: Project,
  operation: Operation,
  template: FormValues,
): FormValues | null {
  if (project.deletedAt) return null;
  let entity: object | undefined;
  if (operation.type === "project.edit") entity = project;
  else if (operation.type === "prd.save") entity = project.prd;
  else if (operation.type === "message.save" && operation.id) {
    const conversation = project.conversations.find(
      (c) => c.id === operation.conversationId && !c.deletedAt,
    );
    entity = conversation?.messages.find(
      (m) => m.id === operation.id && !m.deletedAt,
    );
    if (!entity) return null;
  } else {
    const collections = {
      "conversation.save": "conversations",
      "requirement.save": "requirements",
      "requirement.merge": "requirements",
      "story.save": "stories",
      "story.assign": "stories",
      "run.submit": "runs",
      "release.rename": "releases",
      "test.save": "testResults",
      "feedback.save": "feedback",
    } as const;
    const collection = collections[operation.type as keyof typeof collections];
    const key = operation.id || operation.targetId;
    if (collection && key) {
      entity = project[collection].find(
        (item) => item.id === key && !item.deletedAt,
      );
      if (!entity) return null;
    }
  }
  if (!entity) return { ...template };
  const record = entity as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(template).map(([key, fallback]) => {
      if (key === "payload" && operation.type === "run.submit") {
        return [
          key,
          JSON.stringify(
            {
              context: {
                projectId: project.id,
                runId: record.id,
                storyId: record.storyId,
                storyRevision: record.storyRevision || 1,
                prdRevision: record.prdRevision,
                baseReleaseId: record.baseReleaseId ?? null,
              },
              files: record.files,
              ...(record.deletedFiles
                ? { deletedFiles: record.deletedFiles }
                : {}),
              log: record.log,
              source: record.source,
            },
            null,
            2,
          ),
        ];
      }
      if (key === "status" && operation.type === "story.save") {
        return [
          key,
          storyEditorStatus(
            record.status as Project["stories"][number]["status"],
          ),
        ];
      }
      if (
        operation.type === "feedback.save" &&
        ["resolutionNote", "resolutionReleaseId"].includes(key)
      ) {
        const history = record.resolutionHistory as
          { note: string; releaseId: string }[] | undefined;
        const latest =
          record.status === "resolved" ? history?.at(-1) : undefined;
        return [
          key,
          key === "resolutionNote"
            ? latest?.note || ""
            : latest?.releaseId || "",
        ];
      }
      const value = record[key];
      return [
        key,
        Array.isArray(value)
          ? value.join("\n")
          : typeof value === "string"
            ? value
            : fallback,
      ];
    }),
  );
}
