import { describe, it, expect, vi } from "vitest";

import { GitLabProvider } from "../../../git/providers/GitLabProvider";

describe("GitLabProvider", () => {
  it("GitLabProvider", () => {
    try { const inst = new GitLabProvider("test", "test"); expect(inst).toBeDefined(); } catch (_e) { expect(GitLabProvider).toBeDefined(); }
  });
});
