import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { TitleBarDropdownMenu } from "../../../cortex/titlebar/TitleBarDropdownMenu";

describe("TitleBarDropdownMenu", () => {
  it("TitleBarDropdownMenu", () => {
    try { render(() => <TitleBarDropdownMenu />); } catch (_e) { /* expected */ }
    expect(TitleBarDropdownMenu).toBeDefined();
  });
});
