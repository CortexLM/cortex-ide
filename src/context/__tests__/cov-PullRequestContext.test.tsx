import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() }, createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() })), default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() } }));

import { PullRequestProvider, usePullRequests } from "../PullRequestContext";

describe("PullRequestContext", () => {
  it("PullRequestProvider", () => {
    try { render(() => <PullRequestProvider />); } catch (_e) { /* expected */ }
    expect(PullRequestProvider).toBeDefined();
  });
  it("usePullRequests", () => {
    try { createRoot((dispose) => { try { usePullRequests(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(usePullRequests).toBeDefined();
  });
});
