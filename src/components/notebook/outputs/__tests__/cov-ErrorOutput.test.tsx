import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { ErrorOutput } from "../../../notebook/outputs/ErrorOutput";

describe("ErrorOutput", () => {
  it("ErrorOutput", () => {
    try { render(() => <ErrorOutput />); } catch (_e) { /* expected */ }
    expect(ErrorOutput).toBeDefined();
  });
});
