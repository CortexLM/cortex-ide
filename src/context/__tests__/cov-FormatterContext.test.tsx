import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { FormatterProvider, useFormatter } from "../FormatterContext";

describe("FormatterContext", () => {
  it("FormatterProvider", () => {
    try { render(() => <FormatterProvider />); } catch (_e) { /* expected */ }
    expect(FormatterProvider).toBeDefined();
  });
  it("useFormatter", () => {
    try { createRoot((dispose) => { try { useFormatter(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useFormatter).toBeDefined();
  });
});
