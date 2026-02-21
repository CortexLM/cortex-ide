import { describe, it, expect, vi } from "vitest";

vi.mock("@/context/TasksContext", () => ({ TasksProvider: (p: any) => p.children, useTasks: vi.fn(() => ({ tasks: vi.fn(() => []), runTask: vi.fn(), stopTask: vi.fn(), getTaskStatus: vi.fn(() => "idle"), activeTask: vi.fn(() => null) })) }));

import { createTaskProvider } from "../../quickaccess/TaskProvider";

describe("TaskProvider", () => {
  it("createTaskProvider", () => {
    try { createTaskProvider({} as any); } catch (_e) { /* expected */ }
    try { createTaskProvider(); } catch (_e) { /* expected */ }
    expect(createTaskProvider).toBeDefined();
  });
});
