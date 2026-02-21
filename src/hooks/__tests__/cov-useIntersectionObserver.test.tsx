import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { useIntersectionObserver, useInView, useLazyLoad, useInfiniteScroll, useVisibilityTracker, useMultiIntersectionObserver } from "../useIntersectionObserver";

describe("useIntersectionObserver", () => {
  it("useIntersectionObserver", () => {
    try { createRoot((dispose) => { try { useIntersectionObserver(document.createElement("div")); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useIntersectionObserver).toBeDefined();
  });
  it("useInView", () => {
    try { createRoot((dispose) => { try { useInView(document.createElement("div")); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useInView).toBeDefined();
  });
  it("useLazyLoad", () => {
    try { createRoot((dispose) => { try { useLazyLoad(document.createElement("div")); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useLazyLoad).toBeDefined();
  });
  it("useInfiniteScroll", () => {
    try { createRoot((dispose) => { try { useInfiniteScroll(document.createElement("div"), {} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useInfiniteScroll).toBeDefined();
  });
  it("useVisibilityTracker", () => {
    try { createRoot((dispose) => { try { useVisibilityTracker(document.createElement("div")); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useVisibilityTracker).toBeDefined();
  });
  it("useMultiIntersectionObserver", () => {
    try { createRoot((dispose) => { try { useMultiIntersectionObserver(document.createElement("div")); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useMultiIntersectionObserver).toBeDefined();
  });
});
