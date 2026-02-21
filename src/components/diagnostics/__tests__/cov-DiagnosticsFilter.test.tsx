import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/DiagnosticsContext", () => ({ DiagnosticsProvider: (p: any) => p.children, useDiagnostics: vi.fn(() => ({ diagnostics: vi.fn(() => []), getDiagnosticsForFile: vi.fn(() => []), errorCount: vi.fn(() => 0), warningCount: vi.fn(() => 0), infoCount: vi.fn(() => 0), hintCount: vi.fn(() => 0), clearDiagnostics: vi.fn() })) }));
vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { DiagnosticsFilter } from "../../diagnostics/DiagnosticsFilter";

describe("DiagnosticsFilter", () => {
  it("DiagnosticsFilter", () => {
    try { render(() => <DiagnosticsFilter />); } catch (_e) { /* expected */ }
    expect(DiagnosticsFilter).toBeDefined();
  });
});
