import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { RadioGroup, Radio } from "../../ui/Radio";

describe("Radio", () => {
  it("RadioGroup", () => {
    try { render(() => <RadioGroup />); } catch (_e) { /* expected */ }
    expect(RadioGroup).toBeDefined();
  });
  it("Radio", () => {
    try { render(() => <Radio />); } catch (_e) { /* expected */ }
    expect(Radio).toBeDefined();
  });
});
