import { describe, it, expect, vi } from "vitest";

import { events } from "../../telemetry/TelemetryEvents";

describe("TelemetryEvents", () => {
  it("events", () => {
    expect(events).toBeDefined();
  });
});
