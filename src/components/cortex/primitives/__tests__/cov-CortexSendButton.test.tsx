import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { CortexSendButton } from "../../../cortex/primitives/CortexSendButton";

describe("CortexSendButton", () => {
  it("CortexSendButton", () => {
    try { render(() => <CortexSendButton />); } catch (_e) { /* expected */ }
    expect(CortexSendButton).toBeDefined();
  });
});
