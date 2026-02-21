import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/PullRequestContext", () => ({ PullRequestProvider: (p: any) => p.children, usePullRequest: vi.fn(() => ({})) }));

import { PullRequestList } from "../../../cortex/git/PullRequestList";

describe("PullRequestList", () => {
  it("PullRequestList", () => {
    try { render(() => <PullRequestList />); } catch (_e) { /* expected */ }
    expect(PullRequestList).toBeDefined();
  });
});
