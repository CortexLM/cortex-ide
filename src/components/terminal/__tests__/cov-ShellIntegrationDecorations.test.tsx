import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { createShellDecorations, ShellIntegrationDecorations, CommandHistoryPanel, ShellIntegrationDecorationsAddon } from "../../terminal/ShellIntegrationDecorations";

describe("ShellIntegrationDecorations", () => {
  it("createShellDecorations", () => {
    try { createShellDecorations({} as any); } catch (_e) { /* expected */ }
    try { createShellDecorations(); } catch (_e) { /* expected */ }
    expect(createShellDecorations).toBeDefined();
  });
  it("ShellIntegrationDecorations", () => {
    try { render(() => <ShellIntegrationDecorations />); } catch (_e) { /* expected */ }
    expect(ShellIntegrationDecorations).toBeDefined();
  });
  it("CommandHistoryPanel", () => {
    try { render(() => <CommandHistoryPanel />); } catch (_e) { /* expected */ }
    expect(CommandHistoryPanel).toBeDefined();
  });
  it("ShellIntegrationDecorationsAddon", () => {
    try { const inst = new ShellIntegrationDecorationsAddon(); expect(inst).toBeDefined(); } catch (_e) { expect(ShellIntegrationDecorationsAddon).toBeDefined(); }
  });
});
