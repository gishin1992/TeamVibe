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
import { agreed } from "@/lib/teamvibe/domain";
import {
  readStoryPlan,
  storyPlanPrompt,
  validateStoryPlan,
  type StoryPlan,
} from "@/lib/teamvibe/story-plan";
import type { Project, User } from "@/lib/teamvibe/types";
import type { PlanningDraftEditor } from "@/lib/teamvibe/planning-drafts";
import { PlanningDraftControls } from "@/components/planning-draft-controls";

export function StoryPlanning({
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
  onImport: (plan: StoryPlan, version: number) => Promise<unknown>;
} & PlanningDraftEditor) {
  const [open, setOpen] = useState(false);
  const { raw, prompt } = draft;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<{
    plan: StoryPlan;
    version: number;
  } | null>(null);
  const ready = agreed(project);
  const changed = !!review && review.version !== project.version;
  function inspect() {
    try {
      if (!ready)
        throw new Error("모든 팀원이 최신 PRD에 동의한 후 가져오세요.");
      setReview({
        plan: validateStoryPlan(readStoryPlan(raw), project),
        version: project.version,
      });
      setError("");
    } catch (error) {
      setReview(null);
      setError(error instanceof Error ? error.message : "입력을 확인하세요.");
    }
  }
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
          ChatGPT로 스토리 설계
        </button>
      </DialogTrigger>
      <DialogContent className="story-plan-dialog" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>ChatGPT로 스토리 설계</DialogTitle>
          <DialogDescription>
            합의된 PRD를 ChatGPT에 직접 전달하고 응답을 가져오세요. 검토 후
            백로그로 등록하며 기존 스토리는 유지됩니다.
          </DialogDescription>
        </DialogHeader>
        {!ready && (
          <p className="form-error" role="alert">
            최신 PRD에 모든 팀원의 동의가 필요합니다.
          </p>
        )}
        <div className="story-plan-transfer">
          <strong>1. 설계 요청 전달</strong>
          <button
            className="button secondary"
            disabled={!ready || busy}
            onClick={async () => {
              const value =
                prompt?.version === project.version
                  ? prompt.text
                  : storyPlanPrompt(project, crypto.randomUUID());
              onDraftChange({
                prompt: { text: value, version: project.version },
              });
              try {
                await copy(value);
              } catch {
                setError("복사하지 못했습니다. 다시 시도해 주세요.");
              }
            }}
          >
            <Copy size={15} />
            스토리 설계 묶음 복사
          </button>
          <p>
            별도 ChatGPT 대화에 붙여넣으세요. 자동 전송이나 AI 실행은 하지
            않습니다.
          </p>
        </div>
        {prompt && (
          <details className="form-field">
            <summary>설계 요청 내용 보기 · 직접 선택해 복사</summary>
            <label htmlFor="story-plan-prompt">
              ChatGPT에 전달할 설계 요청
            </label>
            <textarea
              id="story-plan-prompt"
              readOnly
              rows={7}
              value={prompt.text}
            />
            {prompt.version !== project.version && (
              <p className="form-error">
                요청 이후 프로젝트가 바뀌었습니다. 설계 묶음을 다시 복사하면
                최신 요청을 만들 수 있습니다.
              </p>
            )}
          </details>
        )}
        <div className="form-field">
          <label htmlFor="story-plan-json">2. 스토리 설계 JSON</label>
          <textarea
            id="story-plan-json"
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
            스토리 설계 파일 불러오기
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
                  readStoryPlan(value);
                  onDraftChange({ raw: value });
                  setReview(null);
                  setError("");
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "파일을 읽지 못했습니다.",
                  );
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
            팀의 프로젝트가 변경되었습니다. 입력을 유지했으니 ‘내용 검토’를 다시
            눌러 최신 내용과 확인하세요.
          </p>
        )}
        {review && (
          <section
            className="story-plan-review"
            aria-label="가져올 스토리 검토"
          >
            <h3>
              3. 스토리 {review.plan.stories.length}개 검토 · PRD v
              {review.plan.prdRevision}
            </h3>
            <p>출처: {review.plan.source}</p>
            {review.plan.stories.map((story) => (
              <article key={story.key}>
                <h4>{story.title}</h4>
                <p>{story.description}</p>
                <strong>완료 조건</strong>
                <ul>
                  {story.acceptance.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <strong>테스트 기준</strong>
                <ul>
                  {story.tests.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>
                  선행:{" "}
                  {[
                    ...story.dependencies.map(
                      (key) =>
                        review.plan.stories.find((s) => s.key === key)!.title,
                    ),
                    ...story.existingDependencies.map(
                      (id) =>
                        project.stories.find((s) => s.id === id)?.title || id,
                    ),
                  ].join(", ") || "없음 · 독립 개발 후보"}
                </p>
                <p>
                  요구사항:{" "}
                  {story.requirementIds
                    .map(
                      (id) =>
                        project.requirements.find((r) => r.id === id)?.title ||
                        id,
                    )
                    .join(", ") || "PRD 직접 연결"}
                </p>
                <p>
                  담당:{" "}
                  {users.find((u) => u.id === story.ownerId)?.name || "미지정"}
                </p>
              </article>
            ))}
            <p>
              내용과 파일 경계를 확인한 뒤 등록하세요. 등록한 스토리는 보드에서
              수정하거나 휴지통으로 이동할 수 있습니다.
            </p>
          </section>
        )}
        <div className="inline-actions story-plan-actions">
          <button
            className="button secondary"
            disabled={!raw.trim() || busy || !ready}
            onClick={inspect}
          >
            내용 검토
          </button>
          <button
            className="button primary"
            disabled={!review || changed || busy || !ready}
            onClick={async () => {
              if (!review) return;
              setBusy(true);
              setError("");
              try {
                await onImport(review.plan, review.version);
                onDraftClear(draft);
                setReview(null);
                setOpen(false);
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "저장하지 못했습니다. 입력은 보존됩니다.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Import size={16} />
            {busy
              ? "처리 중…"
              : `${review?.plan.stories.length || 0}개 백로그로 등록`}
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
