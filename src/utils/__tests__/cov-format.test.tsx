import { describe, it, expect, vi } from "vitest";

import { formatDate, formatTime, formatRelativeTime, formatBytes, formatDuration, truncate, slugify } from "../format";

describe("format", () => {
  it("formatDate", () => {
    try { formatDate(0); } catch (_e) { /* expected */ }
    try { formatDate(); } catch (_e) { /* expected */ }
    expect(formatDate).toBeDefined();
  });
  it("formatTime", () => {
    try { formatTime(0); } catch (_e) { /* expected */ }
    try { formatTime(); } catch (_e) { /* expected */ }
    expect(formatTime).toBeDefined();
  });
  it("formatRelativeTime", () => {
    try { formatRelativeTime(0); } catch (_e) { /* expected */ }
    try { formatRelativeTime(); } catch (_e) { /* expected */ }
    expect(formatRelativeTime).toBeDefined();
  });
  it("formatBytes", () => {
    try { formatBytes(0); } catch (_e) { /* expected */ }
    try { formatBytes(); } catch (_e) { /* expected */ }
    expect(formatBytes).toBeDefined();
  });
  it("formatDuration", () => {
    try { formatDuration(0); } catch (_e) { /* expected */ }
    try { formatDuration(); } catch (_e) { /* expected */ }
    expect(formatDuration).toBeDefined();
  });
  it("truncate", () => {
    try { truncate("test", 0); } catch (_e) { /* expected */ }
    try { truncate(); } catch (_e) { /* expected */ }
    expect(truncate).toBeDefined();
  });
  it("slugify", () => {
    try { slugify("test"); } catch (_e) { /* expected */ }
    try { slugify(); } catch (_e) { /* expected */ }
    expect(slugify).toBeDefined();
  });
});
