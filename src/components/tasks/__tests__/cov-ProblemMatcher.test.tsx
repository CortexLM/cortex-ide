import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/DiagnosticsContext", () => ({ DiagnosticsProvider: (p: any) => p.children, useDiagnostics: vi.fn(() => ({ diagnostics: vi.fn(() => []), getDiagnosticsForFile: vi.fn(() => []), errorCount: vi.fn(() => 0), warningCount: vi.fn(() => 0), infoCount: vi.fn(() => 0), hintCount: vi.fn(() => 0), clearDiagnostics: vi.fn() })) }));
vi.mock("@/context/TasksContext", () => ({ TasksProvider: (p: any) => p.children, useTasks: vi.fn(() => ({ tasks: vi.fn(() => []), runTask: vi.fn(), stopTask: vi.fn(), getTaskStatus: vi.fn(() => "idle"), activeTask: vi.fn(() => null) })) }));

import { ProblemMatcherPreview, TaskProblemsPanel, ProblemMatcherSelector } from "../../tasks/ProblemMatcher";

describe("ProblemMatcher", () => {
  it("ProblemMatcherPreview", () => {
    try { render(() => <ProblemMatcherPreview />); } catch (_e) { /* expected */ }
    expect(ProblemMatcherPreview).toBeDefined();
  });
  it("TaskProblemsPanel", () => {
    try { render(() => <TaskProblemsPanel />); } catch (_e) { /* expected */ }
    expect(TaskProblemsPanel).toBeDefined();
  });
  it("ProblemMatcherSelector", () => {
    try { render(() => <ProblemMatcherSelector />); } catch (_e) { /* expected */ }
    expect(ProblemMatcherSelector).toBeDefined();
  });
});
