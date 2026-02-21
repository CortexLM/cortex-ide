import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  showErrorNotification,
  showWarningNotification,
  showInfoNotification,
  showSuccessNotification,
} from "../notifications";

describe("notifications", () => {
  beforeEach(() => {
    vi.spyOn(window, "dispatchEvent");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("dispatches error notification", () => {
    showErrorNotification("Error Title", "Error message");
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "notification:show",
        detail: { type: "error", title: "Error Title", message: "Error message" },
      })
    );
    expect(console.error).toHaveBeenCalledWith("[Error Title]", "Error message");
  });

  it("dispatches warning notification", () => {
    showWarningNotification("Warn Title", "Warn message");
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "notification:show",
        detail: { type: "warning", title: "Warn Title", message: "Warn message" },
      })
    );
    expect(console.warn).toHaveBeenCalledWith("[Warn Title]", "Warn message");
  });

  it("dispatches info notification", () => {
    showInfoNotification("Info Title", "Info message");
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "notification:show",
        detail: { type: "info", title: "Info Title", message: "Info message" },
      })
    );
    expect(console.info).toHaveBeenCalledWith("[Info Title]", "Info message");
  });

  it("dispatches success notification", () => {
    showSuccessNotification("Success Title", "Success message");
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "notification:show",
        detail: { type: "success", title: "Success Title", message: "Success message" },
      })
    );
  });
});
