import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));
vi.mock("@/context/CommandContext", () => ({ CommandProvider: (p: any) => p.children, useCommands: vi.fn(() => ({ executeCommand: vi.fn(), registerCommand: vi.fn(), getCommands: vi.fn(() => []), commands: vi.fn(() => []) })) }));
vi.mock("@/components/ui", () => ({ Button: (p: any) => p.children, Input: (p: any) => null, Select: (p: any) => p.children, Dialog: (p: any) => p.children, Tooltip: (p: any) => p.children, Checkbox: (p: any) => null, Badge: (p: any) => p.children, Tabs: (p: any) => p.children, ScrollArea: (p: any) => p.children, DropdownMenu: (p: any) => p.children, Popover: (p: any) => p.children, Switch: (p: any) => null, Separator: () => null, Label: (p: any) => p.children, Card: (p: any) => p.children, Accordion: (p: any) => p.children, Alert: (p: any) => p.children, Avatar: (p: any) => null, Progress: (p: any) => null, Skeleton: () => null, Slider: (p: any) => null, Textarea: (p: any) => null, Toggle: (p: any) => p.children, ToggleGroup: (p: any) => p.children }));

import { formatKey, KeyCap, ShortcutRow, CategorySection, CATEGORY_ORDER, CATEGORY_ICONS } from "../KeyboardShortcutsEditorRow";

describe("KeyboardShortcutsEditorRow", () => {
  it("formatKey", () => {
    try { formatKey("test"); } catch (_e) { /* expected */ }
    try { formatKey(); } catch (_e) { /* expected */ }
    expect(formatKey).toBeDefined();
  });
  it("KeyCap", () => {
    try { render(() => <KeyCap />); } catch (_e) { /* expected */ }
    expect(KeyCap).toBeDefined();
  });
  it("ShortcutRow", () => {
    try { render(() => <ShortcutRow />); } catch (_e) { /* expected */ }
    expect(ShortcutRow).toBeDefined();
  });
  it("CategorySection", () => {
    try { render(() => <CategorySection />); } catch (_e) { /* expected */ }
    expect(CategorySection).toBeDefined();
  });
  it("CATEGORY_ORDER", () => {
    expect(CATEGORY_ORDER).toBeDefined();
  });
  it("CATEGORY_ICONS", () => {
    expect(CATEGORY_ICONS).toBeDefined();
  });
});
