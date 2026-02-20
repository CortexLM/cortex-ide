import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  cachedInvoke,
  invalidateIpcCache,
  getIpcCacheSize,
  _resetIpcCache,
} from "../ipcCache";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  _resetIpcCache();
  mockInvoke.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cachedInvoke", () => {
  it("calls invoke and caches the result for known commands", async () => {
    mockInvoke.mockResolvedValueOnce("1.0.0");

    const r1 = await cachedInvoke<string>("get_version");
    const r2 = await cachedInvoke<string>("get_version");

    expect(r1).toBe("1.0.0");
    expect(r2).toBe("1.0.0");
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("does not cache unknown commands", async () => {
    mockInvoke.mockResolvedValue("result");

    await cachedInvoke("unknown_cmd");
    await cachedInvoke("unknown_cmd");

    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it("caches with different args separately", async () => {
    mockInvoke.mockResolvedValueOnce("val1").mockResolvedValueOnce("val2");

    const r1 = await cachedInvoke("settings_load", { profile: "a" });
    const r2 = await cachedInvoke("settings_load", { profile: "b" });

    expect(r1).toBe("val1");
    expect(r2).toBe("val2");
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it("returns cached value for same args", async () => {
    mockInvoke.mockResolvedValueOnce("cached");

    await cachedInvoke("settings_load", { profile: "a" });
    const r2 = await cachedInvoke("settings_load", { profile: "a" });

    expect(r2).toBe("cached");
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("respects bypassCache option", async () => {
    mockInvoke.mockResolvedValue("fresh");

    await cachedInvoke("get_version");
    await cachedInvoke("get_version", undefined, { bypassCache: true });

    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it("respects custom TTL option", async () => {
    mockInvoke.mockResolvedValue("data");

    await cachedInvoke("get_version", undefined, { ttl: 1 });
    expect(getIpcCacheSize()).toBe(1);

    await new Promise((r) => setTimeout(r, 10));

    mockInvoke.mockResolvedValueOnce("new_data");
    const r = await cachedInvoke("get_version");
    expect(r).toBe("new_data");
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });
});

describe("invalidateIpcCache", () => {
  it("invalidates a specific command", async () => {
    mockInvoke.mockResolvedValue("v1");
    await cachedInvoke("get_version");
    expect(getIpcCacheSize()).toBe(1);

    invalidateIpcCache("get_version");
    expect(getIpcCacheSize()).toBe(0);
  });

  it("invalidates all entries when no cmd provided", async () => {
    mockInvoke.mockResolvedValue("data");
    await cachedInvoke("get_version");
    await cachedInvoke("settings_load");
    expect(getIpcCacheSize()).toBe(2);

    invalidateIpcCache();
    expect(getIpcCacheSize()).toBe(0);
  });

  it("invalidates entries with args (prefix match)", async () => {
    mockInvoke.mockResolvedValue("data");
    await cachedInvoke("settings_load", { profile: "a" });
    await cachedInvoke("settings_load", { profile: "b" });
    await cachedInvoke("get_version");
    expect(getIpcCacheSize()).toBe(3);

    invalidateIpcCache("settings_load");
    expect(getIpcCacheSize()).toBe(1);
  });
});

describe("event-based invalidation", () => {
  it("invalidates settings cache on settings:changed event", async () => {
    mockInvoke.mockResolvedValue("settings_data");
    await cachedInvoke("settings_load");
    expect(getIpcCacheSize()).toBe(1);

    window.dispatchEvent(new CustomEvent("settings:changed"));
    expect(getIpcCacheSize()).toBe(0);
  });

  it("invalidates extensions cache on extension:installed event", async () => {
    mockInvoke.mockResolvedValue([]);
    await cachedInvoke("get_extensions");
    await cachedInvoke("get_enabled_extensions");
    expect(getIpcCacheSize()).toBe(2);

    window.dispatchEvent(new CustomEvent("extension:installed"));
    expect(getIpcCacheSize()).toBe(0);
  });
});

describe("TTL expiration", () => {
  it("expires entries after TTL", async () => {
    mockInvoke.mockResolvedValueOnce("first");

    await cachedInvoke("get_version", undefined, { ttl: 1 });

    await new Promise((r) => setTimeout(r, 10));

    mockInvoke.mockResolvedValueOnce("second");
    const result = await cachedInvoke("get_version");
    expect(result).toBe("second");
  });

  it("does not expire entries with Infinity TTL", async () => {
    mockInvoke.mockResolvedValueOnce("permanent");

    await cachedInvoke("get_version");

    const result = await cachedInvoke("get_version");
    expect(result).toBe("permanent");
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});
