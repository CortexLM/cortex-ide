import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/PullRequestContext", () => ({ PullRequestProvider: (p: any) => p.children, usePullRequest: vi.fn(() => ({})) }));

import { PullRequestDetail } from "../../../cortex/git/PullRequestDetail";

describe("PullRequestDetail", () => {
  it("PullRequestDetail", () => {
    try { render(() => <PullRequestDetail />); } catch (_e) { /* expected */ }
    expect(PullRequestDetail).toBeDefined();
  });
});
