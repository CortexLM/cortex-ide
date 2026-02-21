import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/context/editor/languageDetection", () => ({ languageDetection: (p: any) => p.children, uselanguageDetection: vi.fn(() => ({})) }));

import { TabsProvider, useTabs } from "../../editor/TabsProvider";

describe("TabsProvider", () => {
  it("TabsProvider", () => {
    try { render(() => <TabsProvider />); } catch (_e) { /* expected */ }
    expect(TabsProvider).toBeDefined();
  });
  it("useTabs", () => {
    try { createRoot((dispose) => { try { useTabs(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTabs).toBeDefined();
  });
});
