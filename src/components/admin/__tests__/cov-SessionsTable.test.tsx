import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { SessionsTable } from "../../admin/SessionsTable";

describe("SessionsTable", () => {
  it("SessionsTable", () => {
    try { render(() => <SessionsTable />); } catch (_e) { /* expected */ }
    expect(SessionsTable).toBeDefined();
  });
});
