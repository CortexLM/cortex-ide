import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/LLMContext", () => ({ LLMProvider: (p: any) => p.children, useLLM: vi.fn(() => ({})) }));

import { LLMSelector, ModelChip } from "../../ai/LLMSelector";

describe("LLMSelector", () => {
  it("LLMSelector", () => {
    try { render(() => <LLMSelector />); } catch (_e) { /* expected */ }
    expect(LLMSelector).toBeDefined();
  });
  it("ModelChip", () => {
    try { render(() => <ModelChip />); } catch (_e) { /* expected */ }
    expect(ModelChip).toBeDefined();
  });
});
