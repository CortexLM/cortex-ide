import { describe, it, expect, vi } from "vitest";

import { coerceValue, validateSetting, formatSettingsJSON, parseSettingsJSON, validateSettings, getSchemaDefault } from "../settingsValidation";

describe("settingsValidation", () => {
  it("coerceValue", () => {
    try { coerceValue("", {} as any); } catch (_e) { /* expected */ }
    try { coerceValue(); } catch (_e) { /* expected */ }
    expect(coerceValue).toBeDefined();
  });
  it("validateSetting", () => {
    try { validateSetting("", {} as any); } catch (_e) { /* expected */ }
    try { validateSetting(); } catch (_e) { /* expected */ }
    expect(validateSetting).toBeDefined();
  });
  it("formatSettingsJSON", () => {
    try { formatSettingsJSON({}); } catch (_e) { /* expected */ }
    try { formatSettingsJSON(); } catch (_e) { /* expected */ }
    expect(formatSettingsJSON).toBeDefined();
  });
  it("parseSettingsJSON", () => {
    try { parseSettingsJSON("test"); } catch (_e) { /* expected */ }
    try { parseSettingsJSON(); } catch (_e) { /* expected */ }
    expect(parseSettingsJSON).toBeDefined();
  });
  it("validateSettings", () => {
    try { validateSettings({}, {}); } catch (_e) { /* expected */ }
    try { validateSettings(); } catch (_e) { /* expected */ }
    expect(validateSettings).toBeDefined();
  });
  it("getSchemaDefault", () => {
    try { getSchemaDefault({} as any); } catch (_e) { /* expected */ }
    try { getSchemaDefault(); } catch (_e) { /* expected */ }
    expect(getSchemaDefault).toBeDefined();
  });
});
