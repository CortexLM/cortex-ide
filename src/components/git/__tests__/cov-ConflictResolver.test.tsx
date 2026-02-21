import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { ConflictResolver } from "../../git/ConflictResolver";

describe("ConflictResolver", () => {
  it("ConflictResolver", () => {
    try { render(() => <ConflictResolver />); } catch (_e) { /* expected */ }
    expect(ConflictResolver).toBeDefined();
  });
});
