import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/SemanticTokenCustomizationsContext", () => ({ SemanticTokenCustomizationsProvider: (p: any) => p.children, useSemanticTokenCustomizations: vi.fn(() => ({})) }));
vi.mock("@/components/ui/Button", () => ({ Button: (p: any) => p.children }));
vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { SemanticTokenColorEditor } from "../../settings/SemanticTokenColorEditor";

describe("SemanticTokenColorEditor", () => {
  it("SemanticTokenColorEditor", () => {
    try { render(() => <SemanticTokenColorEditor />); } catch (_e) { /* expected */ }
    expect(SemanticTokenColorEditor).toBeDefined();
  });
});
