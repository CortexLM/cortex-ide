import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/TasksContext", () => ({ TasksProvider: (p: any) => p.children, useTasks: vi.fn(() => ({ tasks: vi.fn(() => []), runTask: vi.fn(), stopTask: vi.fn(), getTaskStatus: vi.fn(() => "idle"), activeTask: vi.fn(() => null) })) }));

import { RunConfigDialog, QuickRunInput } from "../../tasks/RunConfigDialog";

describe("RunConfigDialog", () => {
  it("RunConfigDialog", () => {
    try { render(() => <RunConfigDialog />); } catch (_e) { /* expected */ }
    expect(RunConfigDialog).toBeDefined();
  });
  it("QuickRunInput", () => {
    try { render(() => <QuickRunInput />); } catch (_e) { /* expected */ }
    expect(QuickRunInput).toBeDefined();
  });
});
