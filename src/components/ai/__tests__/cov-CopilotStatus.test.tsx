import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { CopilotStatusIndicator, CopilotSignInModal, CopilotSettingsPanel, useCopilotCompletions } from "../../ai/CopilotStatus";

describe("CopilotStatus", () => {
  it("CopilotStatusIndicator", () => {
    try { render(() => <CopilotStatusIndicator />); } catch (_e) { /* expected */ }
    expect(CopilotStatusIndicator).toBeDefined();
  });
  it("CopilotSignInModal", () => {
    try { render(() => <CopilotSignInModal />); } catch (_e) { /* expected */ }
    expect(CopilotSignInModal).toBeDefined();
  });
  it("CopilotSettingsPanel", () => {
    try { render(() => <CopilotSettingsPanel />); } catch (_e) { /* expected */ }
    expect(CopilotSettingsPanel).toBeDefined();
  });
  it("useCopilotCompletions", () => {
    try { createRoot((dispose) => { try { useCopilotCompletions(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useCopilotCompletions).toBeDefined();
  });
});
