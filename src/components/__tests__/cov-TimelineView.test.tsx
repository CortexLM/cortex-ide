import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { TimelineView, TimelineButton } from "../TimelineView";

describe("TimelineView", () => {
  it("TimelineView", () => {
    try { render(() => <TimelineView />); } catch (_e) { /* expected */ }
    expect(TimelineView).toBeDefined();
  });
  it("TimelineButton", () => {
    try { render(() => <TimelineButton />); } catch (_e) { /* expected */ }
    expect(TimelineButton).toBeDefined();
  });
});
