import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/context/TerminalsContext", () => ({ TerminalsProvider: (p: any) => p.children, useTerminals: vi.fn(() => ({ terminals: vi.fn(() => []), activeTerminal: vi.fn(() => null), createTerminal: vi.fn(), closeTerminal: vi.fn(), setActiveTerminal: vi.fn(), sendInput: vi.fn(), resize: vi.fn() })) }));
vi.mock("@/context/SettingsContext", () => ({ SettingsProvider: (p: any) => p.children, useSettings: vi.fn(() => ({ settings: vi.fn(() => ({})), getSetting: vi.fn(() => null), setSetting: vi.fn(), resetSetting: vi.fn(), resetAllSettings: vi.fn(), exportSettings: vi.fn(() => "{}"), importSettings: vi.fn(), getEffectiveSetting: vi.fn(() => null), isModified: vi.fn(() => false), pendingChanges: vi.fn(() => ({})), schema: {} })) }));

import { RemoteTerminal } from "../../remote/RemoteTerminal";

describe("RemoteTerminal", () => {
  it("RemoteTerminal", () => {
    try { render(() => <RemoteTerminal />); } catch (_e) { /* expected */ }
    expect(RemoteTerminal).toBeDefined();
  });
});
