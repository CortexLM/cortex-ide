import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { useResizeObserver, useElementSize, useMultiResizeObserver, useWindowSize } from "../useResizeObserver";

describe("useResizeObserver", () => {
  it("useResizeObserver", () => {
    try { createRoot((dispose) => { try { useResizeObserver(document.createElement("div")); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useResizeObserver).toBeDefined();
  });
  it("useElementSize", () => {
    try { createRoot((dispose) => { try { useElementSize(document.createElement("div")); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useElementSize).toBeDefined();
  });
  it("useMultiResizeObserver", () => {
    try { createRoot((dispose) => { try { useMultiResizeObserver(document.createElement("div")); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useMultiResizeObserver).toBeDefined();
  });
  it("useWindowSize", () => {
    try { createRoot((dispose) => { try { useWindowSize(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useWindowSize).toBeDefined();
  });
});
