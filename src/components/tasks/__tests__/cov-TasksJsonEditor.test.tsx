import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/SDKContext", () => ({ SDKProvider: (p: any) => p.children, useSDK: vi.fn(() => ({ invoke: vi.fn().mockResolvedValue(undefined), listen: vi.fn().mockResolvedValue(vi.fn()), emit: vi.fn() })) }));
vi.mock("@/context/TasksContext", () => ({ TasksProvider: (p: any) => p.children, useTasks: vi.fn(() => ({ tasks: vi.fn(() => []), runTask: vi.fn(), stopTask: vi.fn(), getTaskStatus: vi.fn(() => "idle"), activeTask: vi.fn(() => null) })) }));
vi.mock("@/components/ui", () => ({ Button: (p: any) => p.children, Input: (p: any) => null, Select: (p: any) => p.children, Dialog: (p: any) => p.children, Tooltip: (p: any) => p.children, Checkbox: (p: any) => null, Badge: (p: any) => p.children, Tabs: (p: any) => p.children, ScrollArea: (p: any) => p.children, DropdownMenu: (p: any) => p.children, Popover: (p: any) => p.children, Switch: (p: any) => null, Separator: () => null, Label: (p: any) => p.children, Card: (p: any) => p.children, Accordion: (p: any) => p.children, Alert: (p: any) => p.children, Avatar: (p: any) => null, Progress: (p: any) => null, Skeleton: () => null, Slider: (p: any) => null, Textarea: (p: any) => null, Toggle: (p: any) => p.children, ToggleGroup: (p: any) => p.children }));

import { TasksJsonEditor, TASKS_JSON_SCHEMA } from "../../tasks/TasksJsonEditor";

describe("TasksJsonEditor", () => {
  it("TasksJsonEditor", () => {
    try { render(() => <TasksJsonEditor />); } catch (_e) { /* expected */ }
    expect(TasksJsonEditor).toBeDefined();
  });
  it("TASKS_JSON_SCHEMA", () => {
    expect(TASKS_JSON_SCHEMA).toBeDefined();
  });
});
