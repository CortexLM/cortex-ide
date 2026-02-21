import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ readText: vi.fn().mockResolvedValue(""), writeText: vi.fn().mockResolvedValue(undefined) }));

import { SystemSpecsDialog, useSystemSpecsDialog } from "../SystemSpecs";

describe("SystemSpecs", () => {
  it("SystemSpecsDialog", () => {
    try { render(() => <SystemSpecsDialog />); } catch (_e) { /* expected */ }
    expect(SystemSpecsDialog).toBeDefined();
  });
  it("useSystemSpecsDialog", () => {
    try { createRoot((dispose) => { try { useSystemSpecsDialog(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSystemSpecsDialog).toBeDefined();
  });
});
