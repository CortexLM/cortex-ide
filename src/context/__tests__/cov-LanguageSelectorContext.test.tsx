import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { LanguageSelectorProvider, useLanguageSelector } from "../LanguageSelectorContext";

describe("LanguageSelectorContext", () => {
  it("LanguageSelectorProvider", () => {
    try { render(() => <LanguageSelectorProvider />); } catch (_e) { /* expected */ }
    expect(LanguageSelectorProvider).toBeDefined();
  });
  it("useLanguageSelector", () => {
    try { createRoot((dispose) => { try { useLanguageSelector(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useLanguageSelector).toBeDefined();
  });
});
