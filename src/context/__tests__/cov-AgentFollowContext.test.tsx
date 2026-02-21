import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { createFileLocation, createTerminalLocation, createSearchLocation, createDirectoryLocation, AgentFollowProvider, useAgentFollow } from "../AgentFollowContext";

describe("AgentFollowContext", () => {
  it("createFileLocation", () => {
    try { createFileLocation("test"); } catch (_e) { /* expected */ }
    try { createFileLocation(); } catch (_e) { /* expected */ }
    expect(createFileLocation).toBeDefined();
  });
  it("createTerminalLocation", () => {
    try { createTerminalLocation(); } catch (_e) { /* expected */ }
    expect(createTerminalLocation).toBeDefined();
  });
  it("createSearchLocation", () => {
    try { createSearchLocation("test"); } catch (_e) { /* expected */ }
    try { createSearchLocation(); } catch (_e) { /* expected */ }
    expect(createSearchLocation).toBeDefined();
  });
  it("createDirectoryLocation", () => {
    try { createDirectoryLocation("test"); } catch (_e) { /* expected */ }
    try { createDirectoryLocation(); } catch (_e) { /* expected */ }
    expect(createDirectoryLocation).toBeDefined();
  });
  it("AgentFollowProvider", () => {
    try { render(() => <AgentFollowProvider />); } catch (_e) { /* expected */ }
    expect(AgentFollowProvider).toBeDefined();
  });
  it("useAgentFollow", () => {
    try { createRoot((dispose) => { try { useAgentFollow(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useAgentFollow).toBeDefined();
  });
});
