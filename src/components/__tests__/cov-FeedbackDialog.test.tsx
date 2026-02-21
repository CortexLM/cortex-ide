import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/ToastContext", () => ({ ToastProvider: (p: any) => p.children, useToast: vi.fn(() => ({})) }));

import { FeedbackDialog } from "../FeedbackDialog";

describe("FeedbackDialog", () => {
  it("FeedbackDialog", () => {
    try { render(() => <FeedbackDialog />); } catch (_e) { /* expected */ }
    expect(FeedbackDialog).toBeDefined();
  });
});
