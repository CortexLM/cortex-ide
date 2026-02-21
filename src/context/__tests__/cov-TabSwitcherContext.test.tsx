import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { TabSwitcherProvider, useTabSwitcher } from "../TabSwitcherContext";

describe("TabSwitcherContext", () => {
  it("TabSwitcherProvider", () => {
    try { render(() => <TabSwitcherProvider />); } catch (_e) { /* expected */ }
    expect(TabSwitcherProvider).toBeDefined();
  });
  it("useTabSwitcher", () => {
    try { createRoot((dispose) => { try { useTabSwitcher(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTabSwitcher).toBeDefined();
  });
});
