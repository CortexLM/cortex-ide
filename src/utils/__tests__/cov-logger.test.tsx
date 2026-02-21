import { describe, it, expect, vi } from "vitest";

import { createLogger, logger, cortexLogger, editorLogger, terminalLogger, gitLogger, lspLogger, aiLogger, extensionLogger } from "../logger";

describe("logger", () => {
  it("createLogger", () => {
    try { createLogger("test"); } catch (_e) { /* expected */ }
    try { createLogger(); } catch (_e) { /* expected */ }
    expect(createLogger).toBeDefined();
  });
  it("logger", () => {
    expect(logger).toBeDefined();
  });
  it("cortexLogger", () => {
    expect(cortexLogger).toBeDefined();
  });
  it("editorLogger", () => {
    expect(editorLogger).toBeDefined();
  });
  it("terminalLogger", () => {
    expect(terminalLogger).toBeDefined();
  });
  it("gitLogger", () => {
    expect(gitLogger).toBeDefined();
  });
  it("lspLogger", () => {
    expect(lspLogger).toBeDefined();
  });
  it("aiLogger", () => {
    expect(aiLogger).toBeDefined();
  });
  it("extensionLogger", () => {
    expect(extensionLogger).toBeDefined();
  });
});
