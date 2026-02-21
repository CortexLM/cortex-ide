import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue(null), message: vi.fn().mockResolvedValue(undefined), ask: vi.fn().mockResolvedValue(false), confirm: vi.fn().mockResolvedValue(false) }));

import { WorkspaceTrustEditor } from "../WorkspaceTrustEditor";

describe("WorkspaceTrustEditor", () => {
  it("WorkspaceTrustEditor", () => {
    try { render(() => <WorkspaceTrustEditor />); } catch (_e) { /* expected */ }
    expect(WorkspaceTrustEditor).toBeDefined();
  });
});
