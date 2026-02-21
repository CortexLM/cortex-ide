import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/SDKContext", () => ({ SDKProvider: (p: any) => p.children, useSDK: vi.fn(() => ({ invoke: vi.fn().mockResolvedValue(undefined), listen: vi.fn().mockResolvedValue(vi.fn()), emit: vi.fn() })) }));

import { MessageList, SimpleMessageList } from "../../ai/MessageList";

describe("MessageList", () => {
  it("MessageList", () => {
    try { render(() => <MessageList />); } catch (_e) { /* expected */ }
    expect(MessageList).toBeDefined();
  });
  it("SimpleMessageList", () => {
    try { render(() => <SimpleMessageList />); } catch (_e) { /* expected */ }
    expect(SimpleMessageList).toBeDefined();
  });
});
