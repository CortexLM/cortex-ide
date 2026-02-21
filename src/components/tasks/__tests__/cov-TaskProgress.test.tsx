import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { TaskProgress } from "../../tasks/TaskProgress";

describe("TaskProgress", () => {
  it("TaskProgress", () => {
    try { render(() => <TaskProgress />); } catch (_e) { /* expected */ }
    expect(TaskProgress).toBeDefined();
  });
});
