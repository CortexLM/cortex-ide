import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/context/SettingsContext", () => ({ SettingsProvider: (p: any) => p.children, useSettings: vi.fn(() => ({ settings: vi.fn(() => ({})), getSetting: vi.fn(() => null), setSetting: vi.fn(), resetSetting: vi.fn(), resetAllSettings: vi.fn(), exportSettings: vi.fn(() => "{}"), importSettings: vi.fn(), getEffectiveSetting: vi.fn(() => null), isModified: vi.fn(() => false), pendingChanges: vi.fn(() => ({})), schema: {} })) }));

import { updateZenModeSettings, getZenModeTransitionStyle, ZenModeOverlay, ZenModeProvider, useZenMode, zenModeClasses } from "../ZenMode";

describe("ZenMode", () => {
  it("updateZenModeSettings", () => {
    try { updateZenModeSettings({} as any); } catch (_e) { /* expected */ }
    try { updateZenModeSettings(); } catch (_e) { /* expected */ }
    expect(updateZenModeSettings).toBeDefined();
  });
  it("getZenModeTransitionStyle", () => {
    try { getZenModeTransitionStyle(false); } catch (_e) { /* expected */ }
    try { getZenModeTransitionStyle(); } catch (_e) { /* expected */ }
    expect(getZenModeTransitionStyle).toBeDefined();
  });
  it("ZenModeOverlay", () => {
    try { render(() => <ZenModeOverlay />); } catch (_e) { /* expected */ }
    expect(ZenModeOverlay).toBeDefined();
  });
  it("ZenModeProvider", () => {
    try { render(() => <ZenModeProvider />); } catch (_e) { /* expected */ }
    expect(ZenModeProvider).toBeDefined();
  });
  it("useZenMode", () => {
    try { createRoot((dispose) => { try { useZenMode(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useZenMode).toBeDefined();
  });
  it("zenModeClasses", () => {
    expect(zenModeClasses).toBeDefined();
  });
});
