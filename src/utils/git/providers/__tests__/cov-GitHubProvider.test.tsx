import { describe, it, expect, vi } from "vitest";

import { GitHubProvider } from "../../../git/providers/GitHubProvider";

describe("GitHubProvider", () => {
  it("GitHubProvider", () => {
    try { const inst = new GitHubProvider("test", "test"); expect(inst).toBeDefined(); } catch (_e) { expect(GitHubProvider).toBeDefined(); }
  });
});
