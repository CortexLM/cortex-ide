import { describe, it, expect, vi } from "vitest";

import { combineWizardSteps, useQuickPickWizard, createInputStep, createWizardStep } from "../useQuickPickWizard";

describe("useQuickPickWizard", () => {
  it("combineWizardSteps", () => { expect(typeof combineWizardSteps).toBe("function"); });
  it("useQuickPickWizard", () => { expect(typeof useQuickPickWizard).toBe("function"); });
  it("createInputStep", () => { expect(typeof createInputStep).toBe("function"); });
  it("createWizardStep", () => { expect(typeof createWizardStep).toBe("function"); });
});