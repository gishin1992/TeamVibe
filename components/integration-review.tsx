"use client";
import { useState } from "react";
import { PackageCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Project } from "@/lib/teamvibe/types";
import { ResolutionTransfer } from "@/components/resolution-transfer";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createIntegrationDraft,
  type IntegrationDraftEditor,
} from "@/lib/teamvibe/integration-drafts";
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
  analyzeIntegration,
  type FileResolution,
} from "@/lib/teamvibe/integration";

export function IntegrationReview({
  project,
  runIds,
  copy,
  onIntegrate,
  draft,
  onDraftChange,
  onDraftClear,
}: {
  project: Project;
  runIds: string[];
  copy: (text: string) => Promise<void>;
  onIntegrate: (
    title: string,
    resolutions: Record<string, FileResolution>,
    version: number,
    resolutionSource: string,
  ) => Promise<unknown>;
} & IntegrationDraftEditor) {
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [transferKey, setTransferKey] = useState(0);
  const { title, version, resolutions, chosenPaths, resolutionSource } = draft;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const runs = project.runs.filter((r) => runIds.includes(r.id));
  const analysis = analyzeIntegration(project, runs);
  const changed = version !== null && version !== project.version;
  const eligible =
    runs.length === runIds.length &&
    runs.every((r) => !r.deletedAt && r.status === "submitted");
  const unresolved = analysis.conflicts.some(
    (c) =>
      !chosenPaths.includes(c.path) ||
      !resolutions[c.path]?.reason.trim() ||
      resolutions[c.path]?.content === undefined,
  );
  const update = (path: string, value: Partial<FileResolution>) => {
    onDraftChange((current) => ({
      chosenPaths:
        "content" in value
          ? [...new Set([...current.chosenPaths, path])]
          : current.chosenPaths,
      resolutions: {
        ...current.resolutions,
        [path]: {
          content: current.resolutions[path]
            ? current.resolutions[path].content
            : "",
          reason: current.resolutions[path]?.reason ?? "",
          ...value,
        },
      },
    }));
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          setOpen(value);
          if (value && version === null)
            onDraftChange({ version: project.version });
        }
      }}
    >
      <DialogTrigger asChild>
        <button className="button primary" disabled={!runIds.length}>
          <PackageCheck size={16} />
          선택 작업 통합
        </button>
      </DialogTrigger>
      <DialogContent className="integration-dialog" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>선택 작업 통합</DialogTitle>
          <DialogDescription>
            개발 시작 기준, 현재 릴리스와 제출 결과를 비교합니다. 파일 내용이
            충돌하면 사용할 코드와 이유를 직접 정하세요.
          </DialogDescription>
        </DialogHeader>
        <div className="form-field">
          <label htmlFor="integration-title">릴리스 이름</label>
          <input
            id="integration-title"
            value={title}
            disabled={busy}
            onChange={(event) => onDraftChange({ title: event.target.value })}
          />
        </div>
        <p>
          선택 작업 {runs.length}개 · 변경 파일 {analysis.changedPaths.length}개
          · 충돌 {analysis.conflicts.length}개
        </p>
        {runs.some((run) => run.deletedFiles?.length) && (
          <div className="integration-notice">
            <strong>제출된 파일 제외 요청</strong>
            {runs
              .filter((run) => run.deletedFiles?.length)
              .map((run) => (
                <p key={run.id}>
                  {run.title}: {run.deletedFiles!.join(", ")}
                </p>
              ))}
            <p>
              통합한 새 릴리스에서만 제외합니다. 이전 릴리스와 제출 원본은
              보존됩니다. 남은 코드의 파일 참조도 확인하세요.
            </p>
          </div>
        )}
        {analysis.changedPaths.length > 0 && (
          <p className="muted-text">
            충돌 없이 반영:{" "}
            {analysis.changedPaths
              .map(
                (path) =>
                  `${path}${analysis.deletedPaths.includes(path) ? " (제외)" : ""}`,
              )
              .join(", ")}
          </p>
        )}
        {!analysis.conflicts.length && (
          <p className="integration-notice">
            충돌이 없습니다. 변경하지 않은 기존 파일은 그대로 유지합니다. 통합
            후 테스트 랩에서 실제 동작을 검증하세요.
          </p>
        )}
        {!!analysis.conflicts.length && (
          <ResolutionTransfer
            key={transferKey}
            project={project}
            runs={runs}
            busy={busy}
            copy={copy}
            prompt={draft.transferPrompt}
            raw={draft.transferRaw}
            onPromptChange={(transferPrompt) =>
              onDraftChange({ transferPrompt })
            }
            onRawChange={(transferRaw) => onDraftChange({ transferRaw })}
            onBusyChange={setBusy}
            onApply={(plan) => {
              onDraftChange({
                resolutions: plan.resolutions,
                chosenPaths: Object.keys(plan.resolutions),
                resolutionSource: plan.source,
                version: plan.projectVersion,
              });
              setError("");
            }}
          />
        )}
        {resolutionSource && (
          <p className="muted-text">
            해결안 출처: {resolutionSource} · 수동 반입 후 검토
          </p>
        )}
        {analysis.conflicts.map((conflict, index) => (
          <section
            className="integration-conflict"
            key={conflict.path}
            aria-label={`${conflict.path} 충돌 해결`}
          >
            <h3>{conflict.path}</h3>
            <p>
              {conflict.reason === "parallel"
                ? "선택한 작업들이 서로 다른 내용을 제출했습니다."
                : conflict.reason === "unknown"
                  ? "이전 작업에 시작 기준이 기록되지 않았습니다. 현재 파일 변경을 직접 검토하세요."
                  : "작업을 시작한 후 이 파일이 다른 릴리스에서 변경되었습니다."}
            </p>
            <details>
              <summary>현재 릴리스 내용</summary>
              <pre className="code-block">
                {conflict.current ?? "현재 릴리스에 없는 파일"}
              </pre>
            </details>
            {(conflict.current !== undefined ||
              conflict.path !== "index.html") && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  update(conflict.path, { content: conflict.current ?? null })
                }
              >
                {conflict.current === undefined
                  ? "현재처럼 파일 없이 유지"
                  : "현재 릴리스 내용 사용"}
              </button>
            )}
            {conflict.proposals.map((proposal) => (
              <div className="integration-proposal" key={proposal.runId}>
                <strong>{proposal.title}</strong>
                <details>
                  <summary>이 작업의 시작 기준</summary>
                  <pre className="code-block">
                    {proposal.baselineKnown
                      ? (proposal.baseline ?? "시작 시 존재하지 않은 파일")
                      : "기록되지 않음"}
                  </pre>
                </details>
                <details>
                  <summary>제출한 파일 내용</summary>
                  <pre className="code-block">
                    {proposal.content ??
                      "이 파일을 새 릴리스에서 제외하는 요청"}
                  </pre>
                </details>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    update(conflict.path, { content: proposal.content })
                  }
                >
                  {proposal.title}{" "}
                  {proposal.content === null ? "제외 요청 사용" : "결과 사용"}
                </button>
              </div>
            ))}
            {conflict.path !== "index.html" && (
              <label className="inline-actions">
                <Checkbox
                  checked={resolutions[conflict.path]?.content === null}
                  disabled={busy}
                  onCheckedChange={(checked) =>
                    update(conflict.path, {
                      content: checked ? null : (conflict.current ?? ""),
                    })
                  }
                />
                새 릴리스에서 {conflict.path} 제외
              </label>
            )}
            {resolutions[conflict.path]?.content === null && (
              <p className="integration-notice">
                최종 선택: 새 릴리스에서 파일 제외. 이전 릴리스의 파일은
                유지합니다.
              </p>
            )}
            <div className="form-field">
              <label htmlFor={`resolution-${index}`}>
                최종 {conflict.path} 내용
              </label>
              <textarea
                id={`resolution-${index}`}
                className="json-input"
                rows={8}
                disabled={busy || resolutions[conflict.path]?.content === null}
                value={resolutions[conflict.path]?.content ?? ""}
                placeholder="위 내용을 선택하거나 두 변경을 합친 전체 코드를 입력하세요."
                onChange={(event) =>
                  update(conflict.path, { content: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor={`resolution-reason-${index}`}>
                {conflict.path} 해결 근거
              </label>
              <textarea
                id={`resolution-reason-${index}`}
                rows={2}
                disabled={busy}
                value={resolutions[conflict.path]?.reason ?? ""}
                placeholder="어떤 변경을 유지했고 무엇을 다시 검증할지 적으세요."
                onChange={(event) =>
                  update(conflict.path, { reason: event.target.value })
                }
              />
            </div>
          </section>
        ))}
        {changed && (
          <div className="form-error" role="alert">
            팀의 프로젝트가 변경되었습니다. 해결 입력은 유지됩니다. 현재 파일과
            선택 작업을 다시 비교해 주세요.
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                onDraftChange({ version: project.version });
                setError("");
              }}
            >
              최신 내용으로 다시 검토 완료
            </button>
          </div>
        )}
        {!eligible && (
          <p className="form-error" role="alert">
            제출 상태가 변경된 작업이 있습니다. 창을 닫고 통합할 작업을 다시
            선택하세요.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary"
          disabled={busy || changed || !eligible || !title.trim() || unresolved}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const current = Object.fromEntries(
                analysis.conflicts.map((c) => [c.path, resolutions[c.path]]),
              );
              await onIntegrate(
                title,
                current,
                version ?? project.version,
                resolutionSource,
              );
              onDraftClear(draft);
              setOpen(false);
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "통합하지 못했습니다. 입력은 보존됩니다.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "처리 중…" : "검토한 코드로 통합"}
        </button>
        <p className="muted-text">
          통합 입력과 ChatGPT 자료는 이 페이지에서 사용자·프로젝트·선택한 작업
          묶음별로 유지됩니다. 화면에 돌아왔을 때 프로젝트가 바뀌었다면 다시
          검토해야 합니다. 새로고침하면 사라집니다.
        </p>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => setResetOpen(true)}
        >
          통합 입력 초기화
        </button>
        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                작성 중인 통합 내용을 지울까요?
              </AlertDialogTitle>
              <AlertDialogDescription>
                이 작업 묶음의 릴리스 이름, 최종 코드, 해결 근거와 ChatGPT
                자료를 초기화합니다. 제출 원본과 기존 릴리스는 유지됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>계속 검토</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onDraftChange(
                    createIntegrationDraft(
                      project.releases.length + 1,
                      project.version,
                    ),
                  );
                  setTransferKey((value) => value + 1);
                  setError("");
                }}
              >
                초기화
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
