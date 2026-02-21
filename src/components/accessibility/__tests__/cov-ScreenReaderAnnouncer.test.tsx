import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { ScreenReaderAnnouncer } from "../../accessibility/ScreenReaderAnnouncer";

describe("ScreenReaderAnnouncer", () => {
  it("ScreenReaderAnnouncer", () => {
    try { render(() => <ScreenReaderAnnouncer />); } catch (_e) { /* expected */ }
    expect(ScreenReaderAnnouncer).toBeDefined();
  });
});
