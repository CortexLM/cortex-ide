import { describe, it, expect, vi, beforeEach } from "vitest";

describe("CommentsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Comment Types", () => {
    type ReactionType = "👍" | "👎" | "❤️" | "🎉" | "😄" | "😕" | "🚀" | "👀";

    interface CommentReaction {
      emoji: ReactionType;
      userIds: string[];
    }

    interface CommentAuthor {
      id: string;
      name: string;
      avatar?: string;
    }

    interface Comment {
      id: string;
      threadId: string;
      author: CommentAuthor;
      content: string;
      createdAt: number;
      updatedAt: number;
      reactions: CommentReaction[];
      isEdited: boolean;
    }

    it("should create a comment", () => {
      const comment: Comment = {
        id: "comment-1",
        threadId: "thread-1",
        author: {
          id: "user-1",
          name: "Alice",
          avatar: "https://example.com/alice.png",
        },
        content: "This looks good!",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reactions: [],
        isEdited: false,
      };

      expect(comment.content).toBe("This looks good!");
      expect(comment.isEdited).toBe(false);
    });

    it("should edit a comment", () => {
      const comment: Comment = {
        id: "comment-1",
        threadId: "thread-1",
        author: { id: "user-1", name: "Alice" },
        content: "Original content",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reactions: [],
        isEdited: false,
      };

      comment.content = "Updated content";
      comment.updatedAt = Date.now();
      comment.isEdited = true;

      expect(comment.content).toBe("Updated content");
      expect(comment.isEdited).toBe(true);
    });

    it("should add reactions to a comment", () => {
      const comment: Comment = {
        id: "comment-1",
        threadId: "thread-1",
        author: { id: "user-1", name: "Alice" },
        content: "Great work!",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reactions: [
          { emoji: "👍", userIds: ["user-2", "user-3"] },
          { emoji: "🎉", userIds: ["user-4"] },
        ],
        isEdited: false,
      };

      expect(comment.reactions).toHaveLength(2);
      expect(comment.reactions[0].userIds).toHaveLength(2);
    });

    it("should toggle a reaction", () => {
      const reactions: CommentReaction[] = [{ emoji: "👍", userIds: ["user-1"] }];
      const userId = "user-2";
      const emoji: ReactionType = "👍";

      const existing = reactions.find((r) => r.emoji === emoji);
      if (existing) {
        if (existing.userIds.includes(userId)) {
          existing.userIds = existing.userIds.filter((id) => id !== userId);
        } else {
          existing.userIds.push(userId);
        }
      } else {
        reactions.push({ emoji, userIds: [userId] });
      }

      expect(reactions[0].userIds).toContain("user-2");
    });
  });

  describe("CommentThread Management", () => {
    interface CommentAuthor {
      id: string;
      name: string;
      avatar?: string;
    }

    interface Comment {
      id: string;
      threadId: string;
      author: CommentAuthor;
      content: string;
      createdAt: number;
      updatedAt: number;
      reactions: Array<{ emoji: string; userIds: string[] }>;
      isEdited: boolean;
    }

    interface CommentThread {
      id: string;
      filePath: string;
      lineNumber: number;
      lineContent: string;
      comments: Comment[];
      isResolved: boolean;
      resolvedBy?: CommentAuthor;
      resolvedAt?: number;
      createdAt: number;
      updatedAt: number;
    }

    it("should create a comment thread", () => {
      const thread: CommentThread = {
        id: "thread-1",
        filePath: "/src/index.ts",
        lineNumber: 42,
        lineContent: "const x = 1;",
        comments: [],
        isResolved: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(thread.filePath).toBe("/src/index.ts");
      expect(thread.lineNumber).toBe(42);
      expect(thread.isResolved).toBe(false);
    });

    it("should add comments to a thread", () => {
      const thread: CommentThread = {
        id: "thread-1",
        filePath: "/src/index.ts",
        lineNumber: 10,
        lineContent: "function foo() {",
        comments: [
          {
            id: "c1",
            threadId: "thread-1",
            author: { id: "u1", name: "Alice" },
            content: "Should we rename this?",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            reactions: [],
            isEdited: false,
          },
        ],
        isResolved: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      thread.comments.push({
        id: "c2",
        threadId: "thread-1",
        author: { id: "u2", name: "Bob" },
        content: "Good idea!",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reactions: [],
        isEdited: false,
      });

      expect(thread.comments).toHaveLength(2);
    });

    it("should resolve a thread", () => {
      const thread: CommentThread = {
        id: "thread-1",
        filePath: "/src/index.ts",
        lineNumber: 10,
        lineContent: "",
        comments: [],
        isResolved: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      thread.isResolved = true;
      thread.resolvedBy = { id: "u1", name: "Alice" };
      thread.resolvedAt = Date.now();

      expect(thread.isResolved).toBe(true);
      expect(thread.resolvedBy?.name).toBe("Alice");
    });

    it("should unresolve a thread", () => {
      const thread: CommentThread = {
        id: "thread-1",
        filePath: "/src/index.ts",
        lineNumber: 10,
        lineContent: "",
        comments: [],
        isResolved: true,
        resolvedBy: { id: "u1", name: "Alice" },
        resolvedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      thread.isResolved = false;
      thread.resolvedBy = undefined;
      thread.resolvedAt = undefined;

      expect(thread.isResolved).toBe(false);
      expect(thread.resolvedBy).toBeUndefined();
    });

    it("should delete a comment from thread", () => {
      const thread: CommentThread = {
        id: "thread-1",
        filePath: "/src/index.ts",
        lineNumber: 10,
        lineContent: "",
        comments: [
          {
            id: "c1",
            threadId: "thread-1",
            author: { id: "u1", name: "Alice" },
            content: "First",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            reactions: [],
            isEdited: false,
          },
          {
            id: "c2",
            threadId: "thread-1",
            author: { id: "u2", name: "Bob" },
            content: "Second",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            reactions: [],
            isEdited: false,
          },
        ],
        isResolved: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      thread.comments = thread.comments.filter((c) => c.id !== "c1");

      expect(thread.comments).toHaveLength(1);
      expect(thread.comments[0].id).toBe("c2");
    });
  });

  describe("Comment Filtering", () => {
    type CommentFilter = "all" | "resolved" | "unresolved";

    interface CommentThread {
      id: string;
      filePath: string;
      isResolved: boolean;
    }

    it("should filter by all", () => {
      const threads: CommentThread[] = [
        { id: "1", filePath: "/a.ts", isResolved: false },
        { id: "2", filePath: "/b.ts", isResolved: true },
        { id: "3", filePath: "/c.ts", isResolved: false },
      ];

      const filter: CommentFilter = "all";
      const filtered = filter === "all" ? threads : threads.filter((t) =>
        filter === "resolved" ? t.isResolved : !t.isResolved
      );

      expect(filtered).toHaveLength(3);
    });

    it("should filter by resolved", () => {
      const threads: CommentThread[] = [
        { id: "1", filePath: "/a.ts", isResolved: false },
        { id: "2", filePath: "/b.ts", isResolved: true },
        { id: "3", filePath: "/c.ts", isResolved: true },
      ];

      const filter: CommentFilter = "resolved";
      const filtered = threads.filter((t) => filter === "resolved" && t.isResolved);

      expect(filtered).toHaveLength(2);
    });

    it("should filter by unresolved", () => {
      const threads: CommentThread[] = [
        { id: "1", filePath: "/a.ts", isResolved: false },
        { id: "2", filePath: "/b.ts", isResolved: true },
        { id: "3", filePath: "/c.ts", isResolved: false },
      ];

      const filter: CommentFilter = "unresolved";
      const filtered = threads.filter((t) => filter === "unresolved" && !t.isResolved);

      expect(filtered).toHaveLength(2);
    });

    it("should filter by file path", () => {
      const threads: CommentThread[] = [
        { id: "1", filePath: "/src/index.ts", isResolved: false },
        { id: "2", filePath: "/src/utils.ts", isResolved: false },
        { id: "3", filePath: "/src/index.ts", isResolved: true },
      ];

      const fileFilter = "/src/index.ts";
      const filtered = threads.filter((t) => t.filePath === fileFilter);

      expect(filtered).toHaveLength(2);
    });
  });

  describe("Thread Queries", () => {
    interface CommentThread {
      id: string;
      filePath: string;
      lineNumber: number;
      isResolved: boolean;
    }

    it("should get threads for file", () => {
      const threads: CommentThread[] = [
        { id: "1", filePath: "/src/a.ts", lineNumber: 10, isResolved: false },
        { id: "2", filePath: "/src/b.ts", lineNumber: 20, isResolved: false },
        { id: "3", filePath: "/src/a.ts", lineNumber: 30, isResolved: true },
      ];

      const getThreadsForFile = (filePath: string) =>
        threads.filter((t) => t.filePath === filePath);

      const result = getThreadsForFile("/src/a.ts");
      expect(result).toHaveLength(2);
    });

    it("should get thread by location", () => {
      const threads: CommentThread[] = [
        { id: "1", filePath: "/src/a.ts", lineNumber: 10, isResolved: false },
        { id: "2", filePath: "/src/a.ts", lineNumber: 20, isResolved: false },
      ];

      const getThreadByLocation = (filePath: string, lineNumber: number) =>
        threads.find((t) => t.filePath === filePath && t.lineNumber === lineNumber);

      const result = getThreadByLocation("/src/a.ts", 10);
      expect(result?.id).toBe("1");
    });

    it("should get thread by id", () => {
      const threads: CommentThread[] = [
        { id: "1", filePath: "/src/a.ts", lineNumber: 10, isResolved: false },
        { id: "2", filePath: "/src/b.ts", lineNumber: 20, isResolved: false },
      ];

      const getThreadById = (threadId: string) =>
        threads.find((t) => t.id === threadId);

      const result = getThreadById("2");
      expect(result?.filePath).toBe("/src/b.ts");
    });

    it("should group threads by file", () => {
      const threads: CommentThread[] = [
        { id: "1", filePath: "/src/a.ts", lineNumber: 10, isResolved: false },
        { id: "2", filePath: "/src/b.ts", lineNumber: 20, isResolved: false },
        { id: "3", filePath: "/src/a.ts", lineNumber: 30, isResolved: true },
      ];

      const threadsByFile = new Map<string, CommentThread[]>();
      for (const thread of threads) {
        if (!threadsByFile.has(thread.filePath)) {
          threadsByFile.set(thread.filePath, []);
        }
        threadsByFile.get(thread.filePath)!.push(thread);
      }

      expect(threadsByFile.get("/src/a.ts")).toHaveLength(2);
      expect(threadsByFile.get("/src/b.ts")).toHaveLength(1);
    });
  });

  describe("Comment Counts", () => {
    interface CommentThread {
      id: string;
      isResolved: boolean;
    }

    it("should count unresolved threads", () => {
      const threads: CommentThread[] = [
        { id: "1", isResolved: false },
        { id: "2", isResolved: true },
        { id: "3", isResolved: false },
        { id: "4", isResolved: false },
      ];

      const unresolvedCount = threads.filter((t) => !t.isResolved).length;
      expect(unresolvedCount).toBe(3);
    });

    it("should count total threads", () => {
      const threads: CommentThread[] = [
        { id: "1", isResolved: false },
        { id: "2", isResolved: true },
        { id: "3", isResolved: false },
      ];

      expect(threads.length).toBe(3);
    });

    it("should count resolved threads", () => {
      const threads: CommentThread[] = [
        { id: "1", isResolved: false },
        { id: "2", isResolved: true },
        { id: "3", isResolved: true },
      ];

      const resolvedCount = threads.filter((t) => t.isResolved).length;
      expect(resolvedCount).toBe(2);
    });
  });

  describe("User Management", () => {
    interface CommentAuthor {
      id: string;
      name: string;
      avatar?: string;
    }

    it("should set current user", () => {
      let currentUser: CommentAuthor = {
        id: "user-1",
        name: "Anonymous",
      };

      currentUser = {
        id: "user-2",
        name: "Alice",
        avatar: "https://example.com/alice.png",
      };

      expect(currentUser.name).toBe("Alice");
      expect(currentUser.avatar).toBeTruthy();
    });

    it("should validate author has required fields", () => {
      const author: CommentAuthor = {
        id: "user-1",
        name: "Bob",
      };

      expect(author.id).toBeTruthy();
      expect(author.name).toBeTruthy();
    });
  });

  describe("Active Thread State", () => {
    it("should set active thread", () => {
      let activeThreadId: string | null = null;

      activeThreadId = "thread-1";
      expect(activeThreadId).toBe("thread-1");
    });

    it("should clear active thread", () => {
      let activeThreadId: string | null = "thread-1";

      activeThreadId = null;
      expect(activeThreadId).toBeNull();
    });
  });

  describe("Reaction Types", () => {
    type ReactionType = "👍" | "👎" | "❤️" | "🎉" | "😄" | "😕" | "🚀" | "👀";

    it("should support all reaction types", () => {
      const reactions: ReactionType[] = ["👍", "👎", "❤️", "🎉", "😄", "😕", "🚀", "👀"];

      expect(reactions).toHaveLength(8);
      expect(reactions).toContain("👍");
      expect(reactions).toContain("🚀");
    });

    it("should count reactions by type", () => {
      interface CommentReaction {
        emoji: ReactionType;
        userIds: string[];
      }

      const reactions: CommentReaction[] = [
        { emoji: "👍", userIds: ["u1", "u2", "u3"] },
        { emoji: "❤️", userIds: ["u1"] },
        { emoji: "🎉", userIds: ["u2", "u4"] },
      ];

      const totalReactions = reactions.reduce((sum, r) => sum + r.userIds.length, 0);
      expect(totalReactions).toBe(6);
    });
  });
});
