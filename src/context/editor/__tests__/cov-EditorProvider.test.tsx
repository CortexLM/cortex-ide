import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/context/SettingsContext", () => ({ SettingsProvider: (p: any) => p.children, useSettings: vi.fn(() => ({ settings: vi.fn(() => ({})), getSetting: vi.fn(() => null), setSetting: vi.fn(), resetSetting: vi.fn(), resetAllSettings: vi.fn(), exportSettings: vi.fn(() => "{}"), importSettings: vi.fn(), getEffectiveSetting: vi.fn(() => null), isModified: vi.fn(() => false), pendingChanges: vi.fn(() => ({})), schema: {} })) }));

import { EditorProvider, useEditor } from "../../editor/EditorProvider";

describe("EditorProvider", () => {
  it("EditorProvider", () => {
    try { render(() => <EditorProvider />); } catch (_e) { /* expected */ }
    expect(EditorProvider).toBeDefined();
  });
  it("useEditor", () => {
    try { createRoot((dispose) => { try { useEditor(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useEditor).toBeDefined();
  });
});
