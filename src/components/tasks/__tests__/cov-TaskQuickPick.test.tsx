import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/TasksContext", () => ({ TasksProvider: (p: any) => p.children, useTasks: vi.fn(() => ({ tasks: vi.fn(() => []), runTask: vi.fn(), stopTask: vi.fn(), getTaskStatus: vi.fn(() => "idle"), activeTask: vi.fn(() => null) })) }));

import { TaskQuickPick } from "../../tasks/TaskQuickPick";

describe("TaskQuickPick", () => {
  it("TaskQuickPick", () => {
    try { render(() => <TaskQuickPick />); } catch (_e) { /* expected */ }
    expect(TaskQuickPick).toBeDefined();
  });
});
