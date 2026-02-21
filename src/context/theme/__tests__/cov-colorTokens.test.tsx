import { describe, it, expect, vi } from "vitest";

import { UI_COLOR_TOKENS, EDITOR_COLOR_TOKENS, SYNTAX_COLOR_TOKENS, TERMINAL_COLOR_TOKENS, COMPONENT_COLOR_TOKENS } from "../../theme/colorTokens";

describe("colorTokens", () => {
  it("UI_COLOR_TOKENS", () => {
    expect(UI_COLOR_TOKENS).toBeDefined();
  });
  it("EDITOR_COLOR_TOKENS", () => {
    expect(EDITOR_COLOR_TOKENS).toBeDefined();
  });
  it("SYNTAX_COLOR_TOKENS", () => {
    expect(SYNTAX_COLOR_TOKENS).toBeDefined();
  });
  it("TERMINAL_COLOR_TOKENS", () => {
    expect(TERMINAL_COLOR_TOKENS).toBeDefined();
  });
  it("COMPONENT_COLOR_TOKENS", () => {
    expect(COMPONENT_COLOR_TOKENS).toBeDefined();
  });
});
