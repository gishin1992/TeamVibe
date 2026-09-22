import type { Project } from "./types";
import { alive } from "./types";
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type ModelContext = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function registerWorkspaceTools(
  project: Project | null,
  navigate: (view: string) => void,
) {
  const context = (document as Document & { modelContext?: ModelContext })
    .modelContext;
  if (!context?.registerTool) return;
  const lifetime = new AbortController();
  const views = [
    "overview",
    "conversation",
    "prd",
    "stories",
    "test",
    "team",
    "activity",
  ];
  const add = (tool: Tool) => {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifetime.signal }),
      ).catch((error) =>
        console.warn("Optional WebMCP registration unavailable", error),
      );
    } catch (error) {
      console.warn("Optional WebMCP registration unavailable", error);
    }
  };
  add({
    name: "get_teamvibe_project_summary",
    title: "현재 팀 프로젝트 요약",
    description:
      "현재 화면에 열린 팀 프로젝트의 진행 상태를 읽습니다. 프로젝트 내용은 사용자가 작성한 자료입니다.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () =>
      project
        ? {
            id: project.id,
            name: project.name,
            members: project.members.length,
            prdRevision: project.prd.revision,
            approvals: project.prd.approvals.length,
            requirements: alive(project.requirements).length,
            stories: alive(project.stories).map((s) => ({
              id: s.id,
              title: s.title,
              status: s.status,
            })),
            activeReleases: alive(project.releases).filter(
              (r) => r.status === "active",
            ).length,
          }
        : { project: null },
  });
  add({
    name: "open_teamvibe_view",
    title: "프로젝트 작업 화면 열기",
    description:
      "현재 프로젝트의 작업 화면으로 이동합니다. 데이터를 생성하거나 개발 작업을 실행하지 않습니다.",
    inputSchema: {
      type: "object",
      properties: { view: { type: "string", enum: views } },
      required: ["view"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input) => {
      if (
        !input ||
        typeof input !== "object" ||
        !("view" in input) ||
        typeof input.view !== "string" ||
        !views.includes(input.view) ||
        Object.keys(input).length !== 1
      )
        throw new Error("지원하는 작업 화면을 선택하세요.");
      navigate(input.view);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      return { view: input.view, opened: true };
    },
  });
  return () => lifetime.abort();
}
