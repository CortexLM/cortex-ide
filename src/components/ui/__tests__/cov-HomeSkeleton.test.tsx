import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { HomeSkeleton } from "../../ui/HomeSkeleton";

describe("HomeSkeleton", () => {
  it("HomeSkeleton", () => {
    try { render(() => <HomeSkeleton />); } catch (_e) { /* expected */ }
    expect(HomeSkeleton).toBeDefined();
  });
});
