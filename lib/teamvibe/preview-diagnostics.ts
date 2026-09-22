export type PreviewDiagnostic = {
  kind: "script" | "promise" | "resource" | "policy";
  message: string;
};

export const previewDiagnosticLimit = 20;
export const diagnosticLabels: Record<PreviewDiagnostic["kind"], string> = {
  script: "스크립트 오류",
  promise: "비동기 실행 오류",
  resource: "파일 불러오기 실패",
  policy: "격리 정책으로 차단",
};

export function readPreviewDiagnostic(
  value: unknown,
  token: string,
): PreviewDiagnostic | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (
    data.type !== "teamvibe.preview.diagnostic" ||
    data.token !== token ||
    typeof data.kind !== "string" ||
    !Object.hasOwn(diagnosticLabels, data.kind) ||
    typeof data.message !== "string" ||
    !data.message.trim()
  )
    return null;
  return {
    kind: data.kind as PreviewDiagnostic["kind"],
    message: data.message.slice(0, 2000),
  };
}

export function previewDiagnosticReport(
  title: string,
  releaseId: string,
  diagnostics: PreviewDiagnostic[],
) {
  return `TeamVibe 미리보기 실행 오류\n릴리스: ${title}\n릴리스 ID: ${releaseId}\n\n${diagnostics.map((item, i) => `${i + 1}. ${diagnosticLabels[item.kind]}: ${item.message}`).join("\n")}\n\n현재 브라우저 실행에서 보고된 최대 20건입니다. 기능 검증 결과나 테스트 통과를 의미하지 않습니다. 외부 요청·서버·로컬 저장소 없이 동작하도록 기존 코드를 확인하세요.`;
}
