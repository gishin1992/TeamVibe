"use client";
import { RequirementHistory } from "@/components/requirement-history";
import { readRunResult, runResultContext } from "@/lib/teamvibe/run-result";
import { storyEditorStatus } from "@/lib/teamvibe/form-conflicts";
import {
  completeIntegrationDraft,
  createIntegrationDraft,
  editIntegrationDraft,
  integrationDraftKey,
  type IntegrationDrafts,
  type IntegrationDraftEditor,
} from "@/lib/teamvibe/integration-drafts";
import {
  clearPlanningDraft,
  editPlanningDraft,
  emptyPlanningDraft,
  planningDraftKey,
  type PlanningDrafts,
  type PlanningDraftEditor,
  type PlanningKind,
} from "@/lib/teamvibe/planning-drafts";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  applyJsonFileValue,
  readJsonFile,
} from "@/lib/teamvibe/json-file-import";
import {
  createRefreshGate,
  mergeWorkspaceSnapshot,
  commitWorkspaceProject,
  type WorkspaceSnapshot,
} from "@/lib/teamvibe/workspace-refresh";
import {
  Layers3,
  LayoutDashboard,
  MessagesSquare,
  FileText,
  GitBranch,
  FlaskConical,
  Users,
  Plus,
  ArrowUpRight,
  Check,
  ArrowRight,
  Sparkles,
  Activity,
  Trash2,
  RotateCcw,
  Copy,
  Download,
  Play,
  Settings2,
  LogOut,
  Send,
  Edit3,
  X,
  AlertTriangle,
  Search,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Toaster, toast } from "sonner";
import {
  alive,
  statusLabel,
  activityLabel,
  collectionLabel,
  type User,
  type Project,
  type Story,
  type Conversation,
  type Requirement,
  type Run,
  type Feedback,
} from "@/lib/teamvibe/types";
import {
  agreed,
  prdStale,
  conversationPrompt,
  storyStartBlockers,
} from "@/lib/teamvibe/domain";
import { standaloneDocument } from "@/lib/teamvibe/sandbox";
import { PreviewPanel } from "@/components/preview-panel";
import { PrdHistory } from "@/components/prd-history";
import { RunResultHistory } from "@/components/run-result-history";
import { registerWorkspaceTools } from "@/lib/teamvibe/webmcp";
import {
  conversationDraftKey,
  editConversationDraft,
  completeConversationSend,
  type ConversationDrafts,
} from "@/lib/teamvibe/conversation-drafts";
import {
  latestFormValues,
  type FormValues,
} from "@/lib/teamvibe/form-conflicts";
import { FormConflict } from "@/components/form-conflict";
import { MessageHistory, RequirementSources } from "@/components/provenance";
import { StoryPlanning } from "@/components/story-planning";
import { IntegrationReview } from "@/components/integration-review";
import { FeedbackPanel } from "@/components/feedback-panel";
import { ProjectPicker } from "@/components/project-picker";
import { RequirementPlanning } from "@/components/requirement-planning";
import { requirementSourceOptions } from "@/lib/teamvibe/source-options";
import { TestResultsPanel } from "@/components/test-results-panel";
import { testCoverageOptions } from "@/lib/teamvibe/test-coverage";
import {
  prdApprovalBlockers,
  requirementSourcesChanged,
} from "@/lib/teamvibe/prd-review";
import { nextProjectWork, type WorkDestination } from "@/lib/teamvibe/workflow";
const navigation = [
  ["overview", "프로젝트 개요", LayoutDashboard],
  ["conversation", "아이디어 대화", MessagesSquare],
  ["prd", "공동 PRD", FileText],
  ["stories", "스토리 보드", GitBranch],
  ["test", "테스트 랩", FlaskConical],
  ["team", "팀 관리", Users],
  ["activity", "활동 기록", Activity],
] as const;
const steps = [
  "아이디어 수집",
  "PRD 검토",
  "스토리 설계",
  "병렬 개발",
  "통합 테스트",
];
const time = (s: string) =>
  new Date(s).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function requestAPI<T = unknown>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
) {
  const r = await fetch("/api/" + path, {
    signal,
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const d = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new ApiError(d.error || "요청에 실패했습니다.", r.status);
  return d;
}
function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("복사했습니다. 외부로 자동 전송되지 않습니다.");
  } catch {
    download("teamvibe-prompt.txt", text);
    toast.info("클립보드 대신 파일로 저장했습니다.");
  }
}
const IconButton = ({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    className="icon-button"
    title={label}
    aria-label={label}
    onClick={onClick}
  >
    {children}
  </button>
);
const Empty = ({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) => (
  <div className="empty-state">
    <Layers3 size={30} />
    <h3>{title}</h3>
    <p>{body}</p>
    {action}
  </div>
);
const Tag = ({ value }: { value: string }) => (
  <span className={"tag tag-" + value}>{statusLabel[value] || value}</span>
);
function NavigationButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuButton
      isActive={active}
      onClick={() => {
        onClick();
        setOpenMobile(false);
      }}
    >
      {children}
    </SidebarMenuButton>
  );
}
type Field = {
  key: string;
  label: string;
  type?: "textarea" | "select" | "json" | "multiselect";
  options?: { value: string; label: string }[];
  emptyLabel?: string;
  hint?: string;
  required?: boolean;
  testContext?: { releaseId: string; resultId?: string };
  storyId?: string;
  memberOptions?: boolean;
};
type FormSpec = {
  title: string;
  description?: string;
  fields: Field[];
  values: Record<string, string>;
  initialValues?: FormValues;
  closeBaseline?: FormValues;
  projectId?: string;
  readLatest?: (project: Project) => FormValues | null;
  save: (v: Record<string, string>, version?: number) => Promise<unknown>;
  version?: number;
  submitLabel?: string;
  deleteAction?: () => void;
};
type BootstrapState = {
  user: User | null;
  users: User[];
  projects: Project[];
};
export default function Workspace() {
  const [user, setUser] = useState<User | null>(null),
    [users, setUsers] = useState<User[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [pid, setPid] = useState(""),
    [tab, setTab] = useState("overview"),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [form, setForm] = useState<FormSpec | null>(null),
    [discardForm, setDiscardForm] = useState(false),
    [busy, setBusy] = useState(false),
    [readingFile, setReadingFile] = useState(false),
    [formError, setFormError] = useState(""),
    [formConflict, setFormConflict] = useState<{
      version: number;
      latest: FormValues | null;
    } | null>(null),
    [confirm, setConfirm] = useState<{
      title: string;
      description?: string;
      action: () => Promise<unknown>;
    } | null>(null),
    [conversationId, setConversationId] = useState(""),
    [conversationDrafts, setConversationDrafts] = useState<ConversationDrafts>(
      {},
    ),
    [planningDrafts, setPlanningDrafts] = useState<PlanningDrafts>({}),
    [integrationDrafts, setIntegrationDrafts] = useState<IntegrationDrafts>({}),
    [sendingMessage, setSendingMessage] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [selectedRuns, setSelectedRuns] = useState<string[]>([]),
    [startingRuns, setStartingRuns] = useState(false),
    [testView, setTestView] = useState("preview"),
    [prdView, setPrdView] = useState("document"),
    [storyView, setStoryView] = useState("board"),
    [activityView, setActivityView] = useState("events"),
    [search, setSearch] = useState("");
  const fileReadSequence = useRef(0);
  const [refreshGate] = useState(createRefreshGate);
  const workspaceSnapshot = useRef<WorkspaceSnapshot | null>(null);
  const api = useCallback(
    async <T = unknown,>(path: string, body?: unknown) => {
      if (body === undefined) return requestAPI<T>(path);
      const finish = refreshGate.beginWrite();
      try {
        return await requestAPI<T>(path, body);
      } finally {
        finish();
      }
    },
    [refreshGate],
  );
  const formBusy = busy || readingFile;
  const p =
    projects.find((p) => p.id === pid) ||
    projects.find((p) => !p.deletedAt) ||
    null;
  const nextWork = p ? nextProjectWork(p, agreed(p)) : null;
  function integrationEditor(): IntegrationDraftEditor {
    const key = integrationDraftKey(user!.id, p!.id, selectedRuns);
    const initial = createIntegrationDraft(p!.releases.length + 1);
    return {
      draft: integrationDrafts[key] || initial,
      onDraftChange: (change) =>
        setIntegrationDrafts((previous) =>
          editIntegrationDraft(previous, key, initial, change),
        ),
      onDraftClear: (submitted) =>
        setIntegrationDrafts((previous) =>
          completeIntegrationDraft(previous, key, submitted),
        ),
    };
  }
  function planningEditor(kind: PlanningKind): PlanningDraftEditor {
    const key = planningDraftKey(user!.id, p!.id, kind);
    return {
      draft: planningDrafts[key] || emptyPlanningDraft,
      onDraftChange: (change) =>
        setPlanningDrafts((previous) =>
          editPlanningDraft(previous, key, change),
        ),
      onDraftClear: (submitted) =>
        setPlanningDrafts((previous) =>
          clearPlanningDraft(previous, key, submitted),
        ),
    };
  }
  function openWork(destination: WorkDestination) {
    if (destination.tab === "prd") setPrdView(destination.section);
    if (destination.tab === "stories") setStoryView(destination.section);
    if (destination.tab === "test") setTestView(destination.section);
    setTab(destination.tab);
  }
  useEffect(() => registerWorkspaceTools(p, setTab), [p]);
  const userById = (id: string) =>
    users.find((u) => u.id === id) || {
      id,
      name: "진행 도우미",
      role: "로컬 규칙",
      color: "blue",
    };
  const applyBootstrap = useCallback((d: BootstrapState) => {
    const next = mergeWorkspaceSnapshot(workspaceSnapshot.current, d);
    workspaceSnapshot.current = next;
    setUser(next.user);
    setUsers(next.users);
    setProjects(next.projects);
    setLoadError("");
    return next;
  }, []);
  const bootstrap = useCallback(async () => {
    const ticket = refreshGate.begin();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const data = await requestAPI<BootstrapState>(
        "bootstrap",
        undefined,
        controller.signal,
      );
      return refreshGate.accepts(ticket) ? applyBootstrap(data) : null;
    } finally {
      clearTimeout(timeout);
    }
  }, [applyBootstrap, refreshGate]);
  useEffect(() => {
    let active = true;
    bootstrap()
      .then((data) => {
        if (!active || !data) return;
        // Restore navigation alongside the initial asynchronous data load.
        try {
          const view = JSON.parse(
            localStorage.getItem("teamvibe-view") || "{}",
          );
          if (typeof view.pid === "string") setPid(view.pid);
          if (navigation.some((n) => n[0] === view.tab)) setTab(view.tab);
        } catch {
          /* Local navigation preferences are optional. */
        }
      })
      .catch((e) => {
        if (active) setLoadError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      refreshGate.invalidate();
    };
  }, [bootstrap, refreshGate]);
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(
          "teamvibe-view",
          JSON.stringify({ pid: p?.id || "", tab }),
        );
      } catch {
        /* Browsers may disable local preferences; server data is unaffected. */
      }
    }
  }, [pid, p?.id, tab, loading]);
  const currentUserId = user?.id;
  useEffect(() => {
    if (!currentUserId) return;
    let inFlight = false;
    const t = setInterval(async () => {
      if (inFlight || !refreshGate.canRead()) return;
      inFlight = true;
      try {
        await bootstrap();
      } catch {
        /* Retry on the next interval. */
      } finally {
        inFlight = false;
      }
    }, 5000);
    return () => clearInterval(t);
  }, [currentUserId, bootstrap, refreshGate]);
  const safe = (fn: () => Promise<unknown>) => {
    void fn().catch((e) => toast.error(e.message));
  };
  async function login(uid: string) {
    await api("session", { userId: uid });
    await bootstrap();
    setPid("");
    setConversationId("");
    setSelected([]);
    setSelectedRuns([]);
    toast.success("시연 프로필을 전환했습니다.");
  }
  async function act(
    type: string,
    data: Record<string, unknown> = {},
    version = p?.version,
  ) {
    if (!p) throw new Error("프로젝트를 선택하세요.");
    const next = await api<Project>("projects/" + p.id, {
      ...data,
      type,
      version,
    });
    const committed = commitWorkspaceProject(
      workspaceSnapshot.current,
      next,
      user?.id,
    );
    if (committed) applyBootstrap(committed);
    return next as Project;
  }
  function openForm(spec: FormSpec) {
    fileReadSequence.current += 1;
    setReadingFile(false);
    setFormError("");
    setFormConflict(null);
    setDiscardForm(false);
    setForm({
      ...spec,
      // Display defaults can differ from the server comparison baseline.
      closeBaseline: { ...spec.values },
      projectId: spec.version !== undefined ? p?.id : undefined,
      initialValues:
        p && spec.readLatest
          ? spec.readLatest(p) || { ...spec.values }
          : { ...spec.values },
    });
  }
  function closeForm() {
    fileReadSequence.current += 1;
    setReadingFile(false);
    setForm(null);
  }
  function requestFormClose() {
    if (!form || formBusy) return;
    const changed = Object.entries(form.values).some(
      ([key, value]) => value !== (form.closeBaseline?.[key] ?? ""),
    );
    if (changed) setDiscardForm(true);
    else closeForm();
  }
  function currentFieldOptions(field: Field): Field {
    if (!form) return field;
    const latest = projects.find((project) => project.id === form.projectId);
    if (latest && field.memberOptions) {
      const options = [
        { value: "", label: "미지정" },
        ...latest.members.map((id) => ({
          value: id,
          label: userById(id).name,
        })),
      ];
      for (const id of new Set([
        form.values[field.key],
        form.initialValues?.[field.key],
        formConflict?.latest?.[field.key],
      ])) {
        if (id && !latest.members.includes(id))
          options.push({
            value: id,
            label: `${userById(id).name} · 현재 팀원이 아님`,
          });
      }
      return { ...field, options };
    }
    if (latest && field.storyId) {
      const story = latest.stories.find((item) => item.id === field.storyId);
      if (story)
        return {
          ...field,
          options: [
            {
              value: "keep",
              label: `현재 상태 유지 · ${statusLabel[story.status]}`,
            },
            ...(field.options || []).filter(
              (option) => option.value !== "keep",
            ),
          ],
        };
    }
    if (field.type !== "multiselect") return field;
    if (latest && field.testContext) {
      const { releaseId, resultId } = field.testContext;
      return {
        ...field,
        options: testCoverageOptions(
          latest,
          releaseId,
          latest.testResults.find(
            (item) => item.id === resultId && !item.deletedAt,
          ),
          [
            ...new Set([
              ...lines(form.values.coverage || ""),
              ...lines(formConflict?.latest?.coverage || ""),
            ]),
          ],
        ),
      };
    }
    if (latest && field.key === "sourceIds")
      return {
        ...field,
        options: requirementSourceOptions(
          latest,
          users,
          [
            ...new Set([
              ...lines(form.values.sourceIds || ""),
              ...lines(formConflict?.latest?.sourceIds || ""),
            ]),
          ],
          [
            ...new Set([
              ...lines(form.initialValues?.sourceIds || ""),
              ...lines(formConflict?.latest?.sourceIds || ""),
            ]),
          ],
        ),
      };
    if (!latest || !["dependencies", "requirementIds"].includes(field.key))
      return field;
    const selectedIds = lines(form.values[field.key] || "");
    const options = (
      field.key === "dependencies"
        ? alive(latest.stories)
        : alive(latest.requirements)
    )
      .filter(
        (item) =>
          field.options?.some((option) => option.value === item.id) ||
          selectedIds.includes(item.id),
      )
      .map((item) => ({
        value: item.id,
        label: `${field.key === "dependencies" ? `US-${alive(latest.stories).findIndex((story) => story.id === item.id) + 1} ` : ""}${item.title} · ${statusLabel[item.status]}`,
      }));
    // Preserve visibility of a selected reference removed while this form was open.
    for (const id of selectedIds.filter(
      (id) => !options.some((option) => option.value === id),
    )) {
      const item = [...latest.stories, ...latest.requirements].find(
        (item) => item.id === id,
      );
      options.push({
        value: id,
        label: `${item?.title || "이전 연결 항목"} · 현재 목록에 없음, 연결 해제 필요`,
      });
    }
    return { ...field, options };
  }
  function formMutation(
    title: string,
    fields: Field[],
    values: Record<string, string>,
    type: string,
    extra: Record<string, unknown> = {},
    transform?: (v: Record<string, string>) => Record<string, unknown>,
    description?: string,
  ) {
    const version = p?.version;
    openForm({
      title,
      description,
      fields,
      values,
      version,
      readLatest: (project) =>
        latestFormValues(project, { ...extra, type }, values),
      save: (v, currentVersion) =>
        act(
          type,
          { ...(transform ? transform(v) : v), ...extra },
          currentVersion ?? version,
        ),
    });
  }
  function remove(collection: string, id: string, title: string) {
    setConfirm({
      title: `“${title}” 항목을 휴지통으로 이동할까요?`,
      action: () => act("item.delete", { collection, id }),
    });
  }
  function projectForm(edit = false) {
    const version = p?.version;
    openForm({
      title: edit ? "프로젝트 설정" : "새 프로젝트",
      version: edit ? version : undefined,
      readLatest: edit
        ? (project) =>
            latestFormValues(
              project,
              { type: "project.edit" },
              { name: "", description: "", goal: "" },
            )
        : undefined,
      fields: [
        { key: "name", label: "프로젝트 이름", required: true },
        { key: "description", label: "해결할 문제", type: "textarea" },
        { key: "goal", label: "팀의 목표", type: "textarea", required: true },
      ],
      values: {
        name: edit ? p!.name : "",
        description: edit ? p!.description : "",
        goal: edit ? p!.goal : "",
      },
      save: async (v, currentVersion) => {
        if (edit) return act("project.edit", v, currentVersion ?? version);
        const next = await api<Project>("projects", v);
        await bootstrap();
        setPid(next.id);
        setTab("overview");
      },
    });
  }
  function joinForm() {
    openForm({
      title: "초대 코드로 참여",
      description: "프로젝트 오너에게 받은 코드를 입력하세요.",
      fields: [{ key: "code", label: "초대 코드", required: true }],
      values: { code: "" },
      save: async (v) => {
        const next = await api<Project>("join", v);
        await bootstrap();
        setPid(next.id);
        setTab("overview");
      },
    });
  }
  function conversationForm(c?: Conversation) {
    openForm({
      title: c ? "대화 제목 수정" : "아이디어 대화 시작",
      fields: [
        { key: "title", label: "어떤 주제를 이야기할까요?", required: true },
      ],
      values: { title: c?.title || "" },
      version: p?.version,
      readLatest: (project) =>
        latestFormValues(
          project,
          { type: "conversation.save", ...(c ? { id: c.id } : {}) },
          { title: c?.title || "" },
        ),
      save: async (v, version) => {
        const next = await act(
          "conversation.save",
          { ...v, ...(c ? { id: c.id } : {}) },
          version,
        );
        setConversationId(c?.id || next.conversations.at(-1)!.id);
        setTab("conversation");
      },
    });
  }
  function requirementForm(
    r?: Requirement,
    source?: { id: string; text: string },
  ) {
    formMutation(
      r ? "요구사항 수정" : "요구사항 등록",
      [
        { key: "title", label: "요구사항 제목", required: true },
        {
          key: "description",
          label: "사용자와 필요한 기능",
          type: "textarea",
          required: true,
        },
        {
          key: "priority",
          label: "우선순위",
          type: "select",
          options: ["must", "should", "could"].map((value) => ({
            value,
            label: statusLabel[value],
          })),
        },
        {
          key: "status",
          label: "검토 상태",
          type: "select",
          options: ["proposed", "accepted", "conflict"].map((value) => ({
            value,
            label: statusLabel[value],
          })),
        },
        {
          key: "sourceIds",
          label: "대화 출처",
          type: "multiselect",
          options: requirementSourceOptions(
            p!,
            users,
            r?.sourceIds || [source?.id].filter((id): id is string => !!id),
            r?.sourceIds,
          ),
          emptyLabel:
            "연결할 대화가 없습니다. 출처 없이 직접 작성할 수도 있습니다.",
          hint: "이름과 원문을 확인해 연결하거나 해제하세요. 새 연결은 현재 버전을 기록하며, 기존 버전은 다시 합의할 때 갱신합니다. 연결 변경 전 내용은 이력에 보존됩니다.",
        },
        {
          key: "decision",
          label: "결정과 근거",
          type: "textarea",
          hint: "합의됨으로 바꿀 때는 합의 내용을 남겨 주세요.",
        },
      ],
      {
        title: r?.title || "",
        description: r?.description || source?.text || "",
        priority: r?.priority || "must",
        status: r?.status || "proposed",
        decision: r?.decision || "",
        sourceIds: (r?.sourceIds || [source?.id].filter(Boolean)).join("\n"),
      },
      "requirement.save",
      {
        ...(r ? { id: r.id } : {}),
      },
      (values) => ({ ...values, sourceIds: lines(values.sourceIds) }),
    );
  }
  function mergeRequirementForm(target: Requirement) {
    const candidates = alive(p!.requirements).filter((r) => r.id !== target.id);
    if (!candidates.length) {
      toast.info("통합할 다른 요구사항이 없습니다.");
      return;
    }
    formMutation(
      "요구사항 통합",
      [
        {
          key: "sourceId",
          label: "합칠 요구사항",
          type: "select",
          options: candidates.map((r) => ({ value: r.id, label: r.title })),
        },
        { key: "title", label: "통합 제목", required: true },
        {
          key: "description",
          label: "통합 후 요구사항 내용",
          type: "textarea",
          required: true,
          hint: candidates
            .map((r) => r.title + ": " + r.description)
            .join("\n"),
        },
        {
          key: "decision",
          label: "통합 근거와 남은 결정 사항",
          type: "textarea",
          required: true,
        },
      ],
      {
        sourceId: candidates[0].id,
        title: target.title,
        description: target.description,
        decision: "",
      },
      "requirement.merge",
      { targetId: target.id },
    );
  }
  function storyOwnerField(): Field {
    return {
      key: "ownerId",
      label: "담당자",
      type: "select",
      memberOptions: true,
      options: [
        { value: "", label: "미지정" },
        ...p!.members.map((id) => ({ value: id, label: userById(id).name })),
      ],
    };
  }
  function storyAssignmentForm(s: Story) {
    formMutation(
      "스토리 담당자 변경",
      [
        {
          ...storyOwnerField(),
          hint: "담당자를 바꾸거나 미지정으로 되돌릴 수 있습니다. 스토리 버전과 진행 상태, 기존 검증 기록 및 개발 요청은 유지됩니다.",
        },
      ],
      { ownerId: s.ownerId },
      "story.assign",
      { id: s.id },
      undefined,
      s.title,
    );
  }
  function storyForm(s?: Story) {
    formMutation(
      s ? "사용자 스토리 수정" : "사용자 스토리 작성",
      [
        { key: "title", label: "스토리 제목", required: true },
        {
          key: "description",
          label: "사용자로서 하고 싶은 일과 이유",
          type: "textarea",
          required: true,
        },
        {
          key: "acceptance",
          label: "완료 조건 (한 줄에 하나)",
          type: "textarea",
          required: true,
        },
        {
          key: "tests",
          label: "테스트 기준 (한 줄에 하나)",
          type: "textarea",
          required: true,
        },
        storyOwnerField(),
        {
          key: "status",
          label: "준비 상태",
          type: "select",
          storyId: s?.id,
          hint: "변경 없이 저장하거나 담당자만 바꾸면 버전과 현재 상태를 유지합니다. 내용·연결·PRD 기준이 바뀌면 새 버전이 되며, 현재 상태 유지를 선택한 검토·완료 작업은 백로그로 돌아갑니다.",
          options: [
            ...(s
              ? [
                  {
                    value: "keep",
                    label: `현재 상태 유지 · ${statusLabel[s.status]}`,
                  },
                ]
              : []),
            { value: "backlog", label: "백로그 · 추가 검토 필요" },
            { value: "ready", label: "개발 준비 · 독립성 검토 완료" },
          ],
        },
        {
          key: "dependencies",
          label: "먼저 완료할 스토리",
          type: "multiselect",
          hint: "선택한 스토리의 통합·테스트가 끝난 후 이 작업을 시작할 수 있습니다. 독립적으로 개발할 수 있으면 비워 두세요.",
          emptyLabel: "먼저 완료할 다른 스토리가 없습니다.",
          options: alive(p!.stories)
            .filter((x) => x.id !== s?.id)
            .map((x) => ({
              value: x.id,
              label: `US-${alive(p!.stories).indexOf(x) + 1} ${x.title} · ${statusLabel[x.status]}`,
            })),
        },
        {
          key: "requirementIds",
          label: "연결 요구사항",
          type: "multiselect",
          hint: "이 스토리로 해결할 요구사항을 선택하세요.",
          emptyLabel:
            "등록된 요구사항이 없습니다. PRD에 직접 연결한 스토리로 저장됩니다.",
          options: alive(p!.requirements).map((x) => ({
            value: x.id,
            label: `${x.title} · ${statusLabel[x.status]}`,
          })),
        },
      ],
      {
        title: s?.title || "",
        description: s?.description || "",
        acceptance: s?.acceptance.join("\n") || "",
        tests: s?.tests.join("\n") || "",
        ownerId: s?.ownerId || "",
        status: storyEditorStatus(s?.status),
        dependencies: s?.dependencies.join("\n") || "",
        requirementIds: s?.requirementIds.join("\n") || "",
      },
      "story.save",
      s ? { id: s.id } : {},
      (v) => ({
        ...v,
        acceptance: lines(v.acceptance),
        tests: lines(v.tests),
        dependencies: lines(v.dependencies),
        requirementIds: lines(v.requirementIds),
      }),
    );
  }
  function runImport(r: Run) {
    formMutation(
      "ChatGPT 개발 결과 가져오기",
      [
        {
          key: "payload",
          label: "결과 JSON",
          type: "json",
          required: true,
          hint: `${r.resultContextRequired ? "개발 요청의 context를 그대로 포함하세요. 다른 프로젝트·작업·버전의 응답은 반입할 수 없습니다." : "이전 형식 작업입니다. context가 없는 응답은 자동으로 작업 일치를 확인할 수 없으므로 내용과 선택한 작업을 직접 확인하세요."} files, log, source가 필요합니다. 파일 생략은 보존이며 제외할 파일만 deletedFiles에 명시하세요.`,
        },
      ],
      {
        payload: JSON.stringify(
          {
            context: runResultContext(p!.id, r),
            files: r.files,
            deletedFiles: r.deletedFiles || [],
            log: r.log,
            source: r.source,
          },
          null,
          2,
        ),
      },
      "run.submit",
      { id: r.id },
      (v) => {
        let raw: unknown;
        try {
          raw = JSON.parse(v.payload);
        } catch {
          throw new Error("JSON 형식을 확인해 주세요. 입력은 보존됩니다.");
        }
        return readRunResult(raw, p!.id, r);
      },
      `${r.title} · 스토리 v${r.storyRevision || 1} · PRD v${r.prdRevision}의 결과를 가져옵니다. 저장 후 별도로 통합을 검토합니다.`,
    );
  }
  function feedbackForm(f?: Feedback) {
    const rel = alive(p!.releases).find((r) => r.status === "active");
    if (!rel && !f) {
      toast.error("활성 릴리스가 필요합니다.");
      return;
    }
    formMutation(
      f ? "피드백 수정" : "테스트 피드백",
      [
        { key: "title", label: "어떤 점을 개선할까요?", required: true },
        {
          key: "body",
          label: "재현 방법과 원하는 결과",
          type: "textarea",
          required: true,
        },
        {
          key: "status",
          label: "상태",
          type: "select",
          options: [
            { value: "open", label: "열림" },
            { value: "resolved", label: "해결됨" },
          ],
        },
        {
          key: "resolutionNote",
          label: "해결 확인 내용 또는 종결 이유",
          type: "textarea",
          hint: "해결됨으로 저장할 때 필수입니다. 확인한 동작이나 종결한 이유를 적어 주세요.",
        },
        {
          key: "resolutionReleaseId",
          label: "확인한 릴리스 (선택)",
          type: "select",
          options: [
            { value: "", label: "지정하지 않음" },
            ...p!.releases.map((release) => ({
              value: release.id,
              label: `${release.title}${release.deletedAt ? " · 휴지통" : release.status === "active" ? " · 현재" : ""}`,
            })),
          ],
        },
      ],
      {
        title: f?.title || "",
        body: f?.body || "",
        status: f?.status || "open",
        resolutionNote:
          f?.status === "resolved"
            ? f.resolutionHistory?.at(-1)?.note || ""
            : "",
        resolutionReleaseId:
          f?.status === "resolved"
            ? f.resolutionHistory?.at(-1)?.releaseId || ""
            : "",
      },
      "feedback.save",
      { releaseId: f?.releaseId || rel!.id, ...(f ? { id: f.id } : {}) },
    );
  }
  function testForm(existing?: Project["testResults"][number]) {
    const rel = existing
      ? p!.releases.find((r) => r.id === existing.releaseId)
      : alive(p!.releases).find((r) => r.status === "active");
    if (!rel) {
      toast.error("활성 릴리스가 필요합니다.");
      return;
    }
    formMutation(
      existing ? "검증 결과 수정" : "실제 테스트 결과 기록",
      [
        { key: "title", label: "테스트 제목", required: true },
        {
          key: "coverage",
          label: "검증한 스토리 테스트 기준",
          type: "multiselect",
          options: testCoverageOptions(p!, rel.id, existing),
          testContext: { releaseId: rel.id, resultId: existing?.id },
          hint: `검증 릴리스: ${rel.title}${rel.deletedAt ? " · 휴지통에 보존됨" : ""}. 실제로 확인한 기준만 선택하세요. 기존 연결은 유지하거나 해제할 수 있으며 과거 기록은 현재 버전의 검증을 대신하지 않습니다.`,
        },
        {
          key: "steps",
          label: "수행한 절차",
          type: "textarea",
          required: true,
        },
        {
          key: "expected",
          label: "기대 결과",
          type: "textarea",
          required: true,
        },
        {
          key: "actual",
          label: "실제로 확인한 결과와 증거",
          type: "textarea",
          required: true,
        },
        {
          key: "status",
          label: "결과",
          type: "select",
          options: ["passed", "failed", "blocked"].map((value) => ({
            value,
            label: statusLabel[value],
          })),
        },
      ],
      {
        title: existing?.title || "",
        coverage: existing?.coverage?.join("\n") || "",
        steps: existing?.steps || "",
        expected: existing?.expected || "",
        actual: existing?.actual || "",
        status: existing?.status || "passed",
      },
      "test.save",
      {
        releaseId: existing?.releaseId || rel.id,
        ...(existing ? { id: existing.id } : {}),
        kind: existing?.kind || "manual",
      },
      (v) => ({ ...v, coverage: lines(v.coverage) }),
    );
  }
  function profileForm(edit = false) {
    openForm({
      title: edit ? "내 시연 프로필" : "시연 프로필 추가",
      description:
        "로컬 테스트용 프로필입니다. 비밀번호가 없는 시연 방식이므로 실제 계정으로 사용하지 마세요.",
      fields: [
        { key: "name", label: "이름", required: true },
        { key: "role", label: "팀에서의 역할", required: true },
      ],
      values: { name: edit ? user!.name : "", role: edit ? user!.role : "" },
      deleteAction: edit
        ? () => {
            setConfirm({
              title:
                "이 시연 프로필을 휴지통으로 이동할까요? 프로필 선택 화면에서 복원할 수 있습니다.",
              description:
                "저장하지 않은 프로필 변경은 반영되지 않습니다. 저장된 프로필은 휴지통에서 복원할 수 있습니다.",
              action: async () => {
                setBusy(true);
                try {
                  await api("users/archive", {});
                  closeForm();
                  await bootstrap();
                } finally {
                  setBusy(false);
                }
              },
            });
          }
        : undefined,
      save: async (v) => {
        if (edit) {
          await api("users/edit", v);
          await bootstrap();
          return;
        }
        const u = await api<User>("users", v);
        await login(u.id);
      },
    });
  }
  function renderOverview() {
    if (!p) return null;
    const reqs = alive(p.requirements),
      stories = alive(p.stories),
      convs = alive(p.conversations);
    const acceptedCount = reqs.filter(
      (requirement) =>
        requirement.status === "accepted" &&
        !requirementSourcesChanged(p, requirement),
    ).length;
    return (
      <>
        <section className="stats">
          {[
            [
              "참여한 팀원",
              p.members.length,
              "명",
              "각자의 관점이 모이고 있어요",
            ],
            [
              "모인 아이디어",
              convs
                .flatMap((c) => alive(c.messages))
                .filter((m) => m.kind === "user").length,
              "개",
              `${convs.length}개의 대화에서 발견했어요`,
            ],
            [
              "정리된 요구사항",
              reqs.length,
              "개",
              `${reqs.length - acceptedCount}개의 검토가 필요해요`,
            ],
            [
              "사용자 스토리",
              stories.length,
              "개",
              `${stories.filter((s) => s.status === "done").length}개 완료 · ${stories.filter((s) => s.status === "developing").length}개 개발 중`,
            ],
          ].map(([label, n, unit, caption]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>
                {n} <small>{unit}</small>
              </strong>
              <p>{caption}</p>
            </div>
          ))}
        </section>
        <div className="overview-grid">
          <section className="panel conversations">
            <div className="panel-heading">
              <div>
                <h2>아이디어가 모이는 곳</h2>
                <p>팀원들의 대화에서 프로젝트의 방향을 찾습니다.</p>
              </div>
              <button
                onClick={() => setTab("conversation")}
                className="text-button"
              >
                대화 보기 <ArrowUpRight size={17} />
              </button>
            </div>
            {convs.slice(0, 3).map((c) => {
              const u = userById(c.ownerId),
                m = alive(c.messages).find((m) => m.kind === "user");
              return (
                <article className="idea" key={c.id}>
                  <span className={"avatar " + u.color}>{u.name[0]}</span>
                  <div>
                    <div className="idea-author">
                      <strong>{u.name}</strong>
                      <span>{u.role}</span>
                      <time>{time(c.createdAt)}</time>
                    </div>
                    <p>{m?.text || "새 대화를 시작했어요."}</p>
                    <button
                      className="idea-tag"
                      onClick={() => {
                        setConversationId(c.id);
                        setTab("conversation");
                      }}
                    >
                      <MessagesSquare size={13} />
                      {c.title}
                    </button>
                  </div>
                </article>
              );
            })}
            {!convs.length && (
              <Empty
                title="첫 아이디어를 나눠 주세요"
                body="불편한 업무와 해결하고 싶은 문제를 편하게 적어 보세요."
              />
            )}
            <button
              className="conversation-add"
              onClick={() => {
                setTab("conversation");
                conversationForm();
              }}
            >
              <Plus size={18} /> 새로운 관점 더하기
            </button>
          </section>
          <section className="panel prd-preview">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">SHARED DOCUMENT</span>
                <h2>함께 다듬는 PRD</h2>
              </div>
              <span className="version">v{p.prd.revision}</span>
            </div>
            <div className="document-icon">
              <FileText size={25} />
              <span>
                {p.name}
                <small>팀의 공통 요구사항 문서</small>
              </span>
            </div>
            <div className="document-line">
              <Check size={16} />
              <span>문제 정의와 프로젝트 목표</span>
              <span className="tiny-status">등록됨</span>
            </div>
            <div className="document-line">
              <Check size={16} />
              <span>
                요구사항 {acceptedCount}/{reqs.length}개 합의
              </span>
              <span className="tiny-status">
                {reqs.length
                  ? acceptedCount === reqs.length
                    ? "합의됨"
                    : "검토 중"
                  : "수집 중"}
              </span>
            </div>
            <div className="document-line">
              <span className="review-dot" />
              <span>공동 문서 동의</span>
              <span className="tiny-status amber">
                {p.prd.approvals.length}/{p.members.length}명
              </span>
            </div>
            <div className="review-callout">
              <MessagesSquare size={17} />
              <div>
                <strong>
                  {agreed(p)
                    ? "팀의 공통 목표가 정리됐어요"
                    : "함께 결정할 내용이 있어요"}
                </strong>
                <p>
                  {agreed(p)
                    ? "모든 팀원이 현재 PRD에 동의했습니다. 스토리와 구현 결과를 함께 확인하세요."
                    : reqs.find((r) => r.status === "conflict")?.decision ||
                      "요구사항을 검토하고 각자의 프로필에서 문서에 동의해 주세요."}
                </p>
              </div>
            </div>
            <button
              className="button secondary full"
              onClick={() => openWork({ tab: "prd", section: "document" })}
            >
              PRD 검토하기 <ArrowRight size={16} />
            </button>
          </section>
        </div>
        <section className="next-work">
          <div className="next-icon">
            <GitBranch size={24} />
          </div>
          <div>
            <h3>{nextWork!.title}</h3>
            <p>{nextWork!.body}</p>
          </div>
          <button
            className="text-button"
            onClick={() => openWork(nextWork!.destination)}
          >
            {nextWork!.label} <ArrowRight size={18} />
          </button>
        </section>
      </>
    );
  }
  function renderConversation() {
    if (!p || !user) return null;
    const convs = alive(p.conversations),
      c =
        convs.find((c) => c.id === conversationId) ||
        convs.find((c) => c.ownerId === user.id) ||
        convs[0];
    const draftKey = c ? conversationDraftKey(user.id, p.id, c.id) : "";
    const draft = conversationDrafts[draftKey];
    const message = draft?.text || "";
    return (
      <div className="conversation-layout">
        <section className="panel conversation-list">
          <div className="panel-heading">
            <h2>
              팀의 대화 <span className="count">{convs.length}</span>
            </h2>
            <IconButton label="새 대화" onClick={() => conversationForm()}>
              <Plus size={19} />
            </IconButton>
          </div>
          {convs.map((conv) => (
            <button
              className={
                "conversation-row " + (conv.id === c?.id ? "selected" : "")
              }
              onClick={() => setConversationId(conv.id)}
              key={conv.id}
            >
              <span className={"avatar " + userById(conv.ownerId).color}>
                {userById(conv.ownerId).name[0]}
              </span>
              <span>
                <strong>{conv.title}</strong>
                <small>
                  {userById(conv.ownerId).name} · {alive(conv.messages).length}
                  개 메시지
                </small>
              </span>
            </button>
          ))}
          {!convs.length && (
            <Empty
              title="함께 대화를 시작해요"
              body="새 대화를 만들어 아이디어를 적으세요."
            />
          )}
          <div className="helper-note">
            <Sparkles size={16} />
            <p>
              로컬 도우미는 정해진 질문을 안내합니다. ChatGPT와 깊이 논의하려면
              작업 묶음을 복사한 뒤 응답을 가져오세요.
            </p>
          </div>
        </section>
        <section className="panel chat-panel">
          {c ? (
            <>
              <div className="panel-heading">
                <div>
                  <h2>{c.title}</h2>
                  <p>{userById(c.ownerId).name}의 대화 · 팀 전체 공개</p>
                </div>
                <div className="inline-actions">
                  <IconButton
                    label="ChatGPT 대화 묶음 복사"
                    onClick={() => safe(() => copy(conversationPrompt(p, c)))}
                  >
                    <Copy size={17} />
                  </IconButton>
                  {c.ownerId === user.id && (
                    <>
                      <IconButton
                        label="대화 제목 수정"
                        onClick={() => conversationForm(c)}
                      >
                        <Edit3 size={16} />
                      </IconButton>
                      <IconButton
                        label="대화 삭제"
                        onClick={() => remove("conversations", c.id, c.title)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </>
                  )}
                </div>
              </div>
              <div className="chat-messages">
                {alive(c.messages).map((m) => (
                  <article className={"chat-message " + m.kind} key={m.id}>
                    <div className="message-meta">
                      <span
                        className={
                          "avatar " +
                          (m.kind === "user"
                            ? userById(m.authorId).color
                            : "blue")
                        }
                      >
                        {m.kind === "user" ? (
                          userById(m.authorId).name[0]
                        ) : (
                          <Sparkles size={16} />
                        )}
                      </span>
                      <strong>
                        {m.kind === "user"
                          ? userById(m.authorId).name
                          : m.kind === "chatgpt"
                            ? "ChatGPT 응답 · 수동 반입"
                            : "로컬 진행 도우미"}
                      </strong>
                      <time>{time(m.createdAt)}</time>
                    </div>
                    <p>{m.text}</p>
                    {m.source && (
                      <small className="source">출처: {m.source}</small>
                    )}
                    <div className="message-actions">
                      <MessageHistory
                        message={m}
                        users={users}
                        canRestore={c.ownerId === user.id}
                        onRestore={(revision) =>
                          setConfirm({
                            title: `메시지 v${revision} 내용을 새 버전으로 복원할까요? 연결된 요구사항은 다시 검토해야 합니다.`,
                            action: () =>
                              act("message.revert", {
                                conversationId: c.id,
                                id: m.id,
                                revision,
                              }),
                          })
                        }
                      />
                      {m.kind !== "guide" && (
                        <button
                          className="text-button"
                          onClick={() =>
                            requirementForm(undefined, {
                              id: m.id,
                              text: m.text,
                            })
                          }
                        >
                          <FileText size={14} />
                          요구사항으로 정리
                        </button>
                      )}
                      {c.ownerId === user.id && m.kind !== "guide" && (
                        <>
                          <IconButton
                            label="메시지 수정"
                            onClick={() =>
                              formMutation(
                                "메시지 수정",
                                [
                                  {
                                    key: "text",
                                    label: "내용",
                                    type: "textarea",
                                    required: true,
                                  },
                                  { key: "source", label: "출처" },
                                ],
                                { text: m.text, source: m.source || "" },
                                "message.save",
                                { id: m.id, conversationId: c.id },
                              )
                            }
                          >
                            <Edit3 size={14} />
                          </IconButton>
                          <IconButton
                            label="메시지 삭제"
                            onClick={() =>
                              setConfirm({
                                title: "메시지를 삭제할까요?",
                                action: () =>
                                  act("message.delete", {
                                    id: m.id,
                                    conversationId: c.id,
                                  }),
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </>
                      )}
                    </div>
                  </article>
                ))}
                {c.ownerId === user.id &&
                  c.messages.some((m) => m.deletedAt) && (
                    <details className="history-row">
                      <summary>
                        삭제한 메시지{" "}
                        {c.messages.filter((m) => m.deletedAt).length}개
                      </summary>
                      {c.messages
                        .filter((m) => m.deletedAt)
                        .map((m) => (
                          <div className="trash-row" key={m.id}>
                            <p>{m.text}</p>
                            <button
                              className="button secondary"
                              onClick={() =>
                                safe(() =>
                                  act("message.restore", {
                                    id: m.id,
                                    conversationId: c.id,
                                  }),
                                )
                              }
                            >
                              복원
                            </button>
                          </div>
                        ))}
                    </details>
                  )}
              </div>
              {c.ownerId === user.id ? (
                <div className="composer">
                  <label className="sr-only" htmlFor="message">
                    아이디어 메시지
                  </label>
                  <textarea
                    id="message"
                    aria-describedby="message-draft-note"
                    value={message}
                    onChange={(e) => {
                      const text = e.target.value;
                      setConversationDrafts((previous) =>
                        editConversationDraft(previous, draftKey, text),
                      );
                    }}
                    placeholder="어떤 업무를 더 편하게 만들고 싶나요?"
                    rows={3}
                  />
                  <p id="message-draft-note" className="muted-text">
                    전송 전 초안은 대화별로 유지됩니다. 새로고침하거나 창을
                    닫으면 사라집니다.
                  </p>
                  <div>
                    <button
                      className="text-button"
                      onClick={() =>
                        formMutation(
                          "ChatGPT 응답 가져오기",
                          [
                            {
                              key: "text",
                              label: "응답 원문",
                              type: "textarea",
                              required: true,
                            },
                            { key: "source", label: "세션 제목 또는 출처" },
                          ],
                          { text: "", source: "" },
                          "message.save",
                          { conversationId: c.id, kind: "chatgpt" },
                        )
                      }
                    >
                      <Plus size={15} />
                      ChatGPT 응답 가져오기
                    </button>
                    <button
                      className="button primary"
                      disabled={!message.trim() || sendingMessage}
                      onClick={() =>
                        safe(async () => {
                          if (!draft || !message.trim() || sendingMessage)
                            return;
                          setSendingMessage(true);
                          try {
                            await act("message.save", {
                              conversationId: c.id,
                              text: message,
                              kind: "user",
                            });
                            setConversationDrafts((previous) =>
                              completeConversationSend(
                                previous,
                                draftKey,
                                draft,
                              ),
                            );
                          } finally {
                            setSendingMessage(false);
                          }
                        })
                      }
                    >
                      <Send size={15} />
                      보내기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="helper-note">
                  팀원의 대화입니다. 자신의 대화를 만들어 관점을 더해 주세요.
                </div>
              )}
            </>
          ) : (
            <Empty
              title="새 대화에서 아이디어를 구체화하세요"
              body="불편한 점, 원하는 흐름, 예외 상황을 남겨 주세요."
              action={
                <button
                  className="button primary"
                  onClick={() => conversationForm()}
                >
                  대화 만들기
                </button>
              }
            />
          )}
        </section>
      </div>
    );
  }
  function renderPRD() {
    if (!p || !user) return null;
    const rs = alive(p.requirements);
    const approvalBlockers = prdApprovalBlockers(p);
    return (
      <Tabs key="prd" value={prdView} onValueChange={setPrdView}>
        {prdStale(p) && (
          <div className="info-banner">
            <AlertTriangle size={20} />
            <p>
              <strong>요구사항이 변경되어 문서 재검토가 필요해요.</strong>
              <br />
              변경 내용을 PRD에 반영해 저장하거나 새 초안을 만든 뒤 다시 동의해
              주세요.
            </p>
          </div>
        )}
        <div className="section-toolbar">
          <TabsList>
            <TabsTrigger
              value="document"
              onClick={() => setPrdView("document")}
            >
              공동 문서
            </TabsTrigger>
            <TabsTrigger
              value="requirements"
              onClick={() => setPrdView("requirements")}
            >
              요구사항 <span className="count">{rs.length}</span>
            </TabsTrigger>
            <TabsTrigger value="history" onClick={() => setPrdView("history")}>
              버전 기록
            </TabsTrigger>
          </TabsList>
          <div className="inline-actions">
            <RequirementPlanning
              key={`${user.id}:${p.id}`}
              {...planningEditor("requirements")}
              project={p}
              users={users}
              copy={copy}
              onImport={async (plan, version) => {
                await act("requirement.import", { plan }, version);
                setPrdView("requirements");
                toast.success(
                  "요구사항 제안을 등록했습니다. 팀과 검토해 주세요.",
                );
              }}
            />
            <button
              className="button secondary"
              onClick={() => requirementForm()}
            >
              <Plus size={16} />
              요구사항 추가
            </button>
          </div>
        </div>
        <TabsContent value="document">
          <div className="prd-layout">
            <section className="panel document-editor">
              <div className="panel-heading">
                <div>
                  <h2>프로젝트 요구사항 문서</h2>
                  <p>
                    v{p.prd.revision} · 문서 내용이나 반영 기준이 바뀌면 다시
                    동의합니다.
                  </p>
                </div>
                <div className="inline-actions">
                  <IconButton
                    label="PRD 다운로드"
                    onClick={() => download("TeamVibe-PRD.md", p.prd.body)}
                  >
                    <Download size={17} />
                  </IconButton>
                  <button
                    className="button secondary"
                    onClick={() =>
                      formMutation(
                        "PRD 편집",
                        [
                          {
                            key: "body",
                            label: "PRD (Markdown)",
                            type: "textarea",
                            required: true,
                          },
                        ],
                        { body: p.prd.body },
                        "prd.save",
                      )
                    }
                  >
                    <Edit3 size={15} />
                    편집
                  </button>
                </div>
              </div>
              {p.prd.body ? (
                <pre className="markdown-document">{p.prd.body}</pre>
              ) : (
                <Empty
                  title="팀의 공통 문서를 만들어 보세요"
                  body="요구사항을 등록한 뒤 초안을 생성하거나 ChatGPT 결과를 붙여넣으세요."
                />
              )}
            </section>
            <aside className="stack">
              <section className="panel padded">
                <h3>문서 검토 현황</h3>
                <p className="muted-text">
                  팀 전체의 동의를 모으면 스토리를 나눌 수 있어요.
                </p>
                <Progress
                  value={(p.prd.approvals.length / p.members.length) * 100}
                />
                <div className="approval-list">
                  {p.members.map((uid) => (
                    <div key={uid}>
                      <span className={"avatar " + userById(uid).color}>
                        {userById(uid).name[0]}
                      </span>
                      <span>{userById(uid).name}</span>
                      <span
                        className={
                          p.prd.approvals.includes(uid)
                            ? "approval yes"
                            : "approval"
                        }
                      >
                        {p.prd.approvals.includes(uid) ? "동의함" : "검토 대기"}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  className="button primary full"
                  disabled={
                    !p.prd.approvals.includes(user.id) &&
                    approvalBlockers.length > 0
                  }
                  onClick={() =>
                    safe(() =>
                      act(
                        p.prd.approvals.includes(user.id)
                          ? "prd.unapprove"
                          : "prd.approve",
                      ),
                    )
                  }
                >
                  {p.prd.approvals.includes(user.id)
                    ? "동의 철회"
                    : "이 버전의 PRD에 동의"}
                </button>
                {approvalBlockers.length > 0 && (
                  <div className="prd-approval-blockers" role="status">
                    <strong>동의 전에 확인할 내용</strong>
                    <ul>
                      {approvalBlockers.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    {rs.some(
                      (requirement) =>
                        requirement.status !== "accepted" ||
                        requirementSourcesChanged(p, requirement),
                    ) && (
                      <button
                        className="text-button"
                        onClick={() => setPrdView("requirements")}
                      >
                        미해결 요구사항 검토
                      </button>
                    )}
                  </div>
                )}
              </section>
              <section className="panel padded">
                <h3>초안 만들기</h3>
                <p className="muted-text">
                  등록된 요구사항을 문서로 묶는 규칙 기반 도구입니다. AI 생성이
                  아니며 팀의 검토가 필요합니다.
                </p>
                <button
                  className="button secondary full"
                  onClick={() =>
                    setConfirm({
                      title:
                        "현재 요구사항으로 새 PRD 초안을 만들까요? 기존 버전은 이력에 보관됩니다.",
                      action: () => act("prd.generate"),
                    })
                  }
                >
                  <FileText size={16} />
                  요구사항으로 초안 만들기
                </button>
                <button
                  className="text-button top-gap"
                  onClick={() =>
                    safe(() =>
                      copy(
                        `팀의 PRD를 검토하고 누락·충돌·테스트 기준을 제안하세요.\n\n${p.prd.body}\n\n요구사항 원문:\n${JSON.stringify(rs, null, 2)}`,
                      ),
                    )
                  }
                >
                  <Copy size={15} />
                  ChatGPT 검토 묶음 복사
                </button>
              </section>
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="requirements">
          <div className="requirement-list">
            {rs.map((r, i) => (
              <article className="panel requirement-card" key={r.id}>
                <div className="card-heading">
                  <span className="mono-id">
                    REQ-{String(i + 1).padStart(3, "0")}
                  </span>
                  <Tag value={r.priority} />
                  <Tag value={r.status} />
                  <div className="push-right inline-actions">
                    <IconButton
                      label={`${r.title} 수정`}
                      onClick={() => requirementForm(r)}
                    >
                      <Edit3 size={16} />
                    </IconButton>
                    <IconButton
                      label={`${r.title} 삭제`}
                      onClick={() => remove("requirements", r.id, r.title)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </div>
                <h3>{r.title}</h3>
                <p>{r.description}</p>
                <RequirementHistory requirement={r} users={users} />
                {r.extractionSource && (
                  <details className="story-planning-source">
                    <summary>요구사항 정리 출처 · 수동 반입</summary>
                    <p>{r.extractionSource.source}</p>
                    {r.extractionSource.reviewNote && (
                      <p>
                        반입 당시 검토할 점: {r.extractionSource.reviewNote}
                      </p>
                    )}
                  </details>
                )}
                {r.decision && (
                  <div
                    className={
                      "decision " + (r.status === "conflict" ? "conflict" : "")
                    }
                  >
                    <MessagesSquare size={16} />
                    {r.decision}
                  </div>
                )}
                <RequirementSources
                  project={p}
                  requirement={r}
                  users={users}
                  onOpenConversation={(id) => {
                    setConversationId(id);
                    setTab("conversation");
                  }}
                />
                <button
                  className="text-button top-gap"
                  onClick={() => mergeRequirementForm(r)}
                >
                  <GitBranch size={14} />
                  다른 요구사항과 통합
                </button>
              </article>
            ))}
            {!rs.length && (
              <Empty
                title="아직 등록된 요구사항이 없어요"
                body="아이디어 대화에서 ‘요구사항으로 정리’를 선택하거나 직접 등록하세요."
              />
            )}
          </div>
        </TabsContent>
        <TabsContent value="history">
          <PrdHistory
            prd={p.prd}
            users={users}
            onRestore={(revision) =>
              setConfirm({
                title: `v${revision} 본문을 새 버전으로 복원할까요? 현재 요구사항과 비교하고 팀원들이 다시 동의해야 합니다.`,
                action: () => act("prd.restore", { revision }),
              })
            }
          />
        </TabsContent>
      </Tabs>
    );
  }
  function renderStories() {
    if (!p || !user) return null;
    const stories = alive(p.stories),
      runs = alive(p.runs);
    const readiness = new Map(
      stories.map((story) => [story.id, storyStartBlockers(p, story)]),
    );
    const blockedSelection = selected
      .map((id) => ({
        id,
        title:
          p.stories.find((story) => story.id === id)?.title ||
          "이전에 선택한 스토리",
        reasons: readiness.get(id) || [
          "선택한 스토리가 휴지통에 있거나 더 이상 이 프로젝트에 없습니다.",
        ],
      }))
      .filter((item) => item.reasons.length > 0);
    return (
      <Tabs key="stories" value={storyView} onValueChange={setStoryView}>
        <div className="section-toolbar">
          <TabsList>
            <TabsTrigger value="board" onClick={() => setStoryView("board")}>
              스토리 보드
            </TabsTrigger>
            <TabsTrigger value="runs" onClick={() => setStoryView("runs")}>
              개발 작업 <span className="count">{runs.length}</span>
            </TabsTrigger>
          </TabsList>
          <div className="inline-actions">
            <button
              className="button secondary"
              onClick={() => safe(() => act("story.generate"))}
            >
              <Sparkles size={16} />
              PRD로 분할 초안
            </button>
            <button className="button primary" onClick={() => storyForm()}>
              <Plus size={16} />
              스토리 추가
            </button>
          </div>
        </div>
        <TabsContent value="board">
          <div className="story-planning-bar">
            <p>
              공동 PRD를 작은 개발 과제로 나누고, 완료 조건과 의존성을 함께
              검토하세요.
            </p>
            <StoryPlanning
              key={`${user.id}:${p.id}`}
              {...planningEditor("stories")}
              project={p}
              users={users}
              copy={copy}
              onImport={async (plan, version) => {
                await act("story.import", { plan }, version);
                toast.success(
                  `${plan.stories.length}개 스토리를 백로그에 등록했습니다.`,
                );
              }}
            />
          </div>
          <div className="info-banner">
            <GitBranch size={20} />
            <p>
              <strong>작게 나누고, 독립적으로 개발하세요.</strong>
              <br />
              완료 조건과 테스트 기준을 검토한 뒤 ‘개발 준비’로 저장하세요. 의존
              작업을 완료한 스토리만 동시에 시작할 수 있습니다.
            </p>
          </div>
          <div className="section-toolbar">
            <span className="muted-text">
              {selected.length}개 선택 · 한 번에 최대 10개 · ChatGPT 수동 전달
            </span>
            <button
              className="button primary"
              disabled={
                !selected.length ||
                selected.length > 10 ||
                blockedSelection.length > 0 ||
                startingRuns
              }
              onClick={() =>
                safe(async () => {
                  setStartingRuns(true);
                  try {
                    await act("run.start", { storyIds: selected });
                    setSelected([]);
                    setStoryView("runs");
                    toast.success(
                      "개발 작업을 만들었습니다. 작업 묶음을 ChatGPT에 직접 전달하세요.",
                    );
                  } finally {
                    setStartingRuns(false);
                  }
                })
              }
            >
              <Play size={16} />
              {startingRuns ? "작업 만드는 중…" : "선택 스토리 병렬 시작"}
            </button>
          </div>
          {selected.length > 10 && (
            <p className="form-error" role="status">
              한 번에 시작할 스토리는 최대 10개입니다. 선택을 줄여 주세요.
            </p>
          )}
          {blockedSelection.length > 0 && (
            <section
              className="story-selection-issues"
              aria-label="선택한 작업의 시작 조건"
              role="status"
            >
              <h3>선택한 스토리의 시작 조건을 다시 확인하세요</h3>
              <p>
                팀의 변경으로 시작 조건이 달라질 수 있습니다. 선택은 유지되며,
                아래 조건을 해결하거나 선택에서 뺄 수 있습니다.
              </p>
              <ul>
                {blockedSelection.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>: {item.reasons.join(" ")}
                  </li>
                ))}
              </ul>
              <button
                className="button secondary"
                onClick={() =>
                  setSelected((values) =>
                    values.filter(
                      (id) => !blockedSelection.some((item) => item.id === id),
                    ),
                  )
                }
              >
                시작할 수 없는 선택 해제
              </button>
            </section>
          )}
          <div className="board">
            {[
              ["backlog", "백로그"],
              ["ready", "개발 준비"],
              ["developing", "개발 중"],
              ["review", "검토 대기"],
              ["done", "완료"],
            ].map(([status, label]) => (
              <section className="board-column" key={status}>
                <h3>
                  <span className={"column-dot " + status} />
                  {label}
                  <span className="count">
                    {stories.filter((s) => s.status === status).length}
                  </span>
                </h3>
                {stories
                  .filter((s) => s.status === status)
                  .map((s) => (
                    <article className="story-card" key={s.id}>
                      <div className="card-heading">
                        <span className="mono-id">
                          US-{stories.indexOf(s) + 1}
                        </span>
                        {status === "ready" && (
                          <Checkbox
                            aria-label={`${s.title} 선택`}
                            checked={selected.includes(s.id)}
                            disabled={
                              startingRuns ||
                              (!selected.includes(s.id) &&
                                !!readiness.get(s.id)?.length)
                            }
                            aria-describedby={
                              readiness.get(s.id)?.length
                                ? `start-blockers-${s.id}`
                                : undefined
                            }
                            onCheckedChange={(checked) =>
                              setSelected((v) =>
                                checked
                                  ? [...v, s.id]
                                  : v.filter((x) => x !== s.id),
                              )
                            }
                          />
                        )}
                        <div className="push-right inline-actions">
                          <IconButton
                            label={`${s.title} 수정`}
                            onClick={() => storyForm(s)}
                          >
                            <Edit3 size={14} />
                          </IconButton>
                          <IconButton
                            label={`${s.title} 삭제`}
                            onClick={() => remove("stories", s.id, s.title)}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </div>
                      </div>
                      <h4>{s.title}</h4>
                      <p>{s.description}</p>
                      <details>
                        <summary>
                          완료 조건 {s.acceptance.length} · 테스트{" "}
                          {s.tests.length}
                        </summary>
                        <ul>
                          {s.acceptance.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                        <strong>테스트 기준</strong>
                        <ul>
                          {s.tests.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                        <small className="break-all">ID: {s.id}</small>
                        {s.planningSource && (
                          <small className="story-planning-source">
                            설계 출처: {s.planningSource.source} · 수동 반입
                          </small>
                        )}
                      </details>
                      {s.dependencies.length > 0 && (
                        <div className="dependency">
                          선행:{" "}
                          {s.dependencies
                            .map(
                              (d) =>
                                stories.find((x) => x.id === d)?.title ||
                                "삭제된 스토리",
                            )
                            .join(", ")}
                        </div>
                      )}
                      {s.prdRevision !== p.prd.revision && (
                        <div className="stale">
                          <AlertTriangle size={13} />
                          PRD 재검토 필요
                        </div>
                      )}
                      {status === "ready" &&
                        (readiness.get(s.id)?.length ? (
                          <div
                            className="story-start-blockers"
                            id={`start-blockers-${s.id}`}
                          >
                            <strong>시작 전 확인</strong>
                            <ul>
                              {readiness.get(s.id)!.map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="story-start-ready">현재 시작 가능</p>
                        ))}
                      <div className="story-footer">
                        <button
                          className="text-button"
                          aria-label={`${s.title} 담당자 변경`}
                          onClick={() => storyAssignmentForm(s)}
                        >
                          {s.ownerId ? userById(s.ownerId).name : "담당 미지정"}
                          <Edit3 size={13} />
                        </button>
                        <span>
                          PRD v{s.prdRevision} · 스토리 v{s.revision || 1}
                        </span>
                      </div>
                      {!!s.assignmentHistory?.length && (
                        <details className="story-assignment-history">
                          <summary>
                            담당 변경 이력 {s.assignmentHistory.length}개
                          </summary>
                          <p>기록이 남은 변경부터 표시합니다.</p>
                          <ol>
                            {s.assignmentHistory
                              .slice()
                              .reverse()
                              .map((entry, index) => (
                                <li key={index}>
                                  <strong>
                                    {entry.from
                                      ? userById(entry.from).name
                                      : "미지정"}{" "}
                                    →{" "}
                                    {entry.to
                                      ? userById(entry.to).name
                                      : "미지정"}
                                  </strong>
                                  <span>
                                    {time(entry.at)} ·{" "}
                                    {userById(entry.authorId).name}
                                  </span>
                                  {entry.reason !== "assigned" && (
                                    <span>
                                      {entry.reason === "member-left"
                                        ? "팀 탈퇴로 담당 해제"
                                        : entry.reason === "member-removed"
                                          ? "팀원 제외로 담당 해제"
                                          : "복원 시 이전 담당자가 팀에 없어 해제"}
                                    </span>
                                  )}
                                </li>
                              ))}
                          </ol>
                        </details>
                      )}
                      {status === "review" && (
                        <button
                          className="text-button"
                          onClick={() =>
                            safe(() => act("story.complete", { id: s.id }))
                          }
                        >
                          <Check size={14} />
                          통합·검증 후 완료
                        </button>
                      )}
                    </article>
                  ))}
                {!stories.some((s) => s.status === status) && (
                  <div className="board-empty">아직 작업이 없어요</div>
                )}
              </section>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="runs">
          <div className="section-toolbar">
            <p className="muted-text">
              작업 묶음 복사 → 각 ChatGPT 세션에서 개발 → 결과 JSON 반입 → 선택
              작업 통합
            </p>
            <IntegrationReview
              key={integrationDraftKey(user.id, p.id, selectedRuns)}
              {...integrationEditor()}
              project={p}
              runIds={selectedRuns}
              copy={copy}
              onIntegrate={async (
                title,
                resolutions,
                version,
                resolutionSource,
              ) => {
                await act(
                  "release.create",
                  {
                    title,
                    resolutions,
                    resolutionSource,
                    runIds: selectedRuns,
                  },
                  version,
                );
                setSelectedRuns([]);
                openWork({ tab: "test", section: "preview" });
                toast.success(
                  "검토한 코드를 통합했습니다. 테스트 랩에서 검증하세요.",
                );
              }}
            />
          </div>
          <p className="muted-text" aria-label="개발 작업 상태 요약">
            전체 {runs.length}개 · 결과 대기{" "}
            {runs.filter((r) => r.status === "running").length}개 · 통합 대기{" "}
            {runs.filter((r) => r.status === "submitted").length}개 · 통합 완료{" "}
            {runs.filter((r) => r.status === "integrated").length}개 · 취소{" "}
            {runs.filter((r) => r.status === "cancelled").length}개
          </p>
          <div className="run-list">
            {runs.map((r) => (
              <article className="panel padded" key={r.id}>
                <div className="card-heading">
                  {r.status === "submitted" && (
                    <Checkbox
                      aria-label={`${r.title} 통합 선택`}
                      checked={selectedRuns.includes(r.id)}
                      onCheckedChange={(c) =>
                        setSelectedRuns((v) =>
                          c ? [...v, r.id] : v.filter((x) => x !== r.id),
                        )
                      }
                    />
                  )}
                  <h3>{r.title}</h3>
                  <Tag value={r.status} />
                  <span className="push-right muted-text">
                    {time(r.createdAt)}
                  </span>
                </div>
                <p className="muted-text">
                  수동 ChatGPT 작업 · PRD v{r.prdRevision} · 스토리 v
                  {r.storyRevision || 1} · {Object.keys(r.files).length}개 파일
                  {r.deletedFiles?.length
                    ? ` · 제외 요청 ${r.deletedFiles.length}개`
                    : ""}
                </p>
                <p className="muted-text">
                  개발 시작 기준:{" "}
                  {r.baseReleaseId === ""
                    ? "새 앱"
                    : r.baseReleaseId
                      ? p.releases.find(
                          (release) => release.id === r.baseReleaseId,
                        )?.title || "이전 릴리스"
                      : "기록되지 않음 · 이전 작업"}
                </p>
                <details className="history-row">
                  <summary>개발 요청과 시작 코드 보기</summary>
                  <pre className="code-block">{r.prompt}</pre>
                </details>
                <div className="inline-actions wrap">
                  <button
                    className="button secondary"
                    onClick={() => safe(() => copy(r.prompt))}
                  >
                    <Copy size={15} />
                    작업 묶음 복사
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => download(`task-${r.id}.txt`, r.prompt)}
                  >
                    <Download size={15} />
                    작업 파일
                  </button>
                  {["running", "submitted"].includes(r.status) && (
                    <>
                      <button
                        className="button primary"
                        onClick={() => runImport(r)}
                      >
                        <Plus size={15} />
                        {r.status === "submitted"
                          ? "제출 결과 수정"
                          : "결과 가져오기"}
                      </button>
                      <button
                        className="text-button danger"
                        onClick={() =>
                          setConfirm({
                            title:
                              "개발 작업을 취소하고 스토리를 개발 준비로 돌릴까요?",
                            action: () => act("run.cancel", { id: r.id }),
                          })
                        }
                      >
                        작업 취소
                      </button>
                    </>
                  )}
                  {r.status === "cancelled" && (
                    <IconButton
                      label="취소 작업 삭제"
                      onClick={() => remove("runs", r.id, r.title)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  )}
                </div>
                <RunResultHistory projectId={p.id} run={r} users={users} />
                {r.log && (
                  <details className="history-row">
                    <summary>수행 로그와 결과 파일 · {r.source}</summary>
                    <pre className="code-block">{r.log}</pre>
                    {!!r.deletedFiles?.length && (
                      <p className="integration-notice">
                        새 릴리스에서 제외 요청: {r.deletedFiles.join(", ")}
                      </p>
                    )}
                    {Object.entries(r.files).map(([name, content]) => (
                      <details key={name}>
                        <summary>{name}</summary>
                        <pre className="code-block">{content}</pre>
                      </details>
                    ))}
                  </details>
                )}
              </article>
            ))}
            {!runs.length && (
              <Empty
                title="아직 시작한 개발 작업이 없어요"
                body="스토리를 개발 준비로 바꾸고, 독립적인 스토리를 선택해 병렬 시작하세요."
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    );
  }
  function renderTests() {
    if (!p) return null;
    const releases = alive(p.releases),
      rel = releases.find((r) => r.status === "active"),
      results = alive(p.testResults),
      feedback = alive(p.feedback);
    return (
      <>
        <div className="section-toolbar">
          <div>
            <h2>통합 결과를 직접 확인하세요</h2>
            <p className="muted-text">
              {rel
                ? `${rel.title} · ${Object.keys(rel.files).length}개 파일 · ${time(rel.createdAt)}`
                : "제출된 개발 작업을 통합하면 테스트 환경이 만들어집니다."}
            </p>
          </div>
          <div className="button-group">
            <button
              className="button secondary"
              disabled={!rel}
              onClick={() =>
                rel &&
                download(
                  "teamvibe-preview.html",
                  standaloneDocument(rel.files, rel.title),
                  "text/html",
                )
              }
            >
              <Download size={16} />
              실행 HTML 저장
            </button>
            <button
              className="button secondary"
              disabled={!rel}
              onClick={() =>
                download(
                  "teamvibe-release.json",
                  JSON.stringify(rel, null, 2),
                  "application/json",
                )
              }
            >
              <Download size={16} />
              코드 묶음 내보내기
            </button>
          </div>
        </div>
        <Tabs key="test" value={testView} onValueChange={setTestView}>
          <TabsList>
            <TabsTrigger value="preview" onClick={() => setTestView("preview")}>
              실행 미리보기
            </TabsTrigger>
            <TabsTrigger value="results" onClick={() => setTestView("results")}>
              검증 기록 {results.length}
            </TabsTrigger>
            <TabsTrigger
              value="feedback"
              onClick={() => setTestView("feedback")}
            >
              팀 피드백 {feedback.length}
            </TabsTrigger>
            <TabsTrigger
              value="releases"
              onClick={() => setTestView("releases")}
            >
              릴리스 이력
            </TabsTrigger>
          </TabsList>
          <TabsContent value="preview">
            {rel ? (
              <PreviewPanel
                key={p.id + ":" + rel.id}
                release={rel}
                onRecord={() => testForm()}
              />
            ) : (
              <Empty
                title="첫 테스트 환경을 기다리고 있어요"
                body="개발 작업의 결과를 가져와 통합하면 여기서 직접 사용할 수 있습니다."
                action={
                  <button
                    className="button primary"
                    onClick={() =>
                      openWork({ tab: "stories", section: "runs" })
                    }
                  >
                    개발 작업으로 이동
                  </button>
                }
              />
            )}
          </TabsContent>
          <TabsContent value="results">
            <div className="section-toolbar">
              <p className="muted-text">
                릴리스별 실제 수행 결과 · 새 기록은 현재 릴리스에 작성합니다.
              </p>
              <button
                className="button primary"
                disabled={!rel}
                onClick={() => testForm()}
              >
                <Plus size={16} />
                테스트 기록
              </button>
            </div>
            <TestResultsPanel
              key={p.id}
              project={p}
              users={users}
              onEdit={testForm}
              onRemove={(result) =>
                remove("testResults", result.id, result.title)
              }
            />
          </TabsContent>
          <TabsContent value="feedback">
            <div className="section-toolbar">
              <p className="muted-text">
                피드백을 후속 사용자 스토리로 연결할 수 있습니다.
              </p>
              <button
                className="button primary"
                disabled={!rel}
                onClick={() => feedbackForm()}
              >
                <Plus size={16} />
                피드백 남기기
              </button>
            </div>
            <FeedbackPanel
              key={p.id}
              project={p}
              users={users}
              onEdit={feedbackForm}
              onRemove={(feedback) =>
                remove("feedback", feedback.id, feedback.title)
              }
              onCreateStory={(feedback) =>
                safe(() => act("feedback.story", { id: feedback.id }))
              }
              onRestoreStory={(story) =>
                safe(() =>
                  act("item.restore", { collection: "stories", id: story.id }),
                )
              }
              onOpenStory={(story) => {
                setTab("stories");
                setStoryView("board");
                storyForm(story);
              }}
            />
          </TabsContent>
          <TabsContent value="releases">
            {releases
              .slice()
              .reverse()
              .map((r) => (
                <article className="panel padded top-gap" key={r.id}>
                  <div className="card-heading">
                    <h3>{r.title}</h3>
                    <IconButton
                      label="릴리스 이름 수정"
                      onClick={() =>
                        formMutation(
                          "릴리스 이름 수정",
                          [
                            {
                              key: "title",
                              label: "릴리스 이름",
                              required: true,
                            },
                          ],
                          { title: r.title },
                          "release.rename",
                          { id: r.id },
                        )
                      }
                    >
                      <Edit3 size={15} />
                    </IconButton>
                    <Tag
                      value={
                        r.status === "active" ? "현재 테스트 중" : "이전 버전"
                      }
                    />
                    <span className="push-right muted-text">
                      {time(r.createdAt)}
                    </span>
                  </div>
                  <p className="muted-text">
                    작업 {r.runIds.length}개 · 파일{" "}
                    {Object.keys(r.files).length}개 · 검증 기록{" "}
                    {
                      alive(p.testResults).filter((t) => t.releaseId === r.id)
                        .length
                    }
                    개
                  </p>
                  {r.resolutionSource && (
                    <p className="muted-text">
                      해결안 출처: {r.resolutionSource} · 수동 반입 후 검토
                    </p>
                  )}
                  {!!r.deletedFiles?.length && (
                    <p className="integration-notice">
                      이 릴리스에서 제외한 파일: {r.deletedFiles.join(", ")} ·
                      이전 릴리스에 원본 보존
                    </p>
                  )}
                  {!!r.resolutions?.length && (
                    <details className="history-row">
                      <summary>파일 충돌 해결 {r.resolutions.length}건</summary>
                      {r.resolutions.map((resolution) => (
                        <div key={resolution.path}>
                          <strong>{resolution.path}</strong>
                          {resolution.action === "delete" && (
                            <span className="tag">파일 제외</span>
                          )}
                          <p className="preserve">{resolution.reason}</p>
                          <small>
                            {userById(resolution.actorId).name} · 선택 작업{" "}
                            {resolution.runIds.length}개
                          </small>
                        </div>
                      ))}
                    </details>
                  )}
                  {r.status !== "active" && (
                    <div className="inline-actions">
                      <button
                        className="button secondary"
                        onClick={() =>
                          safe(() => act("release.activate", { id: r.id }))
                        }
                      >
                        <RotateCcw size={15} />이 버전으로 테스트
                      </button>
                      <IconButton
                        label="이전 릴리스 삭제"
                        onClick={() => remove("releases", r.id, r.title)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  )}
                </article>
              ))}
          </TabsContent>
        </Tabs>
      </>
    );
  }
  function renderTeam() {
    if (!p || !user) return null;
    return (
      <div className="prd-layout">
        <section className="panel padded">
          <h2>함께 만드는 팀</h2>
          <p className="muted-text">
            초대 코드로 참여한 사용자가 문서·작업·결과를 공유합니다.
          </p>
          {p.members.map((uid) => (
            <div className="member-row" key={uid}>
              <span className={"avatar " + userById(uid).color}>
                {userById(uid).name[0]}
              </span>
              <div>
                <strong>{userById(uid).name}</strong>
                <p>{userById(uid).role}</p>
              </div>
              <span className="push-right tag">
                {p.ownerId === uid ? "오너" : "팀원"}
              </span>
              {p.ownerId === user.id && uid !== user.id && (
                <IconButton
                  label={`${userById(uid).name} 팀에서 제외`}
                  onClick={() =>
                    setConfirm({
                      title: `${userById(uid).name}님을 팀에서 제외할까요? 기존 작성 내용은 보존됩니다.`,
                      action: () => act("member.remove", { userId: uid }),
                    })
                  }
                >
                  <X size={16} />
                </IconButton>
              )}
            </div>
          ))}
          {p.ownerId !== user.id && (
            <button
              className="button secondary danger"
              onClick={() =>
                setConfirm({
                  title: "프로젝트에서 나갈까요? 작성한 내용은 팀에 남습니다.",
                  action: async () => {
                    await act("member.leave");
                    await bootstrap();
                    setPid("");
                  },
                })
              }
            >
              프로젝트 나가기
            </button>
          )}
        </section>
        <aside className="stack">
          <section className="panel padded">
            <h3>프로젝트 참여 코드</h3>
            <p className="muted-text">
              다른 브라우저에서 시연 프로필을 선택한 뒤 이 코드를 입력하세요.
            </p>
            <div className="invite-code">{p.inviteCode}</div>
            <button
              className="button primary full"
              onClick={() => safe(() => copy(p.inviteCode))}
            >
              <Copy size={16} />
              코드 복사
            </button>
            {p.ownerId === user.id && (
              <button
                className="text-button top-gap"
                onClick={() =>
                  setConfirm({
                    title: "기존 초대 코드를 만료하고 새 코드를 만들까요?",
                    action: () => act("invite.rotate"),
                  })
                }
              >
                <RotateCcw size={14} />
                초대 코드 재발급
              </button>
            )}
          </section>
          {p.ownerId === user.id && (
            <section className="panel padded">
              <h3>프로젝트 관리</h3>
              <div className="stack top-gap">
                {p.members.length > 1 && (
                  <button
                    className="button secondary"
                    onClick={() =>
                      formMutation(
                        "오너 권한 이전",
                        [
                          {
                            key: "userId",
                            label: "새 프로젝트 오너",
                            type: "select",
                            options: p.members
                              .filter((uid) => uid !== user.id)
                              .map((uid) => ({
                                value: uid,
                                label: userById(uid).name,
                              })),
                          },
                        ],
                        {
                          userId:
                            p.members.find((uid) => uid !== user.id) || "",
                        },
                        "owner.transfer",
                      )
                    }
                  >
                    오너 권한 이전
                  </button>
                )}
                <button
                  className="button secondary"
                  onClick={() => projectForm(true)}
                >
                  <Settings2 size={16} />
                  프로젝트 정보 수정
                </button>
                <button
                  className="button secondary danger"
                  onClick={() =>
                    setConfirm({
                      title:
                        "프로젝트를 휴지통으로 이동할까요? 모든 내용은 보존되며 복원할 수 있습니다.",
                      action: () => act("project.delete"),
                    })
                  }
                >
                  <Trash2 size={16} />
                  프로젝트 삭제
                </button>
              </div>
            </section>
          )}
        </aside>
      </div>
    );
  }
  function renderActivity() {
    if (!p) return null;
    const collections = [
      "conversations",
      "requirements",
      "stories",
      "runs",
      "releases",
      "testResults",
      "feedback",
    ] as const;
    return (
      <Tabs key="activity" value={activityView} onValueChange={setActivityView}>
        <TabsList>
          <TabsTrigger value="events" onClick={() => setActivityView("events")}>
            변경 기록
          </TabsTrigger>
          <TabsTrigger value="trash" onClick={() => setActivityView("trash")}>
            휴지통
          </TabsTrigger>
          <TabsTrigger value="export" onClick={() => setActivityView("export")}>
            제출 자료
          </TabsTrigger>
        </TabsList>
        <TabsContent value="events">
          <section className="panel padded">
            <div className="search-field">
              <Search size={16} />
              <input
                aria-label="활동 검색"
                placeholder="활동·작성자 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {p.events
              .slice()
              .reverse()
              .filter((e) =>
                (
                  e.action +
                  (activityLabel[e.action] || "") +
                  e.detail +
                  userById(e.actorId).name
                ).includes(search),
              )
              .map((e) => (
                <div className="event-row" key={e.id}>
                  <span className={"avatar " + userById(e.actorId).color}>
                    {userById(e.actorId).name[0]}
                  </span>
                  <div>
                    <strong>{userById(e.actorId).name}</strong>
                    <span>{activityLabel[e.action] || e.action}</span>
                    <p>{e.detail}</p>
                  </div>
                  <time>{time(e.at)}</time>
                </div>
              ))}
          </section>
        </TabsContent>
        <TabsContent value="trash">
          <section className="panel padded">
            <h2>삭제한 항목</h2>
            <p className="muted-text">
              삭제는 휴지통 이동이며, 원본과 변경 이력은 보관됩니다.
            </p>
            {p.requirements.some((requirement) => requirement.deletedAt) && (
              <p className="muted-text">
                보관 중 원문이 수정된 요구사항은 검토 대기로 복원됩니다. 이전
                합의는 수정 이력에서 확인할 수 있습니다.
              </p>
            )}
            {collections.flatMap((key) =>
              p[key]
                .filter((x) => x.deletedAt)
                .map((x) => (
                  <div className="trash-row" key={x.id}>
                    <span>
                      <strong>{x.title}</strong>
                      <small>
                        {collectionLabel[key]} · {time(x.deletedAt!)}
                      </small>
                    </span>
                    <button
                      className="button secondary"
                      onClick={() =>
                        safe(() =>
                          act("item.restore", { collection: key, id: x.id }),
                        )
                      }
                    >
                      <RotateCcw size={14} />
                      복원
                    </button>
                  </div>
                )),
            )}
            {!collections.some((key) => p[key].some((x) => x.deletedAt)) && (
              <Empty
                title="휴지통이 비어 있어요"
                body="삭제한 대화, 요구사항, 작업은 이곳에서 복원할 수 있습니다."
              />
            )}
          </section>
        </TabsContent>
        <TabsContent value="export">
          <section className="panel padded">
            <h2>프로젝트 제출 자료</h2>
            <p className="muted-text">
              대화 원문, PRD와 이력, 사용자 스토리, 작업 프롬프트·수행 로그,
              코드 파일, 검증 기록을 함께 보존합니다.
            </p>
            <button
              className="button primary"
              onClick={() =>
                download(
                  `teamvibe-${p.id}.json`,
                  JSON.stringify(
                    {
                      exportedAt: new Date().toISOString(),
                      mode: "local-manual-chatgpt",
                      project: p,
                      team: users.filter((u) => p.members.includes(u.id)),
                    },
                    null,
                    2,
                  ),
                  "application/json",
                )
              }
            >
              <Download size={16} />
              전체 프로젝트 내보내기
            </button>
            <p className="helper-note">
              앱 활동 기록은 사용자의 조작 이력입니다. 실제 Codex 에이전트 세션
              로그는 제출 폴더 evidence/agent-sessions 에 별도로 보존됩니다.
            </p>
          </section>
        </TabsContent>
      </Tabs>
    );
  }
  const currentStep = nextWork?.step || 0;
  const verified =
    !!p &&
    agreed(p) &&
    alive(p.stories).length > 0 &&
    alive(p.stories).every((s) => s.status === "done");
  return (
    <>
      <Toaster
        position="top-center"
        richColors
        closeButton
        mobileOffset={{ top: 76 }}
        toastOptions={{ closeButtonAriaLabel: "알림 닫기" }}
      />
      {loading ? (
        <div className="loading-screen">
          <Layers3 size={32} />
          <h1>TeamVibe</h1>
          <p>팀의 작업 공간을 불러오고 있어요.</p>
        </div>
      ) : loadError ? (
        <div className="loading-screen">
          <h1>작업 공간을 열 수 없습니다</h1>
          <p role="alert">{loadError}</p>
          <button className="button primary" onClick={() => safe(bootstrap)}>
            다시 시도
          </button>
        </div>
      ) : !user ? (
        <main className="login-page">
          <section className="login-intro">
            <div className="brand">
              <span className="brand-mark">
                <Layers3 size={23} />
              </span>
              TeamVibe
            </div>
            <span className="eyebrow">BUILD TOGETHER</span>
            <h1>
              각자의 아이디어가,
              <br />
              우리 팀의 제품으로.
            </h1>
            <p>
              대화에서 요구사항으로.
              <br />
              작은 스토리에서 함께 쓰는 시스템으로.
            </p>
            <div className="login-flow">
              대화 <ArrowRight /> PRD <ArrowRight /> 개발 <ArrowRight /> 테스트
            </div>
            <small>로컬 테스트 환경 · 모든 샘플은 합성 데이터</small>
          </section>
          <section className="login-card">
            <span className="eyebrow">LOCAL DEMO</span>
            <h2>어떤 팀원으로 참여할까요?</h2>
            <p>
              프로필마다 대화와 문서 동의가 따로 기록됩니다.
              <br />
              여러 브라우저로 팀 협업을 시연할 수 있어요.
            </p>
            <div className="login-users">
              {users
                .filter((u) => !u.archived)
                .map((u) => (
                  <button key={u.id} onClick={() => safe(() => login(u.id))}>
                    <span className={"avatar " + u.color}>{u.name[0]}</span>
                    <span>
                      <strong>{u.name}</strong>
                      <small>{u.role}</small>
                    </span>
                    <ArrowRight size={17} />
                  </button>
                ))}
            </div>
            <button
              className="button secondary full"
              onClick={() => profileForm()}
            >
              <Plus size={16} />새 시연 프로필 추가
            </button>
            {users.some((u) => u.archived) && (
              <details className="history-row">
                <summary>삭제한 프로필 복원</summary>
                {users
                  .filter((u) => u.archived)
                  .map((u) => (
                    <div className="trash-row" key={u.id}>
                      <span>{u.name}</span>
                      <button
                        className="button secondary"
                        onClick={() =>
                          safe(async () => {
                            await api("users/restore", { userId: u.id });
                            await bootstrap();
                          })
                        }
                      >
                        복원
                      </button>
                    </div>
                  ))}
              </details>
            )}
            <p className="login-disclaimer">
              실제 계정 인증이 없는 로컬 시연 모드입니다.
              <br />
              비밀번호나 실제 업무 데이터를 입력하지 마세요.
            </p>
          </section>
        </main>
      ) : (
        <SidebarProvider>
          <Sidebar className="vibe-sidebar">
            <SidebarHeader>
              <div className="brand">
                <span className="brand-mark">
                  <Layers3 size={23} />
                </span>
                TeamVibe<span className="beta">BETA</span>
              </div>
              <ProjectPicker
                projects={projects}
                current={p}
                users={users}
                onSelect={(id) => {
                  setPid(id);
                  setConversationId("");
                  setSelected([]);
                  setSelectedRuns([]);
                }}
              />
              <div className="project-quick-actions">
                <button onClick={() => projectForm()}>
                  <Plus size={13} />
                  만들기
                </button>
                <button onClick={joinForm}>
                  <Users size={13} />
                  참여하기
                </button>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <div className="nav-label">프로젝트</div>
              <SidebarMenu>
                {navigation.map(([id, label, Icon]) => (
                  <SidebarMenuItem key={id}>
                    <NavigationButton
                      active={tab === id}
                      onClick={() =>
                        id === "stories"
                          ? openWork({ tab: "stories", section: "board" })
                          : setTab(id)
                      }
                    >
                      <Icon />
                      <span>{label}</span>
                      {id === "conversation" && (
                        <span className="nav-count">
                          {p ? alive(p.conversations).length : 0}
                        </span>
                      )}
                    </NavigationButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
              <div className="sidebar-note">
                <Sparkles size={18} />
                <strong>함께 만드는 다음 단계</strong>
                <p>
                  흩어진 아이디어가
                  <br />
                  하나의 제품이 되는 곳.
                </p>
              </div>
            </SidebarContent>
            <SidebarFooter>
              <div className="local-status">
                <span />
                로컬 테스트 환경
              </div>
              <div className="profile">
                <span className={"avatar " + user.color}>{user.name[0]}</span>
                <button
                  className="profile-edit"
                  onClick={() => profileForm(true)}
                  aria-label="내 프로필 수정"
                >
                  <strong>{user.name}</strong>
                  <small>{user.role}</small>
                </button>
                <IconButton
                  label="시연 프로필 전환"
                  onClick={() =>
                    safe(async () => {
                      await api("logout", {});
                      await bootstrap();
                    })
                  }
                >
                  <LogOut size={17} />
                </IconButton>
              </div>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset>
            <header className="topbar">
              <div className="inline-actions">
                <SidebarTrigger aria-label="메뉴 열기" />
                <span>
                  워크스페이스 <span className="slash">/</span>
                  <b>{navigation.find((n) => n[0] === tab)?.[1]}</b>
                </span>
              </div>
              <div className="top-actions">
                <span className="badge">시연 모드 · 로컬에 저장됨</span>
                <IconButton label="새 프로젝트" onClick={() => projectForm()}>
                  <Plus size={20} />
                </IconButton>
              </div>
            </header>
            <main className="main">
              {!p ? (
                <Empty
                  title="첫 팀 프로젝트를 만들어 보세요"
                  body="함께 해결할 문제와 목표를 적거나, 초대 코드로 참여하세요."
                  action={
                    <div className="inline-actions">
                      <button
                        className="button primary"
                        onClick={() => projectForm()}
                      >
                        프로젝트 만들기
                      </button>
                      <button className="button secondary" onClick={joinForm}>
                        코드로 참여
                      </button>
                    </div>
                  }
                />
              ) : p.deletedAt ? (
                <Empty
                  title="휴지통에 있는 프로젝트입니다"
                  body={`“${p.name}”의 기존 내용은 모두 보관되어 있습니다. 오너가 복원하면 다시 작업할 수 있습니다.`}
                  action={
                    p.ownerId === user.id && (
                      <button
                        className="button primary"
                        onClick={() => safe(() => act("project.restore"))}
                      >
                        <RotateCcw size={16} />
                        프로젝트 복원
                      </button>
                    )
                  }
                />
              ) : (
                <>
                  <div className="project-heading">
                    <div>
                      <div className="eyebrow">
                        TEAM PROJECT{" "}
                        <span>
                          {p.id === "demo-supplies" ? "SAMPLE" : "WORKSPACE"}
                        </span>
                      </div>
                      <h1>{p.name}</h1>
                      <p>{p.description}</p>
                    </div>
                    <button
                      className="button primary"
                      onClick={() => {
                        setTab("conversation");
                        conversationForm();
                      }}
                    >
                      <Plus size={17} />
                      아이디어 추가
                    </button>
                  </div>
                  <div className="project-meta">
                    <div className="avatar-stack">
                      {p.members.slice(0, 5).map((uid) => (
                        <span
                          className={"avatar " + userById(uid).color}
                          key={uid}
                        >
                          {userById(uid).name[0]}
                        </span>
                      ))}
                    </div>
                    <span>
                      {p.members.map((uid) => userById(uid).name).join(", ")}
                    </span>
                    <span className="separator" />
                    <span className="status-pill">
                      {verified
                        ? "스토리 검증 완료"
                        : `${steps[currentStep]} 중`}
                    </span>
                    <span className="meta-right">
                      마지막 업데이트 · {time(p.updatedAt)}
                    </span>
                  </div>
                  <div className="pipeline">
                    {steps.map((s, i) => (
                      <button
                        key={s}
                        className={
                          i === currentStep
                            ? "current"
                            : i < currentStep
                              ? "done"
                              : ""
                        }
                        onClick={() =>
                          openWork(
                            (
                              [
                                { tab: "conversation" },
                                { tab: "prd", section: "document" },
                                { tab: "stories", section: "board" },
                                { tab: "stories", section: "runs" },
                                { tab: "test", section: "preview" },
                              ] satisfies WorkDestination[]
                            )[i],
                          )
                        }
                      >
                        <span className="step-num">
                          {i < currentStep ? (
                            <Check size={16} />
                          ) : (
                            String(i + 1).padStart(2, "0")
                          )}
                        </span>
                        <div>
                          <small>STEP 0{i + 1}</small>
                          <strong>{s}</strong>
                        </div>
                        {i < 4 && (
                          <ArrowRight size={15} className="step-arrow" />
                        )}
                      </button>
                    ))}
                  </div>
                  {tab === "overview"
                    ? renderOverview()
                    : tab === "conversation"
                      ? renderConversation()
                      : tab === "prd"
                        ? renderPRD()
                        : tab === "stories"
                          ? renderStories()
                          : tab === "test"
                            ? renderTests()
                            : tab === "team"
                              ? renderTeam()
                              : renderActivity()}
                  <footer className="page-footer">
                    <span>
                      <Activity size={14} />
                      TeamVibe · 함께 생각하고, 함께 만듭니다.
                    </span>
                    <span>ChatGPT 수동 연계 · 외부 자동 전송 없음</span>
                  </footer>
                </>
              )}
            </main>
          </SidebarInset>
        </SidebarProvider>
      )}
      <Dialog
        open={!!form}
        onOpenChange={(open) => {
          if (!open) requestFormClose();
        }}
      >
        <DialogContent className="form-dialog" showCloseButton={!formBusy}>
          <DialogHeader>
            <DialogTitle>{form?.title}</DialogTitle>
            <DialogDescription>
              {form?.description || "변경 내용은 팀 프로젝트에 저장됩니다."}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <form
              aria-busy={formBusy}
              onSubmit={async (e) => {
                e.preventDefault();
                if (formConflict || formBusy) return;
                setBusy(true);
                setFormError("");
                try {
                  await form.save(form.values, form.version);
                  setDiscardForm(false);
                  closeForm();
                  toast.success("저장했습니다.");
                } catch (e) {
                  setFormError((e as Error).message);
                  const data = await bootstrap().catch(() => null);
                  if (
                    e instanceof ApiError &&
                    e.status === 409 &&
                    form.version !== undefined
                  ) {
                    const latest = data?.projects.find(
                      (project) => project.id === form.projectId,
                    );
                    setFormConflict({
                      version: latest?.version ?? form.version,
                      latest: latest
                        ? (form.readLatest?.(latest) ?? null)
                        : null,
                    });
                  }
                } finally {
                  setBusy(false);
                }
              }}
            >
              <fieldset
                className="form-fields"
                disabled={formBusy || !!formConflict}
              >
                {form.fields.map((field) => {
                  const f = currentFieldOptions(field);
                  return (
                    <div key={f.key} className="form-field">
                      <label htmlFor={`field-${f.key}`}>
                        {f.label}
                        {f.required && <b className="required"> *</b>}
                      </label>
                      {f.type === "multiselect" ? (
                        <div
                          className="check-options"
                          role="group"
                          aria-label={f.label}
                        >
                          {f.options?.map((o) => (
                            <label className="check-option" key={o.value}>
                              <Checkbox
                                aria-label={o.label}
                                checked={lines(
                                  form.values[f.key] || "",
                                ).includes(o.value)}
                                onCheckedChange={(checked) => {
                                  const previous = lines(
                                    form.values[f.key] || "",
                                  );
                                  setForm({
                                    ...form,
                                    values: {
                                      ...form.values,
                                      [f.key]: (checked
                                        ? [...previous, o.value]
                                        : previous.filter((v) => v !== o.value)
                                      ).join("\n"),
                                    },
                                  });
                                }}
                              />
                              <span>{o.label}</span>
                            </label>
                          ))}
                          {!f.options?.length && (
                            <small>
                              {f.emptyLabel || "연결할 테스트 기준이 없습니다."}
                            </small>
                          )}
                        </div>
                      ) : f.type === "textarea" || f.type === "json" ? (
                        <textarea
                          id={`field-${f.key}`}
                          className={f.type === "json" ? "json-input" : ""}
                          value={form.values[f.key] || ""}
                          required={f.required}
                          rows={
                            f.type === "json" ? 14 : f.key === "body" ? 16 : 4
                          }
                          onChange={(e) =>
                            setForm({
                              ...form,
                              values: {
                                ...form.values,
                                [f.key]: e.target.value,
                              },
                            })
                          }
                        />
                      ) : f.type === "select" ? (
                        <NativeSelect
                          id={`field-${f.key}`}
                          value={form.values[f.key] || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              values: {
                                ...form.values,
                                [f.key]: e.target.value,
                              },
                            })
                          }
                        >
                          {f.options?.map((o) => (
                            <NativeSelectOption key={o.value} value={o.value}>
                              {o.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      ) : (
                        <input
                          id={`field-${f.key}`}
                          value={form.values[f.key] || ""}
                          required={f.required}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              values: {
                                ...form.values,
                                [f.key]: e.target.value,
                              },
                            })
                          }
                        />
                      )}{" "}
                      {f.hint && <small>{f.hint}</small>}
                      {f.type === "json" && (
                        <label className="file-import">
                          JSON 파일에서 불러오기
                          <input
                            type="file"
                            accept=".json,application/json"
                            onChange={async (e) => {
                              const input = e.currentTarget;
                              const file = input.files?.[0];
                              input.value = "";
                              if (!file) return;
                              const request = ++fileReadSequence.current;
                              setReadingFile(true);
                              setFormError("");
                              try {
                                const value = await readJsonFile(file);
                                if (fileReadSequence.current !== request)
                                  return;
                                setForm((current) =>
                                  applyJsonFileValue(
                                    current,
                                    form,
                                    f.key,
                                    value,
                                  ),
                                );
                              } catch (error) {
                                if (fileReadSequence.current === request)
                                  setFormError(
                                    error instanceof Error
                                      ? error.message
                                      : "파일을 읽지 못했습니다.",
                                  );
                              } finally {
                                if (fileReadSequence.current === request)
                                  setReadingFile(false);
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </fieldset>
              {readingFile && (
                <p className="helper-note" role="status">
                  파일을 읽고 있습니다. 완료되면 내용을 검토하고 저장하세요.
                </p>
              )}
              {formError && (
                <div className="form-error" role="alert">
                  {formError}
                  {formConflict && (
                    <div className="stack top-gap">
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() =>
                          safe(() => copy(JSON.stringify(form.values, null, 2)))
                        }
                      >
                        내 입력 복사
                      </button>
                      <FormConflict
                        key={formConflict.version}
                        fields={form.fields.map((field) => {
                          const current = currentFieldOptions(field);
                          return {
                            ...current,
                            options: [
                              ...(current.options || []),
                              ...(field.options || []).filter(
                                (option) =>
                                  !current.options?.some(
                                    (latest) => latest.value === option.value,
                                  ),
                              ),
                            ],
                          };
                        })}
                        baseline={form.initialValues || {}}
                        mine={form.values}
                        latest={formConflict.latest}
                        version={formConflict.version}
                        onPrepare={(values) => {
                          setForm({
                            ...form,
                            values,
                            initialValues: formConflict.latest || {},
                            closeBaseline: formConflict.latest || {},
                            version: formConflict.version,
                          });
                          setFormConflict(null);
                          setFormError(
                            "변경 내용을 합쳤습니다. 입력을 검토한 뒤 저장하세요.",
                          );
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="form-footer">
                {form.deleteAction && (
                  <button
                    type="button"
                    className="button secondary danger"
                    disabled={formBusy}
                    onClick={form.deleteAction}
                  >
                    프로필 삭제
                  </button>
                )}
                <button
                  className="button secondary"
                  type="button"
                  disabled={formBusy}
                  onClick={requestFormClose}
                >
                  취소
                </button>
                <button
                  className="button primary"
                  type="submit"
                  disabled={formBusy || !!formConflict}
                >
                  {readingFile
                    ? "파일 읽는 중…"
                    : busy
                      ? "저장 중…"
                      : form.submitLabel || "저장"}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={discardForm} onOpenChange={setDiscardForm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              저장하지 않은 변경 내용을 버릴까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              이 창에서 바꾼 내용은 저장되지 않았습니다. 계속 작성하거나 변경
              내용을 버리고 닫을 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>계속 작성</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDiscardForm(false);
                closeForm();
              }}
            >
              변경 내용 버리기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.description ||
                "변경 이력은 프로젝트에 보관됩니다. 계속 진행하려면 확인을 선택하세요."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) safe(confirm.action);
              }}
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
const lines = (value: string) =>
  value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
