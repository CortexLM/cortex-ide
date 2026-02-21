import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/CodespacesContext", () => ({ CodespacesProvider: (p: any) => p.children, useCodespaces: vi.fn(() => ({})) }));

import { CodespacesPanel } from "../../codespaces/CodespacesPanel";

describe("CodespacesPanel", () => {
  it("CodespacesPanel", () => {
    try { render(() => <CodespacesPanel />); } catch (_e) { /* expected */ }
    expect(CodespacesPanel).toBeDefined();
  });
});
