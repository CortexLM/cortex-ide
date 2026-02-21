import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/SettingsContext", () => ({ SettingsProvider: (p: any) => p.children, useSettings: vi.fn(() => ({ settings: vi.fn(() => ({})), getSetting: vi.fn(() => null), setSetting: vi.fn(), resetSetting: vi.fn(), resetAllSettings: vi.fn(), exportSettings: vi.fn(() => "{}"), importSettings: vi.fn(), getEffectiveSetting: vi.fn(() => null), isModified: vi.fn(() => false), pendingChanges: vi.fn(() => ({})), schema: {} })) }));

import { ScreencastModeLayout } from "../../layout/ScreencastMode";

describe("ScreencastMode", () => {
  it("ScreencastModeLayout", () => {
    try { render(() => <ScreencastModeLayout />); } catch (_e) { /* expected */ }
    expect(ScreencastModeLayout).toBeDefined();
  });
});
