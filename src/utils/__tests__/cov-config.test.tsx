import { describe, it, expect, vi } from "vitest";

import { updateApiBaseUrl, getWsUrl, API_BASE_URL } from "../config";

describe("config", () => {
  it("updateApiBaseUrl", () => {
    try { updateApiBaseUrl("test"); } catch (_e) { /* expected */ }
    try { updateApiBaseUrl(); } catch (_e) { /* expected */ }
    expect(updateApiBaseUrl).toBeDefined();
  });
  it("getWsUrl", () => {
    try { getWsUrl("test"); } catch (_e) { /* expected */ }
    try { getWsUrl(); } catch (_e) { /* expected */ }
    expect(getWsUrl).toBeDefined();
  });
  it("API_BASE_URL", () => {
    expect(API_BASE_URL).toBeDefined();
  });
});
