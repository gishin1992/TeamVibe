"use client";
import { useEffect, useRef, useState } from "react";
import { Copy, Plus, RotateCcw } from "lucide-react";
import type { Release } from "@/lib/teamvibe/types";
import { previewDocument } from "@/lib/teamvibe/sandbox";
import {
  diagnosticLabels,
  previewDiagnosticLimit,
  previewDiagnosticReport,
  readPreviewDiagnostic,
  type PreviewDiagnostic,
} from "@/lib/teamvibe/preview-diagnostics";

// The parent keys this component by immutable release identity. Polling and
// renaming a release must not restart the app or discard its in-memory state.
export function PreviewPanel({
  release,
  onRecord,
}: {
  release: Release;
  onRecord: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const files = useRef(release.files);
  const copyRequest = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [execution, setExecution] = useState<{
    token: string;
    document: string;
  } | null>(null);
  const [diagnostics, setDiagnostics] = useState<PreviewDiagnostic[]>([]);
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => {
    const token = crypto.randomUUID();
    let received = 0;
    const receive = (event: MessageEvent) => {
      if (
        !frame.current ||
        event.source !== frame.current.contentWindow ||
        received >= previewDiagnosticLimit
      )
        return;
      const diagnostic = readPreviewDiagnostic(event.data, token);
      if (!diagnostic) return;
      received++;
      copyRequest.current++;
      setCopyStatus("");
      setDiagnostics((items) => [...items, diagnostic]);
    };
    window.addEventListener("message", receive);
    setDiagnostics([]);
    setCopyStatus("");
    setExecution({
      token,
      document: previewDocument(files.current, {
        token,
        parentOrigin: window.location.origin,
      }),
    });
    return () => {
      copyRequest.current++;
      window.removeEventListener("message", receive);
    };
  }, [attempt]);
  return (
    <section className="panel preview-panel">
      <div className="preview-toolbar">
        <span className="local-status">
          <span />
          격리된 로컬 브라우저
        </span>
        <span className="muted-text">외부 네트워크 차단 · 합성 데이터</span>
        <button
          className="text-button"
          onClick={() => setAttempt((value) => value + 1)}
        >
          <RotateCcw size={14} />
          다시 실행
        </button>
      </div>
      {execution ? (
        <iframe
          ref={frame}
          id="artifact-preview"
          title="통합 시스템 테스트 미리보기"
          sandbox="allow-scripts allow-forms"
          srcDoc={execution.document}
          key={execution.token}
        />
      ) : (
        <p className="preview-loading">미리보기를 준비하고 있습니다.</p>
      )}
      <div className="preview-diagnostics">
        <p role="status">
          {diagnostics.length
            ? `현재 실행에서 오류 ${diagnostics.length}건을 감지했습니다.`
            : "아직 보고된 실행 오류가 없습니다. 기능은 직접 확인해 주세요."}
        </p>
        {diagnostics.length > 0 && (
          <details open>
            <summary>실행 오류 내용 {diagnostics.length}개</summary>
            <p className="muted-text">
              오류는 현재 실행 중에만 표시됩니다. 다시 실행하거나 화면을 나가면
              초기화되며 테스트 통과·실패를 자동으로 기록하지 않습니다.
            </p>
            <ol>
              {diagnostics.map((item, index) => (
                <li key={index}>
                  <strong>{diagnosticLabels[item.kind]}</strong>
                  <pre>{item.message}</pre>
                </li>
              ))}
            </ol>
            {diagnostics.length >= previewDiagnosticLimit && (
              <p>
                처음 {previewDiagnosticLimit}건까지만 표시합니다. 원인을 수정한
                뒤 다시 실행해 주세요.
              </p>
            )}
            <button
              className="button secondary"
              onClick={async () => {
                const request = ++copyRequest.current;
                try {
                  await navigator.clipboard.writeText(
                    previewDiagnosticReport(
                      release.title,
                      release.id,
                      diagnostics,
                    ),
                  );
                  if (request === copyRequest.current)
                    setCopyStatus(
                      "오류 내용을 복사했습니다. ChatGPT에 직접 전달해 수정 요청에 사용할 수 있습니다.",
                    );
                } catch {
                  if (request === copyRequest.current)
                    setCopyStatus(
                      "복사하지 못했습니다. 위 오류 문구를 직접 선택해 복사하세요.",
                    );
                }
              }}
            >
              <Copy size={14} />
              오류 내용 복사
            </button>
            {copyStatus && <p role="status">{copyStatus}</p>}
          </details>
        )}
      </div>
      <div className="preview-bottom">
        <p>
          확인한 동작만 테스트 결과로 기록해 주세요. 로컬 저장소·서버·외부
          통신은 지원하지 않습니다.
        </p>
        <button className="button primary" onClick={onRecord}>
          <Plus size={16} />
          실제 테스트 기록
        </button>
      </div>
    </section>
  );
}
