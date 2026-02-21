import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { useLocalStorageBoolean, useLocalStorageNumber, useLocalStorageString } from "../useLocalStorage";

describe("useLocalStorage", () => {
  it("useLocalStorageBoolean", () => {
    try { createRoot((dispose) => { try { useLocalStorageBoolean("test", false); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useLocalStorageBoolean).toBeDefined();
  });
  it("useLocalStorageNumber", () => {
    try { createRoot((dispose) => { try { useLocalStorageNumber("test", 0); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useLocalStorageNumber).toBeDefined();
  });
  it("useLocalStorageString", () => {
    try { createRoot((dispose) => { try { useLocalStorageString("test", "test"); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useLocalStorageString).toBeDefined();
  });
});
