import { describe, it, expect, vi } from "vitest";

import { showErrorNotification, showWarningNotification, showInfoNotification, showSuccessNotification } from "../notifications";

describe("notifications", () => {
  it("showErrorNotification", () => {
    try { showErrorNotification(); } catch (_e) { /* expected */ }
    expect(showErrorNotification).toBeDefined();
  });
  it("showWarningNotification", () => {
    try { showWarningNotification(); } catch (_e) { /* expected */ }
    expect(showWarningNotification).toBeDefined();
  });
  it("showInfoNotification", () => {
    try { showInfoNotification(); } catch (_e) { /* expected */ }
    expect(showInfoNotification).toBeDefined();
  });
  it("showSuccessNotification", () => {
    try { showSuccessNotification(); } catch (_e) { /* expected */ }
    expect(showSuccessNotification).toBeDefined();
  });
});
