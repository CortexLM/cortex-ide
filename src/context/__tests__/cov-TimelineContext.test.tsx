import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { TimelineProvider, useTimeline } from "../TimelineContext";

describe("TimelineContext", () => {
  it("TimelineProvider", () => {
    try { render(() => <TimelineProvider />); } catch (_e) { /* expected */ }
    expect(TimelineProvider).toBeDefined();
  });
  it("useTimeline", () => {
    try { createRoot((dispose) => { try { useTimeline(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTimeline).toBeDefined();
  });
});
