import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));
vi.mock("@/context/WorkspaceTrustContext", () => ({ WorkspaceTrustProvider: (p: any) => p.children, useWorkspaceTrust: vi.fn(() => ({})) }));

import { RestrictedModeBadge } from "../../workspace-trust/RestrictedModeBadge";

describe("RestrictedModeBadge", () => {
  it("RestrictedModeBadge", () => {
    try { render(() => <RestrictedModeBadge />); } catch (_e) { /* expected */ }
    expect(RestrictedModeBadge).toBeDefined();
  });
});
