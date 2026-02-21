import { describe, it, expect, vi } from "vitest";

import { setiTheme } from "../../iconTheme/themes-seti";

describe("themes-seti", () => {
  it("setiTheme", () => {
    expect(setiTheme).toBeDefined();
  });
});
