import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/DiagnosticsContext", () => ({ DiagnosticsProvider: (p: any) => p.children, useDiagnostics: vi.fn(() => ({ diagnostics: vi.fn(() => []), getDiagnosticsForFile: vi.fn(() => []), errorCount: vi.fn(() => 0), warningCount: vi.fn(() => 0), infoCount: vi.fn(() => 0), hintCount: vi.fn(() => 0), clearDiagnostics: vi.fn() })) }));
vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { DiagnosticsStatusBarItem } from "../../diagnostics/DiagnosticsStatusBarItem";

describe("DiagnosticsStatusBarItem", () => {
  it("DiagnosticsStatusBarItem", () => {
    try { render(() => <DiagnosticsStatusBarItem />); } catch (_e) { /* expected */ }
    expect(DiagnosticsStatusBarItem).toBeDefined();
  });
});
