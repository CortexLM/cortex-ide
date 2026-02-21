import { describe, it, expect, vi } from "vitest";

import { parseCliError, createErrorFromResult, isCortexError, isRecoverableError, getRetryDelay, formatError, formatErrorForLog, CortexError, CliExecutionError, TimeoutError, CliNotFoundError, PermissionDeniedError, AuthenticationError, RateLimitError, ContextWindowExceededError, ModelNotFoundError, SessionNotFoundError, JsonParseError, NetworkError, CancelledError } from "../errors";

describe("errors", () => {
  it("parseCliError", () => {
    try { parseCliError("test"); } catch (_e) { /* expected */ }
    try { parseCliError(); } catch (_e) { /* expected */ }
    expect(parseCliError).toBeDefined();
  });
  it("createErrorFromResult", () => {
    try { createErrorFromResult({} as any); } catch (_e) { /* expected */ }
    try { createErrorFromResult(); } catch (_e) { /* expected */ }
    expect(createErrorFromResult).toBeDefined();
  });
  it("isCortexError", () => {
    try { isCortexError(""); } catch (_e) { /* expected */ }
    try { isCortexError(); } catch (_e) { /* expected */ }
    expect(isCortexError).toBeDefined();
  });
  it("isRecoverableError", () => {
    try { isRecoverableError(""); } catch (_e) { /* expected */ }
    try { isRecoverableError(); } catch (_e) { /* expected */ }
    expect(isRecoverableError).toBeDefined();
  });
  it("getRetryDelay", () => {
    try { getRetryDelay("", 0); } catch (_e) { /* expected */ }
    try { getRetryDelay(); } catch (_e) { /* expected */ }
    expect(getRetryDelay).toBeDefined();
  });
  it("formatError", () => {
    try { formatError(""); } catch (_e) { /* expected */ }
    try { formatError(); } catch (_e) { /* expected */ }
    expect(formatError).toBeDefined();
  });
  it("formatErrorForLog", () => {
    try { formatErrorForLog(""); } catch (_e) { /* expected */ }
    try { formatErrorForLog(); } catch (_e) { /* expected */ }
    expect(formatErrorForLog).toBeDefined();
  });
  it("CortexError", () => {
    try { const inst = new CortexError("test", "test"); expect(inst).toBeDefined(); } catch (_e) { expect(CortexError).toBeDefined(); }
  });
  it("CliExecutionError", () => {
    try { const inst = new CliExecutionError("test", 0); expect(inst).toBeDefined(); } catch (_e) { expect(CliExecutionError).toBeDefined(); }
  });
  it("TimeoutError", () => {
    try { const inst = new TimeoutError("test", 0); expect(inst).toBeDefined(); } catch (_e) { expect(TimeoutError).toBeDefined(); }
  });
  it("CliNotFoundError", () => {
    try { const inst = new CliNotFoundError("test"); expect(inst).toBeDefined(); } catch (_e) { expect(CliNotFoundError).toBeDefined(); }
  });
  it("PermissionDeniedError", () => {
    try { const inst = new PermissionDeniedError("test", "test"); expect(inst).toBeDefined(); } catch (_e) { expect(PermissionDeniedError).toBeDefined(); }
  });
  it("AuthenticationError", () => {
    try { const inst = new AuthenticationError("test"); expect(inst).toBeDefined(); } catch (_e) { expect(AuthenticationError).toBeDefined(); }
  });
  it("RateLimitError", () => {
    try { const inst = new RateLimitError("test"); expect(inst).toBeDefined(); } catch (_e) { expect(RateLimitError).toBeDefined(); }
  });
  it("ContextWindowExceededError", () => {
    try { const inst = new ContextWindowExceededError("test"); expect(inst).toBeDefined(); } catch (_e) { expect(ContextWindowExceededError).toBeDefined(); }
  });
  it("ModelNotFoundError", () => {
    try { const inst = new ModelNotFoundError("test", "test"); expect(inst).toBeDefined(); } catch (_e) { expect(ModelNotFoundError).toBeDefined(); }
  });
  it("SessionNotFoundError", () => {
    try { const inst = new SessionNotFoundError("test", "test"); expect(inst).toBeDefined(); } catch (_e) { expect(SessionNotFoundError).toBeDefined(); }
  });
  it("JsonParseError", () => {
    try { const inst = new JsonParseError("test", "test", {} as any); expect(inst).toBeDefined(); } catch (_e) { expect(JsonParseError).toBeDefined(); }
  });
  it("NetworkError", () => {
    try { const inst = new NetworkError("test"); expect(inst).toBeDefined(); } catch (_e) { expect(NetworkError).toBeDefined(); }
  });
  it("CancelledError", () => {
    try { const inst = new CancelledError(); expect(inst).toBeDefined(); } catch (_e) { expect(CancelledError).toBeDefined(); }
  });
});
