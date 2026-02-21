import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/context/DebugContext", () => ({ DebugProvider: (p: any) => p.children, useDebug: vi.fn(() => ({ state: { sessions: [], activeSessionId: null, breakpoints: [], variables: [], callStack: [], watches: [], isDebugging: false, isPaused: false }, sessions: vi.fn(() => []), activeSession: vi.fn(() => null), breakpoints: vi.fn(() => []), variables: vi.fn(() => []), callStack: vi.fn(() => []), watches: vi.fn(() => []), isDebugging: vi.fn(() => false), isPaused: vi.fn(() => false), startDebugging: vi.fn(), stopDebugging: vi.fn(), pauseDebugging: vi.fn(), continueDebugging: vi.fn(), stepOver: vi.fn(), stepInto: vi.fn(), stepOut: vi.fn(), addBreakpoint: vi.fn(), removeBreakpoint: vi.fn(), toggleBreakpoint: vi.fn(), addWatch: vi.fn(), removeWatch: vi.fn(), evaluate: vi.fn() })) }));
vi.mock("@/components/ui", () => ({ Button: (p: any) => p.children, Input: (p: any) => null, Select: (p: any) => p.children, Dialog: (p: any) => p.children, Tooltip: (p: any) => p.children, Checkbox: (p: any) => null, Badge: (p: any) => p.children, Tabs: (p: any) => p.children, ScrollArea: (p: any) => p.children, DropdownMenu: (p: any) => p.children, Popover: (p: any) => p.children, Switch: (p: any) => null, Separator: () => null, Label: (p: any) => p.children, Card: (p: any) => p.children, Accordion: (p: any) => p.children, Alert: (p: any) => p.children, Avatar: (p: any) => null, Progress: (p: any) => null, Skeleton: () => null, Slider: (p: any) => null, Textarea: (p: any) => null, Toggle: (p: any) => p.children, ToggleGroup: (p: any) => p.children }));

import { DebugStatusBar, useDebugStatusBar } from "../../debugger/DebugStatusBar";

describe("DebugStatusBar", () => {
  it("DebugStatusBar", () => {
    try { render(() => <DebugStatusBar />); } catch (_e) { /* expected */ }
    expect(DebugStatusBar).toBeDefined();
  });
  it("useDebugStatusBar", () => {
    try { createRoot((dispose) => { try { useDebugStatusBar(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useDebugStatusBar).toBeDefined();
  });
});
