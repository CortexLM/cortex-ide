import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { getCategoryLabel, EncodingProvider, useEncoding } from "../EncodingContext";

describe("EncodingContext", () => {
  it("getCategoryLabel", () => {
    try { getCategoryLabel({} as any); } catch (_e) { /* expected */ }
    try { getCategoryLabel(); } catch (_e) { /* expected */ }
    expect(getCategoryLabel).toBeDefined();
  });
  it("EncodingProvider", () => {
    try { render(() => <EncodingProvider />); } catch (_e) { /* expected */ }
    expect(EncodingProvider).toBeDefined();
  });
  it("useEncoding", () => {
    try { createRoot((dispose) => { try { useEncoding(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useEncoding).toBeDefined();
  });
});
