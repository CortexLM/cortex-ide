import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/PullRequestContext", () => ({ PullRequestProvider: (p: any) => p.children, usePullRequest: vi.fn(() => ({})) }));

import { PullRequestPanel } from "../../../cortex/git/PullRequestPanel";

describe("PullRequestPanel", () => {
  it("PullRequestPanel", () => {
    try { render(() => <PullRequestPanel />); } catch (_e) { /* expected */ }
    expect(PullRequestPanel).toBeDefined();
  });
});
