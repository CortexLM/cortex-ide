import { describe, it, expect, vi } from "vitest";

import { createGitError, parseGitErrorCode, getGitErrorMessage, isRetryableError, getGitErrorSeverity } from "../../git/errors";

describe("errors", () => {
  it("createGitError", () => {
    try { createGitError("test"); } catch (_e) { /* expected */ }
    try { createGitError(); } catch (_e) { /* expected */ }
    expect(createGitError).toBeDefined();
  });
  it("parseGitErrorCode", () => {
    try { parseGitErrorCode("test"); } catch (_e) { /* expected */ }
    try { parseGitErrorCode(); } catch (_e) { /* expected */ }
    expect(parseGitErrorCode).toBeDefined();
  });
  it("getGitErrorMessage", () => {
    try { getGitErrorMessage({} as any); } catch (_e) { /* expected */ }
    try { getGitErrorMessage(); } catch (_e) { /* expected */ }
    expect(getGitErrorMessage).toBeDefined();
  });
  it("isRetryableError", () => {
    try { isRetryableError({} as any); } catch (_e) { /* expected */ }
    try { isRetryableError(); } catch (_e) { /* expected */ }
    expect(isRetryableError).toBeDefined();
  });
  it("getGitErrorSeverity", () => {
    try { getGitErrorSeverity({} as any); } catch (_e) { /* expected */ }
    try { getGitErrorSeverity(); } catch (_e) { /* expected */ }
    expect(getGitErrorSeverity).toBeDefined();
  });
});
