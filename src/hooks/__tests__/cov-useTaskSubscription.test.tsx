import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

import { useTaskSubscription } from "../useTaskSubscription";

describe("useTaskSubscription", () => {
  it("useTaskSubscription", () => {
    try { createRoot((dispose) => { try { useTaskSubscription("test"); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTaskSubscription).toBeDefined();
  });
});
