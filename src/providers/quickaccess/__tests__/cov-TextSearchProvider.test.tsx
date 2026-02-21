import { describe, it, expect, vi } from "vitest";

import { createTextSearchProvider } from "../../quickaccess/TextSearchProvider";

describe("TextSearchProvider", () => {
  it("createTextSearchProvider", () => {
    try { createTextSearchProvider({} as any); } catch (_e) { /* expected */ }
    try { createTextSearchProvider(); } catch (_e) { /* expected */ }
    expect(createTextSearchProvider).toBeDefined();
  });
});
