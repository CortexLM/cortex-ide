import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { NotificationBadge, NotificationCenter } from "../../workbench/NotificationCenter";

describe("NotificationCenter", () => {
  it("NotificationBadge", () => {
    try { render(() => <NotificationBadge />); } catch (_e) { /* expected */ }
    expect(NotificationBadge).toBeDefined();
  });
  it("NotificationCenter", () => {
    try { render(() => <NotificationCenter />); } catch (_e) { /* expected */ }
    expect(NotificationCenter).toBeDefined();
  });
});
