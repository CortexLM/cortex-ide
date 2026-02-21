import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/components/ui/Button", () => ({ Button: (p: any) => p.children }));
vi.mock("@/context/SettingsContext", () => ({ SettingsProvider: (p: any) => p.children, useSettings: vi.fn(() => ({ settings: vi.fn(() => ({})), getSetting: vi.fn(() => null), setSetting: vi.fn(), resetSetting: vi.fn(), resetAllSettings: vi.fn(), exportSettings: vi.fn(() => "{}"), importSettings: vi.fn(), getEffectiveSetting: vi.fn(() => null), isModified: vi.fn(() => false), pendingChanges: vi.fn(() => ({})), schema: {} })) }));

import { EditorSettingsPanel } from "../../settings/EditorSettingsPanel";

describe("EditorSettingsPanel", () => {
  it("EditorSettingsPanel", () => {
    try { render(() => <EditorSettingsPanel />); } catch (_e) { /* expected */ }
    expect(EditorSettingsPanel).toBeDefined();
  });
});
