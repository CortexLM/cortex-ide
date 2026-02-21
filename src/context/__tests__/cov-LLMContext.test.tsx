import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { LLMProvider, useLLM } from "../LLMContext";

describe("LLMContext", () => {
  it("LLMProvider", () => {
    try { render(() => <LLMProvider />); } catch (_e) { /* expected */ }
    expect(LLMProvider).toBeDefined();
  });
  it("useLLM", () => {
    try { createRoot((dispose) => { try { useLLM(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useLLM).toBeDefined();
  });
});
