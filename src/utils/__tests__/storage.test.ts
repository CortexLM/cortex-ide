import { describe, it, expect, beforeEach } from "vitest";
import {
  getSessionIds,
  getSessions,
  getSession,
  saveSession,
  deleteSession,
  getMessages,
  saveMessages,
  updateSessionTitle,
  exportData,
} from "../storage";

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getSessionIds", () => {
    it("returns empty array when no sessions", () => {
      expect(getSessionIds()).toEqual([]);
    });

    it("returns session ids after saving", () => {
      saveSession({ id: "s1", title: "Test", createdAt: Date.now(), updatedAt: Date.now() } as any);
      const ids = getSessionIds();
      expect(ids).toContain("s1");
    });
  });

  describe("getSessions", () => {
    it("returns empty array when no sessions", () => {
      expect(getSessions()).toEqual([]);
    });

    it("returns sessions after saving", () => {
      saveSession({ id: "s1", title: "Test", createdAt: Date.now(), updatedAt: Date.now() } as any);
      const sessions = getSessions();
      expect(sessions.length).toBeGreaterThan(0);
    });
  });

  describe("getSession / saveSession", () => {
    it("returns null for non-existent session", () => {
      expect(getSession("nonexistent")).toBeNull();
    });

    it("saves and retrieves session", () => {
      const session = { id: "s1", title: "Test", createdAt: Date.now(), updatedAt: Date.now() } as any;
      saveSession(session);
      const retrieved = getSession("s1");
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe("s1");
      expect(retrieved!.title).toBe("Test");
    });
  });

  describe("deleteSession", () => {
    it("deletes a session", () => {
      saveSession({ id: "s1", title: "Test", createdAt: Date.now(), updatedAt: Date.now() } as any);
      deleteSession("s1");
      expect(getSession("s1")).toBeNull();
    });

    it("handles deleting non-existent session", () => {
      expect(() => deleteSession("nonexistent")).not.toThrow();
    });
  });

  describe("getMessages / saveMessages", () => {
    it("returns empty array for non-existent session", () => {
      expect(getMessages("nonexistent")).toEqual([]);
    });

    it("saves and retrieves messages", () => {
      const messages = [
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
        { role: "assistant", parts: [{ type: "text", content: "Hi" }] },
      ] as any[];
      saveMessages("s1", messages);
      const retrieved = getMessages("s1");
      expect(retrieved).toHaveLength(2);
      const firstPart = retrieved[0].parts[0];
      expect(firstPart.type).toBe("text");
      if (firstPart.type === "text") {
        expect(firstPart.content).toBe("Hello");
      }
    });
  });

  describe("updateSessionTitle", () => {
    it("returns false for non-existent session", () => {
      expect(updateSessionTitle("nonexistent", [])).toBe(false);
    });

    it("updates session title from first user message", () => {
      saveSession({ id: "s1", title: "New Session", createdAt: Date.now(), updatedAt: Date.now() } as any);
      const messages = [
        { role: "user", parts: [{ type: "text", content: "How to write tests" }] },
      ] as any[];
      const updated = updateSessionTitle("s1", messages);
      expect(updated).toBe(true);
    });

    it("does not update custom title", () => {
      saveSession({ id: "s1", title: "My Custom Title", createdAt: Date.now(), updatedAt: Date.now() } as any);
      const messages = [
        { role: "user", parts: [{ type: "text", content: "New content" }] },
      ] as any[];
      const updated = updateSessionTitle("s1", messages);
      expect(updated).toBe(false);
    });
  });

  describe("exportData", () => {
    it("exports data as JSON string", () => {
      saveSession({ id: "s1", title: "Test", createdAt: Date.now(), updatedAt: Date.now() } as any);
      const data = exportData();
      expect(typeof data).toBe("string");
      const parsed = JSON.parse(data);
      expect(parsed).toBeDefined();
    });

    it("exports empty data", () => {
      const data = exportData();
      expect(typeof data).toBe("string");
    });
  });
});
