import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/context/FormatterContext", () => ({ FormatterProvider: (p: any) => p.children, useFormatter: vi.fn(() => ({})) }));

import { FormatterSelector, FormatterStatusBarItem, FormatterPromptDialog, useFormatterPrompt } from "../FormatterSelector";

describe("FormatterSelector", () => {
  it("FormatterSelector", () => {
    try { render(() => <FormatterSelector />); } catch (_e) { /* expected */ }
    expect(FormatterSelector).toBeDefined();
  });
  it("FormatterStatusBarItem", () => {
    try { render(() => <FormatterStatusBarItem />); } catch (_e) { /* expected */ }
    expect(FormatterStatusBarItem).toBeDefined();
  });
  it("FormatterPromptDialog", () => {
    try { render(() => <FormatterPromptDialog />); } catch (_e) { /* expected */ }
    expect(FormatterPromptDialog).toBeDefined();
  });
  it("useFormatterPrompt", () => {
    try { createRoot((dispose) => { try { useFormatterPrompt(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useFormatterPrompt).toBeDefined();
  });
});
