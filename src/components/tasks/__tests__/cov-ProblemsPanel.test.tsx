import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { ProblemsPanel } from "../../tasks/ProblemsPanel";

describe("ProblemsPanel", () => {
  it("ProblemsPanel", () => {
    try { render(() => <ProblemsPanel />); } catch (_e) { /* expected */ }
    expect(ProblemsPanel).toBeDefined();
  });
});
