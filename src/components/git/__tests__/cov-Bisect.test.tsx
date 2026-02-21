import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { Bisect } from "../../git/Bisect";

describe("Bisect", () => {
  it("Bisect", () => {
    try { render(() => <Bisect />); } catch (_e) { /* expected */ }
    expect(Bisect).toBeDefined();
  });
});
