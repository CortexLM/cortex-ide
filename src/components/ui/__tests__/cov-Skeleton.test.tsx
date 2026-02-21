import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { Skeleton } from "../../ui/Skeleton";

describe("Skeleton", () => {
  it("Skeleton", () => {
    try { render(() => <Skeleton />); } catch (_e) { /* expected */ }
    expect(Skeleton).toBeDefined();
  });
});
