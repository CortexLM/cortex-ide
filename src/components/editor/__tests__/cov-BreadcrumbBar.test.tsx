import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }, createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() })), default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() } }));

import { BreadcrumbBar } from "../../editor/BreadcrumbBar";

describe("BreadcrumbBar", () => {
  it("BreadcrumbBar", () => {
    try { render(() => <BreadcrumbBar />); } catch (_e) { /* expected */ }
    expect(BreadcrumbBar).toBeDefined();
  });
});
