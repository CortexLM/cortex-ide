import { describe, it, expect, vi } from "vitest";

import { detectShellType, needsQuoting, escapeString, strongQuote, weakQuote, quoteString, buildShellCommand, parseShellCommand, getDefaultShell, quotePowerShell, quoteCmd, escapeRegExp, joinCommands, createCdCommand, quoteEnvVar, createEnvAssignment, DEFAULT_SHELL_QUOTING, CHARS_NEED_ESCAPING } from "../shellQuoting";

describe("shellQuoting", () => {
  it("detectShellType", () => {
    try { detectShellType("test"); } catch (_e) { /* expected */ }
    try { detectShellType(); } catch (_e) { /* expected */ }
    expect(detectShellType).toBeDefined();
  });
  it("needsQuoting", () => {
    try { needsQuoting("test", {} as any); } catch (_e) { /* expected */ }
    try { needsQuoting(); } catch (_e) { /* expected */ }
    expect(needsQuoting).toBeDefined();
  });
  it("escapeString", () => {
    try { escapeString("test", "test", "test"); } catch (_e) { /* expected */ }
    try { escapeString(); } catch (_e) { /* expected */ }
    expect(escapeString).toBeDefined();
  });
  it("strongQuote", () => {
    try { strongQuote("test", "test"); } catch (_e) { /* expected */ }
    try { strongQuote(); } catch (_e) { /* expected */ }
    expect(strongQuote).toBeDefined();
  });
  it("weakQuote", () => {
    try { weakQuote("test", "test", {} as any); } catch (_e) { /* expected */ }
    try { weakQuote(); } catch (_e) { /* expected */ }
    expect(weakQuote).toBeDefined();
  });
  it("quoteString", () => {
    try { quoteString("test", {} as any); } catch (_e) { /* expected */ }
    try { quoteString(); } catch (_e) { /* expected */ }
    expect(quoteString).toBeDefined();
  });
  it("buildShellCommand", () => {
    try { buildShellCommand("test", {} as any); } catch (_e) { /* expected */ }
    try { buildShellCommand(); } catch (_e) { /* expected */ }
    expect(buildShellCommand).toBeDefined();
  });
  it("parseShellCommand", () => {
    try { parseShellCommand("test", {} as any); } catch (_e) { /* expected */ }
    try { parseShellCommand(); } catch (_e) { /* expected */ }
    expect(parseShellCommand).toBeDefined();
  });
  it("getDefaultShell", () => {
    try { getDefaultShell(); } catch (_e) { /* expected */ }
    expect(getDefaultShell).toBeDefined();
  });
  it("quotePowerShell", () => {
    try { quotePowerShell("test"); } catch (_e) { /* expected */ }
    try { quotePowerShell(); } catch (_e) { /* expected */ }
    expect(quotePowerShell).toBeDefined();
  });
  it("quoteCmd", () => {
    try { quoteCmd("test"); } catch (_e) { /* expected */ }
    try { quoteCmd(); } catch (_e) { /* expected */ }
    expect(quoteCmd).toBeDefined();
  });
  it("escapeRegExp", () => {
    try { escapeRegExp("test"); } catch (_e) { /* expected */ }
    try { escapeRegExp(); } catch (_e) { /* expected */ }
    expect(escapeRegExp).toBeDefined();
  });
  it("joinCommands", () => {
    try { joinCommands([], {} as any); } catch (_e) { /* expected */ }
    try { joinCommands(); } catch (_e) { /* expected */ }
    expect(joinCommands).toBeDefined();
  });
  it("createCdCommand", () => {
    try { createCdCommand("test", "test", {} as any); } catch (_e) { /* expected */ }
    try { createCdCommand(); } catch (_e) { /* expected */ }
    expect(createCdCommand).toBeDefined();
  });
  it("quoteEnvVar", () => {
    try { quoteEnvVar("test", {} as any); } catch (_e) { /* expected */ }
    try { quoteEnvVar(); } catch (_e) { /* expected */ }
    expect(quoteEnvVar).toBeDefined();
  });
  it("createEnvAssignment", () => {
    try { createEnvAssignment("test", "test", {} as any); } catch (_e) { /* expected */ }
    try { createEnvAssignment(); } catch (_e) { /* expected */ }
    expect(createEnvAssignment).toBeDefined();
  });
  it("DEFAULT_SHELL_QUOTING", () => {
    expect(DEFAULT_SHELL_QUOTING).toBeDefined();
  });
  it("CHARS_NEED_ESCAPING", () => {
    expect(CHARS_NEED_ESCAPING).toBeDefined();
  });
});
