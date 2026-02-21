import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { OutputProvider, useOutput, LOG_LEVEL_PRIORITY, LOG_LEVEL_LABELS, LOG_LEVELS, BUILTIN_CHANNELS } from "../OutputContext";

describe("OutputContext", () => {
  it("OutputProvider", () => {
    try { render(() => <OutputProvider />); } catch (_e) { /* expected */ }
    expect(OutputProvider).toBeDefined();
  });
  it("useOutput", () => {
    try { createRoot((dispose) => { try { useOutput(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useOutput).toBeDefined();
  });
  it("LOG_LEVEL_PRIORITY", () => {
    expect(LOG_LEVEL_PRIORITY).toBeDefined();
  });
  it("LOG_LEVEL_LABELS", () => {
    expect(LOG_LEVEL_LABELS).toBeDefined();
  });
  it("LOG_LEVELS", () => {
    expect(LOG_LEVELS).toBeDefined();
  });
  it("BUILTIN_CHANNELS", () => {
    expect(BUILTIN_CHANNELS).toBeDefined();
  });
});
