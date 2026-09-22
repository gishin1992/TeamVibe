"use client";
import { useState } from "react";
import { Copy, Import, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  requirementMessages,
  requirementPlanPrompt,
  readRequirementPlan,
  validateRequirementPlan,
  type RequirementPlan,
} from "@/lib/teamvibe/requirement-plan";
import { statusLabel, type Project, type User } from "@/lib/teamvibe/types";
import type { PlanningDraftEditor } from "@/lib/teamvibe/planning-drafts";
import { PlanningDraftControls } from "@/components/planning-draft-controls";

export function RequirementPlanning({
  project,
  users,
  copy,
  onImport,
  draft,
  onDraftChange,
  onDraftClear,
}: {
  project: Project;
  users: User[];
  copy: (value: string) => Promise<void>;
  onImport: (plan: RequirementPlan, version: number) => Promise<unknown>;
} & PlanningDraftEditor) {
  const [open, setOpen] = useState(false);
  const { raw, prompt } = draft;
  const [review, setReview] = useState<RequirementPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messages = requirementMessages(project);
  const changed = !!review && review.projectVersion !== project.version;
  const showError = (error: unknown) =>
    setError(error instanceof Error ? error.message : "입력을 확인하세요.");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <button className="button secondary">
          <Sparkles size={16} />
          ChatGPT로 요구사항 정리
        </button>
      </DialogTrigger>
      <DialogContent className="story-plan-dialog" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>ChatGPT로 요구사항 정리</DialogTitle>
          <DialogDescription>
            팀의 대화를 직접 전달하고 응답을 검토해 요구사항으로 등록하세요.
            자동 전송이나 팀 합의는 하지 않습니다.
          </DialogDescription>
        </DialogHeader>
        <section className="story-plan-transfer">
          <strong>1. 팀 대화로 요청 만들기</strong>
          <p>
            현재 사용자 대화·ChatGPT 응답 {messages.length}개와 기존 요구사항을
            포함합니다. 로컬 도우미와 휴지통 원문은 제외합니다.
          </p>
          <button
            className="button secondary"
            disabled={!messages.length || busy}
            onClick={() => {
              try {
                onDraftChange({
                  prompt: {
                    text: requirementPlanPrompt(project, crypto.randomUUID()),
                    version: project.version,
                  },
                });
                setError("");
              } catch (error) {
                showError(error);
              }
            }}
          >
            최신 요구사항 정리 요청 만들기
          </button>
          {!messages.length && (
            <p>먼저 아이디어 대화에 업무 문제와 필요한 기능을 남겨 주세요.</p>
          )}
        </section>
        {prompt && (
          <div className="form-field">
            <label htmlFor="requirement-plan-prompt">
              ChatGPT에 전달할 요구사항 정리 요청
            </label>
            <textarea
              id="requirement-plan-prompt"
              readOnly
              rows={6}
              value={prompt.text}
            />
            {prompt.version !== project.version && (
              <p className="form-error">
                요청 이후 팀의 프로젝트가 바뀌었습니다. 최신 요청을 다시 만들어
                주세요.
              </p>
            )}
            <button
              className="button secondary"
              disabled={busy || prompt.version !== project.version}
              onClick={async () => {
                try {
                  await copy(prompt.text);
                } catch (error) {
                  showError(error);
                }
              }}
            >
              <Copy size={15} />
              요구사항 정리 요청 복사
            </button>
          </div>
        )}
        <div className="form-field">
          <label htmlFor="requirement-plan-json">2. 요구사항 제안 JSON</label>
          <textarea
            id="requirement-plan-json"
            className="json-input"
            rows={7}
            value={raw}
            disabled={busy}
            placeholder="ChatGPT의 JSON 응답을 붙여넣으세요."
            onChange={(event) => {
              onDraftChange({ raw: event.target.value });
              setReview(null);
              setError("");
            }}
          />
          <label className="file-import">
            요구사항 제안 파일 불러오기
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                if (!file) return;
                setBusy(true);
                setReview(null);
                try {
                  if (file.size > 800000)
                    throw new Error("800 KB 이내의 JSON 파일을 선택하세요.");
                  const value = await file.text();
                  readRequirementPlan(value);
                  onDraftChange({ raw: value });
                  setError("");
                } catch (error) {
                  showError(error);
                } finally {
                  input.value = "";
                  setBusy(false);
                }
              }}
            />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {changed && (
          <p className="form-error" role="alert">
            검토 후 팀의 프로젝트가 변경되었습니다. 입력은 보존했습니다. 최신
            요청으로 다시 정리해 주세요.
          </p>
        )}
        {review && (
          <section
            className="story-plan-review"
            aria-label="가져올 요구사항 검토"
          >
            <h3>3. 요구사항 {review.requirements.length}개 검토</h3>
            <p>응답 출처: {review.source}</p>
            {review.requirements.map((r) => (
              <article key={r.key}>
                <h4>{r.title}</h4>
                <p>{r.description}</p>
                <p>
                  {statusLabel[r.priority]} · {statusLabel[r.status]}
                </p>
                {r.reviewNote && (
                  <p>
                    <strong>검토할 점:</strong> {r.reviewNote}
                  </p>
                )}
                <details>
                  <summary>대화 근거 {r.sourceRefs.length}개 확인</summary>
                  {r.sourceRefs.map((ref) => {
                    const m = messages.find(
                      (message) => message.messageId === ref.messageId,
                    );
                    return (
                      <blockquote
                        className="requirement-source-quote"
                        key={ref.messageId}
                      >
                        <strong>
                          {m?.conversationTitle || "현재 원문 없음"} ·{" "}
                          {users.find((u) => u.id === m?.authorId)?.name ||
                            "이전 사용자"}{" "}
                          · v{ref.revision}
                        </strong>
                        {m?.kind === "chatgpt" && (
                          <small>ChatGPT 응답 · 수동 반입 원문</small>
                        )}
                        <p>
                          {m?.revision === ref.revision
                            ? m.text
                            : "원문이 삭제되거나 변경됐습니다. 최신 요청을 다시 만들어 주세요."}
                        </p>
                      </blockquote>
                    );
                  })}
                </details>
              </article>
            ))}
            <p>
              반입한 항목은 팀이 수정·합의·통합하거나 휴지통으로 이동할 수
              있습니다. 기존 요구사항과 PRD 원문은 유지하고 문서 동의는 다시
              받습니다.
            </p>
          </section>
        )}
        <div className="inline-actions story-plan-actions">
          <button
            className="button secondary"
            disabled={busy || !raw.trim()}
            onClick={() => {
              try {
                setReview(
                  validateRequirementPlan(readRequirementPlan(raw), project),
                );
                setError("");
              } catch (error) {
                setReview(null);
                showError(error);
              }
            }}
          >
            내용 검토
          </button>
          <button
            className="button primary"
            disabled={!review || changed || busy}
            onClick={async () => {
              if (!review) return;
              setBusy(true);
              setError("");
              try {
                await onImport(review, review.projectVersion);
                onDraftClear(draft);
                setReview(null);
                setOpen(false);
              } catch (error) {
                showError(error);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Import size={16} />
            {busy
              ? "처리 중…"
              : `${review?.requirements.length || 0}개 요구사항으로 등록`}
          </button>
        </div>
        <PlanningDraftControls
          hasDraft={!!raw || !!prompt}
          busy={busy}
          onClear={() => {
            onDraftClear();
            setReview(null);
            setError("");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
