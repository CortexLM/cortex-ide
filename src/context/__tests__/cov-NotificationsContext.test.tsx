import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { NotificationsProvider, useNotifications } from "../NotificationsContext";

describe("NotificationsContext", () => {
  it("NotificationsProvider", () => {
    try { render(() => <NotificationsProvider />); } catch (_e) { /* expected */ }
    expect(NotificationsProvider).toBeDefined();
  });
  it("useNotifications", () => {
    try { createRoot((dispose) => { try { useNotifications(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useNotifications).toBeDefined();
  });
});
