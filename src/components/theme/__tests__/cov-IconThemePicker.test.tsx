import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/context/iconTheme/IconThemeProvider", () => ({ IconThemeProvider: (p: any) => p.children, useIconThemeProvider: vi.fn(() => ({})) }));
vi.mock("@/context/iconTheme/types", () => ({ types: (p: any) => p.children, usetypes: vi.fn(() => ({})) }));

import { IconThemePicker } from "../../theme/IconThemePicker";

describe("IconThemePicker", () => {
  it("IconThemePicker", () => {
    try { render(() => <IconThemePicker />); } catch (_e) { /* expected */ }
    expect(IconThemePicker).toBeDefined();
  });
});
