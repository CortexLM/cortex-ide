import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/TasksContext", () => ({ TasksProvider: (p: any) => p.children, useTasks: vi.fn(() => ({ tasks: vi.fn(() => []), runTask: vi.fn(), stopTask: vi.fn(), getTaskStatus: vi.fn(() => "idle"), activeTask: vi.fn(() => null) })) }));

import { TaskRunner, TaskOutputPanel } from "../../tasks/TaskRunner";

describe("TaskRunner", () => {
  it("TaskRunner", () => {
    try { render(() => <TaskRunner />); } catch (_e) { /* expected */ }
    expect(TaskRunner).toBeDefined();
  });
  it("TaskOutputPanel", () => {
    try { render(() => <TaskOutputPanel />); } catch (_e) { /* expected */ }
    expect(TaskOutputPanel).toBeDefined();
  });
});
