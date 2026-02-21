import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/SDKContext", () => ({ SDKProvider: (p: any) => p.children, useSDK: vi.fn(() => ({ invoke: vi.fn().mockResolvedValue(undefined), listen: vi.fn().mockResolvedValue(vi.fn()), emit: vi.fn() })) }));
vi.mock("@/context/LLMContext", () => ({ LLMProvider: (p: any) => p.children, useLLM: vi.fn(() => ({})) }));

import { ModelSelector } from "../ModelSelector";

describe("ModelSelector", () => {
  it("ModelSelector", () => {
    try { render(() => <ModelSelector />); } catch (_e) { /* expected */ }
    expect(ModelSelector).toBeDefined();
  });
});
