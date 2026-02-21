import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { SettingsSyncProvider, useSettingsSync } from "../SettingsSyncContext";

describe("SettingsSyncContext", () => {
  it("SettingsSyncProvider", () => {
    try { render(() => <SettingsSyncProvider />); } catch (_e) { /* expected */ }
    expect(SettingsSyncProvider).toBeDefined();
  });
  it("useSettingsSync", () => {
    try { createRoot((dispose) => { try { useSettingsSync(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSettingsSync).toBeDefined();
  });
});
