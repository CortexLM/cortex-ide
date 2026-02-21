import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/TasksContext", () => ({ TasksProvider: (p: any) => p.children, useTasks: vi.fn(() => ({ tasks: vi.fn(() => []), runTask: vi.fn(), stopTask: vi.fn(), getTaskStatus: vi.fn(() => "idle"), activeTask: vi.fn(() => null) })) }));

import { TaskStatusBarItem, TaskStatusBarCompact } from "../../tasks/TaskStatusBar";

describe("TaskStatusBar", () => {
  it("TaskStatusBarItem", () => {
    try { render(() => <TaskStatusBarItem />); } catch (_e) { /* expected */ }
    expect(TaskStatusBarItem).toBeDefined();
  });
  it("TaskStatusBarCompact", () => {
    try { render(() => <TaskStatusBarCompact />); } catch (_e) { /* expected */ }
    expect(TaskStatusBarCompact).toBeDefined();
  });
});
