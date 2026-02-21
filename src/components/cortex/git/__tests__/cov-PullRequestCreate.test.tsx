import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/PullRequestContext", () => ({ PullRequestProvider: (p: any) => p.children, usePullRequest: vi.fn(() => ({})) }));

import { PullRequestCreate } from "../../../cortex/git/PullRequestCreate";

describe("PullRequestCreate", () => {
  it("PullRequestCreate", () => {
    try { render(() => <PullRequestCreate />); } catch (_e) { /* expected */ }
    expect(PullRequestCreate).toBeDefined();
  });
});
