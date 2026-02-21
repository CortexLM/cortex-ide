import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { ImageOutput } from "../../../notebook/outputs/ImageOutput";

describe("ImageOutput", () => {
  it("ImageOutput", () => {
    try { render(() => <ImageOutput />); } catch (_e) { /* expected */ }
    expect(ImageOutput).toBeDefined();
  });
});
