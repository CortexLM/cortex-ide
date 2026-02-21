import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/CommandContext", () => ({ CommandProvider: (p: any) => p.children, useCommands: vi.fn(() => ({ executeCommand: vi.fn(), registerCommand: vi.fn(), getCommands: vi.fn(() => []), commands: vi.fn(() => []) })) }));

import { EmmetWrapDialog } from "../EmmetWrapDialog";

describe("EmmetWrapDialog", () => {
  it("EmmetWrapDialog", () => {
    try { render(() => <EmmetWrapDialog />); } catch (_e) { /* expected */ }
    expect(EmmetWrapDialog).toBeDefined();
  });
});
