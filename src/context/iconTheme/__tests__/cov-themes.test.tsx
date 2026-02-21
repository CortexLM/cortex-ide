import { describe, it, expect, vi } from "vitest";

import { BUILTIN_THEMES } from "../../iconTheme/themes";

describe("themes", () => {
  it("BUILTIN_THEMES", () => {
    expect(BUILTIN_THEMES).toBeDefined();
  });
});
