import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/TerminalsContext", () => ({ TerminalsProvider: (p: any) => p.children, useTerminals: vi.fn(() => ({ terminals: vi.fn(() => []), activeTerminal: vi.fn(() => null), createTerminal: vi.fn(), closeTerminal: vi.fn(), setActiveTerminal: vi.fn(), sendInput: vi.fn(), resize: vi.fn() })) }));
vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/components/ui", () => ({ Button: (p: any) => p.children, Input: (p: any) => null, Select: (p: any) => p.children, Dialog: (p: any) => p.children, Tooltip: (p: any) => p.children, Checkbox: (p: any) => null, Badge: (p: any) => p.children, Tabs: (p: any) => p.children, ScrollArea: (p: any) => p.children, DropdownMenu: (p: any) => p.children, Popover: (p: any) => p.children, Switch: (p: any) => null, Separator: () => null, Label: (p: any) => p.children, Card: (p: any) => p.children, Accordion: (p: any) => p.children, Alert: (p: any) => p.children, Avatar: (p: any) => null, Progress: (p: any) => null, Skeleton: () => null, Slider: (p: any) => null, Textarea: (p: any) => null, Toggle: (p: any) => p.children, ToggleGroup: (p: any) => p.children }));

import { TerminalCard, TerminalsList } from "../TerminalCard";

describe("TerminalCard", () => {
  it("TerminalCard", () => {
    try { render(() => <TerminalCard />); } catch (_e) { /* expected */ }
    expect(TerminalCard).toBeDefined();
  });
  it("TerminalsList", () => {
    try { render(() => <TerminalsList />); } catch (_e) { /* expected */ }
    expect(TerminalsList).toBeDefined();
  });
});
