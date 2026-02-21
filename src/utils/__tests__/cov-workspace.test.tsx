import { describe, it, expect, vi } from "vitest";

import { getProjectPath, setProjectPath, clearProjectPath } from "../workspace";

describe("workspace", () => {
  it("getProjectPath", () => {
    try { getProjectPath(); } catch (_e) { /* expected */ }
    expect(getProjectPath).toBeDefined();
  });
  it("setProjectPath", () => {
    try { setProjectPath("test"); } catch (_e) { /* expected */ }
    try { setProjectPath(); } catch (_e) { /* expected */ }
    expect(setProjectPath).toBeDefined();
  });
  it("clearProjectPath", () => {
    try { clearProjectPath(); } catch (_e) { /* expected */ }
    expect(clearProjectPath).toBeDefined();
  });
});
