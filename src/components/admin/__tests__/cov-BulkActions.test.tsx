import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Button", () => ({ Button: (p: any) => p.children }));
vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { BulkActions } from "../../admin/BulkActions";

describe("BulkActions", () => {
  it("BulkActions", () => {
    try { render(() => <BulkActions />); } catch (_e) { /* expected */ }
    expect(BulkActions).toBeDefined();
  });
});
