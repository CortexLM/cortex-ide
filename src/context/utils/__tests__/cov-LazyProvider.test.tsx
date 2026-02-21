import { describe, it, expect, vi } from "vitest";

import { createLazyProvider, createDeferredInitProvider, createSelector } from "../LazyProvider";

describe("LazyProvider", () => {
  it("createLazyProvider", () => { expect(typeof createLazyProvider).toBe("function"); });
  it("createDeferredInitProvider", () => { expect(typeof createDeferredInitProvider).toBe("function"); });
  it("createSelector", () => { expect(typeof createSelector).toBe("function"); });
});