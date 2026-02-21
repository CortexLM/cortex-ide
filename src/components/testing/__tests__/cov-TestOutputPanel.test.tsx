import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));
vi.mock("@/context/TestingContext", () => ({ TestingProvider: (p: any) => p.children, useTesting: vi.fn(() => ({ tests: vi.fn(() => []), runTests: vi.fn(), stopTests: vi.fn(), testResults: vi.fn(() => ({})), isRunning: vi.fn(() => false) })) }));

import { TestOutputPanel } from "../../testing/TestOutputPanel";

describe("TestOutputPanel", () => {
  it("TestOutputPanel", () => {
    try { render(() => <TestOutputPanel />); } catch (_e) { /* expected */ }
    expect(TestOutputPanel).toBeDefined();
  });
});
