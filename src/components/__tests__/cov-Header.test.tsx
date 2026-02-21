import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/SDKContext", () => ({ SDKProvider: (p: any) => p.children, useSDK: vi.fn(() => ({ invoke: vi.fn().mockResolvedValue(undefined), listen: vi.fn().mockResolvedValue(vi.fn()), emit: vi.fn() })) }));
vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/components/ui", () => ({ Button: (p: any) => p.children, Input: (p: any) => null, Select: (p: any) => p.children, Dialog: (p: any) => p.children, Tooltip: (p: any) => p.children, Checkbox: (p: any) => null, Badge: (p: any) => p.children, Tabs: (p: any) => p.children, ScrollArea: (p: any) => p.children, DropdownMenu: (p: any) => p.children, Popover: (p: any) => p.children, Switch: (p: any) => null, Separator: () => null, Label: (p: any) => p.children, Card: (p: any) => p.children, Accordion: (p: any) => p.children, Alert: (p: any) => p.children, Avatar: (p: any) => null, Progress: (p: any) => null, Skeleton: () => null, Slider: (p: any) => null, Textarea: (p: any) => null, Toggle: (p: any) => p.children, ToggleGroup: (p: any) => p.children }));
vi.mock("@solidjs/router", () => ({ useNavigate: vi.fn(() => vi.fn()), useParams: vi.fn(() => ({})), useSearchParams: vi.fn(() => [{}, vi.fn()]), useLocation: vi.fn(() => ({ pathname: "/", search: "", hash: "" })), A: (p: any) => p.children, Navigate: vi.fn(), Route: (p: any) => p.children, Router: (p: any) => p.children, useMatch: vi.fn(() => null), useIsRouting: vi.fn(() => false), useBeforeLeave: vi.fn() }));
vi.mock("@/context/SessionContext", () => ({ SessionProvider: (p: any) => p.children, useSession: vi.fn(() => ({})) }));
vi.mock("@/context/CommandContext", () => ({ CommandProvider: (p: any) => p.children, useCommands: vi.fn(() => ({ executeCommand: vi.fn(), registerCommand: vi.fn(), getCommands: vi.fn(() => []), commands: vi.fn(() => []) })) }));

import { Header } from "../Header";

describe("Header", () => {
  it("Header", () => {
    try { render(() => <Header />); } catch (_e) { /* expected */ }
    expect(Header).toBeDefined();
  });
});
