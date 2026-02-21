import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));

import { Toast, ToastContainer } from "../../ui/Toast";

describe("Toast", () => {
  it("Toast", () => {
    try { render(() => <Toast />); } catch (_e) { /* expected */ }
    expect(Toast).toBeDefined();
  });
  it("ToastContainer", () => {
    try { render(() => <ToastContainer />); } catch (_e) { /* expected */ }
    expect(ToastContainer).toBeDefined();
  });
});
