"use client";
import { useState } from "react";
import { Copy } from "lucide-react";
import type { Project, Run } from "@/lib/teamvibe/types";
import {
  resolutionPrompt,
  readResolutionPlan,
  type ResolutionPlan,
} from "@/lib/teamvibe/integration";

export function ResolutionTransfer({
  project,
  runs,
  busy,
  copy,
  onApply,
  prompt,
  raw,
  onPromptChange,
  onRawChange,
  onBusyChange,
}: {
  project: Project;
  runs: Run[];
  busy: boolean;
  copy: (text: string) => Promise<void>;
  onApply: (plan: ResolutionPlan) => void;
  prompt: { text: string; version: number } | null;
  raw: string;
  onPromptChange: (prompt: { text: string; version: number }) => void;
  onRawChange: (raw: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <details className="resolution-transfer">
      <summary>ChatGPT와 충돌 해결하기 · 수동 전달</summary>
      <p>
        아래 요청을 ChatGPT에 직접 전달하세요. 받은 해결안을 검토 양식에 불러온
        뒤 변경 내용과 테스트 항목을 확인합니다.
      </p>
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          const value = resolutionPrompt(project, runs);
          onPromptChange({ text: value, version: project.version });
          try {
            await copy(value);
          } catch {
            setError(
              "복사를 완료하지 못했습니다. 표시된 요청을 직접 선택해 복사하세요.",
            );
          }
        }}
      >
        <Copy size={16} />
        충돌 해결 묶음 복사
      </button>
      {prompt && (
        <div className="form-field">
          <label htmlFor="resolution-prompt">
            ChatGPT에 전달할 충돌 해결 요청
          </label>
          <textarea
            id="resolution-prompt"
            readOnly
            rows={6}
            value={prompt.text}
          />
          {prompt.version !== project.version && (
            <p className="form-error">
              요청 이후 프로젝트가 바뀌었습니다. 최신 충돌 해결 묶음을 다시
              만들어 검토하세요.
            </p>
          )}
        </div>
      )}
      <div className="form-field">
        <label htmlFor="resolution-json">ChatGPT 해결안 JSON</label>
        <textarea
          id="resolution-json"
          className="json-input"
          rows={6}
          disabled={busy}
          value={raw}
          placeholder="projectId, projectVersion, activeReleaseId, runIds, source, resolutions를 포함한 응답"
          onChange={(event) => {
            onRawChange(event.target.value);
            setError("");
            setMessage("");
          }}
        />
      </div>
      <label className="file-import">
        해결안 JSON 파일 불러오기
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            onBusyChange(true);
            try {
              if (file.size > 3600000)
                throw new Error("3.6 MB 이내의 해결안 파일을 선택하세요.");
              const value = await file.text();
              if (value.length > 1200000)
                throw new Error("해결안 JSON은 1,200,000자 이내로 입력하세요.");
              onRawChange(value);
              setError("");
              setMessage("");
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "파일을 읽지 못했습니다.",
              );
            } finally {
              input.value = "";
              onBusyChange(false);
            }
          }}
        />
      </label>
      <button
        className="button secondary"
        disabled={busy || !raw.trim()}
        onClick={() => {
          try {
            const plan = readResolutionPlan(raw, project, runs);
            onApply(plan);
            setError("");
            setMessage(
              `${Object.keys(plan.resolutions).length}개 파일의 해결안을 아래 검토 양식에 채웠습니다. 아직 통합하지 않았습니다.`,
            );
          } catch (error) {
            setError(
              error instanceof Error ? error.message : "해결안을 확인하세요.",
            );
            setMessage("");
          }
        }}
      >
        해결안을 검토 양식에 채우기
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="integration-notice" role="status">
          {message}
        </p>
      )}
    </details>
  );
}
