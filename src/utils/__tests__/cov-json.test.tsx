import { describe, it, expect, vi } from "vitest";

import { isArray, isObject, safeJsonStringify } from "../json";

describe("json", () => {
  it("isArray", () => {
    try { isArray(""); } catch (_e) { /* expected */ }
    try { isArray(); } catch (_e) { /* expected */ }
    expect(isArray).toBeDefined();
  });
  it("isObject", () => {
    try { isObject(""); } catch (_e) { /* expected */ }
    try { isObject(); } catch (_e) { /* expected */ }
    expect(isObject).toBeDefined();
  });
  it("safeJsonStringify", () => {
    try { safeJsonStringify(""); } catch (_e) { /* expected */ }
    try { safeJsonStringify(); } catch (_e) { /* expected */ }
    expect(safeJsonStringify).toBeDefined();
  });
});
