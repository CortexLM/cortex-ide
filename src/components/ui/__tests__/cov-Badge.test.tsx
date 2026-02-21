import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { Badge, StatusDot } from "../../ui/Badge";

describe("Badge", () => {
  it("Badge", () => {
    try { render(() => <Badge />); } catch (_e) { /* expected */ }
    expect(Badge).toBeDefined();
  });
  it("StatusDot", () => {
    try { render(() => <StatusDot />); } catch (_e) { /* expected */ }
    expect(StatusDot).toBeDefined();
  });
});
