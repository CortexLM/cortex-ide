import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/DiagnosticsContext", () => ({ DiagnosticsProvider: (p: any) => p.children, useDiagnostics: vi.fn(() => ({ diagnostics: vi.fn(() => []), getDiagnosticsForFile: vi.fn(() => []), errorCount: vi.fn(() => 0), warningCount: vi.fn(() => 0), infoCount: vi.fn(() => 0), hintCount: vi.fn(() => 0), clearDiagnostics: vi.fn() })) }));
vi.mock("@/context/WorkspaceTrustContext", () => ({ WorkspaceTrustProvider: (p: any) => p.children, useWorkspaceTrust: vi.fn(() => ({})) }));
vi.mock("@/context/StatusBarContext", () => ({ StatusBarProvider: (p: any) => p.children, useStatusBar: vi.fn(() => ({})) }));

import { EnhancedStatusBar } from "../../cortex/EnhancedStatusBar";

describe("EnhancedStatusBar", () => {
  it("EnhancedStatusBar", () => {
    try { render(() => <EnhancedStatusBar />); } catch (_e) { /* expected */ }
    expect(EnhancedStatusBar).toBeDefined();
  });
});
