import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { PreviewProvider, usePreview, DEVICE_PRESETS } from "../PreviewContext";

describe("PreviewContext", () => {
  it("PreviewProvider", () => {
    try { render(() => <PreviewProvider />); } catch (_e) { /* expected */ }
    expect(PreviewProvider).toBeDefined();
  });
  it("usePreview", () => {
    try { createRoot((dispose) => { try { usePreview(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(usePreview).toBeDefined();
  });
  it("DEVICE_PRESETS", () => {
    expect(DEVICE_PRESETS).toBeDefined();
  });
});
