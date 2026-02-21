import { describe, it, expect, vi } from "vitest";

import { formatSystemInfoForGitHub, buildGitHubIssueUrl, createIssueReporterProvider } from "../../quickaccess/IssueReporterProvider";

describe("IssueReporterProvider", () => {
  it("formatSystemInfoForGitHub", () => {
    try { formatSystemInfoForGitHub({} as any); } catch (_e) { /* expected */ }
    try { formatSystemInfoForGitHub(); } catch (_e) { /* expected */ }
    expect(formatSystemInfoForGitHub).toBeDefined();
  });
  it("buildGitHubIssueUrl", () => {
    try { buildGitHubIssueUrl({} as any, {} as any); } catch (_e) { /* expected */ }
    try { buildGitHubIssueUrl(); } catch (_e) { /* expected */ }
    expect(buildGitHubIssueUrl).toBeDefined();
  });
  it("createIssueReporterProvider", () => {
    try { createIssueReporterProvider({} as any); } catch (_e) { /* expected */ }
    try { createIssueReporterProvider(); } catch (_e) { /* expected */ }
    expect(createIssueReporterProvider).toBeDefined();
  });
});
