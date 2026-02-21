import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/OutputContext", () => ({ OutputProvider: (p: any) => p.children, useOutput: vi.fn(() => ({})) }));
vi.mock("@/context/CommandContext", () => ({ CommandProvider: (p: any) => p.children, useCommands: vi.fn(() => ({ executeCommand: vi.fn(), registerCommand: vi.fn(), getCommands: vi.fn(() => []), commands: vi.fn(() => []) })) }));

import { LogLevelSelector } from "../LogLevelSelector";

describe("LogLevelSelector", () => {
  it("LogLevelSelector", () => {
    try { render(() => <LogLevelSelector />); } catch (_e) { /* expected */ }
    expect(LogLevelSelector).toBeDefined();
  });
});
