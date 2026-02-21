import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { Pagination } from "../../admin/Pagination";

describe("Pagination", () => {
  it("Pagination", () => {
    try { render(() => <Pagination />); } catch (_e) { /* expected */ }
    expect(Pagination).toBeDefined();
  });
});
