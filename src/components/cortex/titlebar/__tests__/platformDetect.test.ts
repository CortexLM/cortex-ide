import { describe, it, expect, vi, afterEach } from "vitest";

describe("platformDetect", () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      writable: true,
      configurable: true,
    });
    vi.resetModules();
  });

  const setUserAgent = (ua: string) => {
    Object.defineProperty(navigator, "userAgent", {
      value: ua,
      writable: true,
      configurable: true,
    });
  };

  const importFresh = async () => {
    const mod = await import("../platformDetect");
    return mod.detectPlatform;
  };

  describe("macOS detection", () => {
    it("should return 'macos' for Mac OS X userAgent", async () => {
      setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36");
      const detectPlatform = await importFresh();
      expect(detectPlatform()).toBe("macos");
    });

    it("should return 'macos' for iPhone userAgent", async () => {
      setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)");
      const detectPlatform = await importFresh();
      expect(detectPlatform()).toBe("macos");
    });

    it("should return 'macos' for iPad userAgent", async () => {
      setUserAgent("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)");
      const detectPlatform = await importFresh();
      expect(detectPlatform()).toBe("macos");
    });

    it("should return 'macos' for iPod userAgent", async () => {
      setUserAgent("Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)");
      const detectPlatform = await importFresh();
      expect(detectPlatform()).toBe("macos");
    });
  });

  describe("Windows detection", () => {
    it("should return 'windows' for Windows 10 userAgent", async () => {
      setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
      const detectPlatform = await importFresh();
      expect(detectPlatform()).toBe("windows");
    });

    it("should return 'windows' for Windows 11 userAgent", async () => {
      setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0)");
      const detectPlatform = await importFresh();
      expect(detectPlatform()).toBe("windows");
    });
  });

  describe("Linux detection (fallback)", () => {
    it("should return 'linux' for Linux userAgent", async () => {
      setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36");
      const detectPlatform = await importFresh();
      expect(detectPlatform()).toBe("linux");
    });

    it("should return 'linux' for unknown userAgent", async () => {
      setUserAgent("SomeUnknownBrowser/1.0");
      const detectPlatform = await importFresh();
      expect(detectPlatform()).toBe("linux");
    });

    it("should return 'linux' for empty userAgent", async () => {
      setUserAgent("");
      const detectPlatform = await importFresh();
      expect(detectPlatform()).toBe("linux");
    });
  });

  describe("Platform type", () => {
    it("should return a value that is one of the Platform type options", async () => {
      const detectPlatform = await importFresh();
      const result = detectPlatform();
      expect(["macos", "windows", "linux"]).toContain(result);
    });
  });
});
