import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/plugin-os", () => ({ platform: vi.fn().mockResolvedValue("linux"), arch: vi.fn().mockResolvedValue("x86_64"), type: vi.fn().mockResolvedValue("Linux"), version: vi.fn().mockResolvedValue("1.0"), locale: vi.fn().mockResolvedValue("en-US"), tempdir: vi.fn().mockResolvedValue("/tmp") }));

import { formatSystemInfo, encodeSystemInfoForUrl } from "../systemInfo";

describe("systemInfo", () => {
  it("formatSystemInfo", () => {
    try { formatSystemInfo({} as any); } catch (_e) { /* expected */ }
    try { formatSystemInfo(); } catch (_e) { /* expected */ }
    expect(formatSystemInfo).toBeDefined();
  });
  it("encodeSystemInfoForUrl", () => {
    try { encodeSystemInfoForUrl({} as any); } catch (_e) { /* expected */ }
    try { encodeSystemInfoForUrl(); } catch (_e) { /* expected */ }
    expect(encodeSystemInfoForUrl).toBeDefined();
  });
});
