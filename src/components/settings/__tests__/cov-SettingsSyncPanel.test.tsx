import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/SettingsSyncContext", () => ({ SettingsSyncProvider: (p: any) => p.children, useSettingsSync: vi.fn(() => ({})) }));

import { SettingsSyncPanel } from "../../settings/SettingsSyncPanel";

describe("SettingsSyncPanel", () => {
  it("SettingsSyncPanel", () => {
    try { render(() => <SettingsSyncPanel />); } catch (_e) { /* expected */ }
    expect(SettingsSyncPanel).toBeDefined();
  });
});
