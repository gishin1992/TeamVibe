import type { TestResult, TestResultValues } from "./types";

export function testResultValues(result: TestResult): TestResultValues {
  return {
    releaseId: result.releaseId,
    coverage: [...(result.coverage || [])],
    coverageSnapshots: (result.coverageSnapshots || []).map((item) => ({
      ...item,
    })),
    title: result.title,
    steps: result.steps,
    expected: result.expected,
    actual: result.actual,
    status: result.status,
    kind: result.kind,
  };
}
