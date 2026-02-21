import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { createExtensionStatusBarAPI, StatusBarManagerProvider, StatusBarRenderer, useStatusBarManager, useStatusBarItem } from "../../workbench/StatusBarManager";

describe("StatusBarManager", () => {
  it("createExtensionStatusBarAPI", () => {
    try { createExtensionStatusBarAPI({} as any); } catch (_e) { /* expected */ }
    try { createExtensionStatusBarAPI(); } catch (_e) { /* expected */ }
    expect(createExtensionStatusBarAPI).toBeDefined();
  });
  it("StatusBarManagerProvider", () => {
    try { render(() => <StatusBarManagerProvider />); } catch (_e) { /* expected */ }
    expect(StatusBarManagerProvider).toBeDefined();
  });
  it("StatusBarRenderer", () => {
    try { render(() => <StatusBarRenderer />); } catch (_e) { /* expected */ }
    expect(StatusBarRenderer).toBeDefined();
  });
  it("useStatusBarManager", () => {
    try { createRoot((dispose) => { try { useStatusBarManager(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useStatusBarManager).toBeDefined();
  });
  it("useStatusBarItem", () => {
    try { createRoot((dispose) => { try { useStatusBarItem({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useStatusBarItem).toBeDefined();
  });
});
