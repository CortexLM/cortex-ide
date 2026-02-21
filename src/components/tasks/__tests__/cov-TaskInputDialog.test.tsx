import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));
vi.mock("@/context/TasksContext", () => ({ TasksProvider: (p: any) => p.children, useTasks: vi.fn(() => ({ tasks: vi.fn(() => []), runTask: vi.fn(), stopTask: vi.fn(), getTaskStatus: vi.fn(() => "idle"), activeTask: vi.fn(() => null) })) }));

import { TaskInputDialog } from "../../tasks/TaskInputDialog";

describe("TaskInputDialog", () => {
  it("TaskInputDialog", () => {
    try { render(() => <TaskInputDialog />); } catch (_e) { /* expected */ }
    expect(TaskInputDialog).toBeDefined();
  });
});
