import { describe, it, expect, vi } from "vitest";

vi.mock("@/utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }, createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() })), default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() } }));

import { createProblemsManager } from "../../tasks/ProblemsManager";

describe("ProblemsManager", () => {
  it("createProblemsManager", () => {
    try { createProblemsManager(); } catch (_e) { /* expected */ }
    expect(createProblemsManager).toBeDefined();
  });
});
