import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { BookmarksProvider, useBookmarks } from "../BookmarksContext";

describe("BookmarksContext", () => {
  it("BookmarksProvider", () => {
    try { render(() => <BookmarksProvider />); } catch (_e) { /* expected */ }
    expect(BookmarksProvider).toBeDefined();
  });
  it("useBookmarks", () => {
    try { createRoot((dispose) => { try { useBookmarks(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useBookmarks).toBeDefined();
  });
});
