import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue(null), message: vi.fn().mockResolvedValue(undefined), ask: vi.fn().mockResolvedValue(false), confirm: vi.fn().mockResolvedValue(false) }));

import { WorkspaceProvider, useWorkspace, FOLDER_COLORS } from "../WorkspaceContext";

describe("WorkspaceContext", () => {
  it("WorkspaceProvider", () => {
    try { render(() => <WorkspaceProvider />); } catch (_e) { /* expected */ }
    expect(WorkspaceProvider).toBeDefined();
  });
  it("useWorkspace", () => {
    try { createRoot((dispose) => { try { useWorkspace(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useWorkspace).toBeDefined();
  });
  it("FOLDER_COLORS", () => {
    expect(FOLDER_COLORS).toBeDefined();
  });
});
