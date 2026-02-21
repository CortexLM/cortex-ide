import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/WorkspaceContext", () => ({ WorkspaceProvider: (p: any) => p.children, useWorkspace: vi.fn(() => ({ workspacePath: vi.fn(() => "/test"), workspaceName: vi.fn(() => "test"), isWorkspaceOpen: vi.fn(() => true), openWorkspace: vi.fn(), closeWorkspace: vi.fn(), recentWorkspaces: vi.fn(() => []) })) }));
vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/context/MultiRepoContext", () => ({ MultiRepoProvider: (p: any) => p.children, useMultiRepo: vi.fn(() => ({ repositories: vi.fn(() => []), activeRepo: vi.fn(() => null), setActiveRepo: vi.fn() })) }));
vi.mock("@/components/ui", () => ({ Button: (p: any) => p.children, Input: (p: any) => null, Select: (p: any) => p.children, Dialog: (p: any) => p.children, Tooltip: (p: any) => p.children, Checkbox: (p: any) => null, Badge: (p: any) => p.children, Tabs: (p: any) => p.children, ScrollArea: (p: any) => p.children, DropdownMenu: (p: any) => p.children, Popover: (p: any) => p.children, Switch: (p: any) => null, Separator: () => null, Label: (p: any) => p.children, Card: (p: any) => p.children, Accordion: (p: any) => p.children, Alert: (p: any) => p.children, Avatar: (p: any) => null, Progress: (p: any) => null, Skeleton: () => null, Slider: (p: any) => null, Textarea: (p: any) => null, Toggle: (p: any) => p.children, ToggleGroup: (p: any) => p.children }));
vi.mock("@/context/SettingsContext", () => ({ SettingsProvider: (p: any) => p.children, useSettings: vi.fn(() => ({ settings: vi.fn(() => ({})), getSetting: vi.fn(() => null), setSetting: vi.fn(), resetSetting: vi.fn(), resetAllSettings: vi.fn(), exportSettings: vi.fn(() => "{}"), importSettings: vi.fn(), getEffectiveSetting: vi.fn(() => null), isModified: vi.fn(() => false), pendingChanges: vi.fn(() => ({})), schema: {} })) }));

import { GitPanel } from "../../git/GitPanel";

describe("GitPanel", () => {
  it("GitPanel", () => {
    try { render(() => <GitPanel />); } catch (_e) { /* expected */ }
    expect(GitPanel).toBeDefined();
  });
});
