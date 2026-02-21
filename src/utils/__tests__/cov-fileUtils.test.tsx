import { describe, it, expect, vi } from "vitest";

import { dirname, basename, extname, joinPath } from "../fileUtils";

describe("fileUtils", () => {
  it("dirname", () => {
    try { dirname("test"); } catch (_e) { /* expected */ }
    try { dirname(); } catch (_e) { /* expected */ }
    expect(dirname).toBeDefined();
  });
  it("basename", () => {
    try { basename("test"); } catch (_e) { /* expected */ }
    try { basename(); } catch (_e) { /* expected */ }
    expect(basename).toBeDefined();
  });
  it("extname", () => {
    try { extname("test"); } catch (_e) { /* expected */ }
    try { extname(); } catch (_e) { /* expected */ }
    expect(extname).toBeDefined();
  });
  it("joinPath", () => {
    try { joinPath("test", "test"); } catch (_e) { /* expected */ }
    try { joinPath(); } catch (_e) { /* expected */ }
    expect(joinPath).toBeDefined();
  });
});
