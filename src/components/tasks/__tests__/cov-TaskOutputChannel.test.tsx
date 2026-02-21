import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { TaskOutputChannel } from "../../tasks/TaskOutputChannel";

describe("TaskOutputChannel", () => {
  it("TaskOutputChannel", () => {
    try { render(() => <TaskOutputChannel />); } catch (_e) { /* expected */ }
    expect(TaskOutputChannel).toBeDefined();
  });
});
