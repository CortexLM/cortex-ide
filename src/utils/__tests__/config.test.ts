import { describe, it, expect } from "vitest";
import { API_BASE_URL, getWsUrl } from "../config";

describe("config", () => {
  it("has default API base URL", () => {
    expect(API_BASE_URL).toBe("http://localhost:3000");
  });

  describe("getWsUrl", () => {
    it("converts http to ws", () => {
      expect(getWsUrl("/events")).toMatch(/^ws:\/\//);
      expect(getWsUrl("/events")).toContain("/events");
    });
    it("normalizes path with leading slash", () => {
      expect(getWsUrl("events")).toContain("/events");
    });
    it("preserves path with leading slash", () => {
      expect(getWsUrl("/events")).toContain("/events");
    });
  });
});
