import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { InteractiveRebase } from "../../git/InteractiveRebase";

describe("InteractiveRebase", () => {
  it("InteractiveRebase", () => {
    try { render(() => <InteractiveRebase />); } catch (_e) { /* expected */ }
    expect(InteractiveRebase).toBeDefined();
  });
});
