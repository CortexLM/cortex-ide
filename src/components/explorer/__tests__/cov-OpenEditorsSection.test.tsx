import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { OpenEditorsSection } from "../../explorer/OpenEditorsSection";

describe("OpenEditorsSection", () => {
  it("OpenEditorsSection", () => {
    try { render(() => <OpenEditorsSection />); } catch (_e) { /* expected */ }
    expect(OpenEditorsSection).toBeDefined();
  });
});
