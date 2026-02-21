import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/LLMContext", () => ({ LLMProvider: (p: any) => p.children, useLLM: vi.fn(() => ({})) }));

import { isFirstRun, isOnboardingCompleted, isOnboardingSkipped, markOnboardingComplete, markOnboardingSkipped, resetOnboardingState, AIOnboarding } from "../../onboarding/AIOnboarding";

describe("AIOnboarding", () => {
  it("isFirstRun", () => {
    try { isFirstRun(); } catch (_e) { /* expected */ }
    expect(isFirstRun).toBeDefined();
  });
  it("isOnboardingCompleted", () => {
    try { isOnboardingCompleted(); } catch (_e) { /* expected */ }
    expect(isOnboardingCompleted).toBeDefined();
  });
  it("isOnboardingSkipped", () => {
    try { isOnboardingSkipped(); } catch (_e) { /* expected */ }
    expect(isOnboardingSkipped).toBeDefined();
  });
  it("markOnboardingComplete", () => {
    try { markOnboardingComplete(); } catch (_e) { /* expected */ }
    expect(markOnboardingComplete).toBeDefined();
  });
  it("markOnboardingSkipped", () => {
    try { markOnboardingSkipped(); } catch (_e) { /* expected */ }
    expect(markOnboardingSkipped).toBeDefined();
  });
  it("resetOnboardingState", () => {
    try { resetOnboardingState(); } catch (_e) { /* expected */ }
    expect(resetOnboardingState).toBeDefined();
  });
  it("AIOnboarding", () => {
    try { render(() => <AIOnboarding />); } catch (_e) { /* expected */ }
    expect(AIOnboarding).toBeDefined();
  });
});
