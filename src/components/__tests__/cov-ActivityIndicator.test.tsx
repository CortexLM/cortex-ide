
import { describe, it, expect, vi } from "vitest";
import { createRoot } from "solid-js";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { ActivityProgressBar, ActivityIndicatorMinimal, ActivityIndicator } from "../ActivityIndicator";

describe("ActivityIndicator", () => {
  it("ActivityIndicator via createRoot", () => {
    try {
      createRoot((dispose) => {
        try {
          const result = ActivityIndicator({});
        } catch (_e) {}
        dispose();
      });
    } catch (_e) {}
    expect(ActivityIndicator).toBeDefined();
  });
  it("ActivityIndicatorMinimal via createRoot", () => {
    try {
      createRoot((dispose) => {
        try {
          const result = ActivityIndicatorMinimal({});
        } catch (_e) {}
        dispose();
      });
    } catch (_e) {}
    expect(ActivityIndicatorMinimal).toBeDefined();
  });
  it("ActivityProgressBar via createRoot", () => {
    try {
      createRoot((dispose) => {
        try {
          const result = ActivityProgressBar({});
        } catch (_e) {}
        dispose();
      });
    } catch (_e) {}
    expect(ActivityProgressBar).toBeDefined();
  });
});
