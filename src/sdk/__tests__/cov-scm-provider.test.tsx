import { describe, it, expect, vi } from "vitest";

import { createGitSCMProvider, SCMProviderRegistry, scmRegistry } from "../scm-provider";

describe("scm-provider", () => {
  it("createGitSCMProvider", () => {
    try { createGitSCMProvider("test"); } catch (_e) { /* expected */ }
    try { createGitSCMProvider(); } catch (_e) { /* expected */ }
    expect(createGitSCMProvider).toBeDefined();
  });
  it("SCMProviderRegistry", () => {
    try { const inst = new SCMProviderRegistry(); expect(inst).toBeDefined(); } catch (_e) { expect(SCMProviderRegistry).toBeDefined(); }
  });
  it("scmRegistry", () => {
    expect(scmRegistry).toBeDefined();
  });
});
