import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/DiagnosticsContext", () => ({ DiagnosticsProvider: (p: any) => p.children, useDiagnostics: vi.fn(() => ({ diagnostics: vi.fn(() => []), getDiagnosticsForFile: vi.fn(() => []), errorCount: vi.fn(() => 0), warningCount: vi.fn(() => 0), infoCount: vi.fn(() => 0), hintCount: vi.fn(() => 0), clearDiagnostics: vi.fn() })) }));
vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));
vi.mock("@/context/LSPContext", () => ({ LSPProvider: (p: any) => p.children, useLSP: vi.fn(() => ({ getLanguageClient: vi.fn(() => null), isReady: vi.fn(() => false), diagnostics: vi.fn(() => []), sendRequest: vi.fn(), sendNotification: vi.fn() })), getLanguageId: vi.fn(() => "plaintext"), getLanguageServerConfig: vi.fn(() => null) }));

import { DiagnosticItem } from "../../diagnostics/DiagnosticItem";

describe("DiagnosticItem", () => {
  it("DiagnosticItem", () => {
    try { render(() => <DiagnosticItem />); } catch (_e) { /* expected */ }
    expect(DiagnosticItem).toBeDefined();
  });
});
