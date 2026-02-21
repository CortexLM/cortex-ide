import { describe, it, expect } from "vitest";
import { createLogger } from "../logger";

describe("logger", () => {
  describe("createLogger", () => {
    it("creates logger with prefix", () => {
      const log = createLogger("Test", true);
      expect(log).toBeDefined();
    });

    it("logger has standard methods", () => {
      const log = createLogger("Test", true);
      expect(typeof log.info).toBe("function");
      expect(typeof log.warn).toBe("function");
      expect(typeof log.error).toBe("function");
      expect(typeof log.debug).toBe("function");
    });

    it("info method exists", () => {
      const log = createLogger("Test", true);
      expect(typeof log.info).toBe("function");
    });

    it("warn method exists", () => {
      const log = createLogger("Test", true);
      expect(typeof log.warn).toBe("function");
    });

    it("error method exists", () => {
      const log = createLogger("Test", true);
      expect(typeof log.error).toBe("function");
    });

    it("debug method exists", () => {
      const log = createLogger("Test", true);
      expect(typeof log.debug).toBe("function");
    });
  });
});
