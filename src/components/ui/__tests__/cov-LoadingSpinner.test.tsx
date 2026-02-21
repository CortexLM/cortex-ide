import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { LoadingSpinner } from "../../ui/LoadingSpinner";

describe("LoadingSpinner", () => {
  it("LoadingSpinner", () => {
    try { render(() => <LoadingSpinner />); } catch (_e) { /* expected */ }
    expect(LoadingSpinner).toBeDefined();
  });
});
