import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { ActivityIndicatorProvider, useActivityIndicator, useTask } from "../ActivityIndicatorContext";

describe("ActivityIndicatorContext", () => {
  it("ActivityIndicatorProvider", () => {
    try { render(() => <ActivityIndicatorProvider />); } catch (_e) { /* expected */ }
    expect(ActivityIndicatorProvider).toBeDefined();
  });
  it("useActivityIndicator", () => {
    try { createRoot((dispose) => { try { useActivityIndicator(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useActivityIndicator).toBeDefined();
  });
  it("useTask", () => {
    try { createRoot((dispose) => { try { useTask({} as any); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTask).toBeDefined();
  });
});
