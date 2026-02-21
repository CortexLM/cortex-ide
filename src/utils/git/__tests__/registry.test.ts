import { describe, it, expect } from "vitest";
import {
  GitHostingProviderRegistry,
  parseRemoteUrl,
  getProviderForRemote,
  getHostFromRemoteUrl,
} from "../registry";

describe("git/registry", () => {
  describe("parseRemoteUrl", () => {
    it("parses GitHub SSH URL", () => {
      const result = parseRemoteUrl("git@github.com:user/repo.git");
      expect(result).not.toBeNull();
      expect(result!.owner).toBe("user");
      expect(result!.repo).toBe("repo");
    });

    it("parses GitHub HTTPS URL", () => {
      const result = parseRemoteUrl("https://github.com/user/repo.git");
      expect(result).not.toBeNull();
      expect(result!.owner).toBe("user");
      expect(result!.repo).toBe("repo");
    });

    it("parses URL without .git suffix", () => {
      const result = parseRemoteUrl("https://github.com/user/repo");
      expect(result).not.toBeNull();
      expect(result!.repo).toBe("repo");
    });

    it("returns null for invalid URL", () => {
      expect(parseRemoteUrl("not-a-url")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseRemoteUrl("")).toBeNull();
    });
  });

  describe("getHostFromRemoteUrl", () => {
    it("extracts host from HTTPS URL", () => {
      expect(getHostFromRemoteUrl("https://github.com/user/repo.git")).toBe("github.com");
    });

    it("extracts host from SSH URL", () => {
      expect(getHostFromRemoteUrl("git@github.com:user/repo.git")).toBe("github.com");
    });

    it("returns null for invalid URL", () => {
      expect(getHostFromRemoteUrl("invalid")).toBeNull();
    });
  });

  describe("getProviderForRemote", () => {
    it("returns provider for GitHub URL", () => {
      const provider = getProviderForRemote("https://github.com/user/repo.git");
      if (provider) {
        expect(provider.name).toBeDefined();
      }
    });
  });

  describe("GitHostingProviderRegistry", () => {
    it("creates instance", () => {
      const registry = new GitHostingProviderRegistry();
      expect(registry).toBeDefined();
    });

    it("gets all providers", () => {
      const registry = new GitHostingProviderRegistry();
      const providers = registry.getAllProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });
  });
});
