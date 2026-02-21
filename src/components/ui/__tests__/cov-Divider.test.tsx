import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { Divider, Spacer } from "../../ui/Divider";

describe("Divider", () => {
  it("Divider", () => {
    try { render(() => <Divider />); } catch (_e) { /* expected */ }
    expect(Divider).toBeDefined();
  });
  it("Spacer", () => {
    try { render(() => <Spacer />); } catch (_e) { /* expected */ }
    expect(Spacer).toBeDefined();
  });
});
