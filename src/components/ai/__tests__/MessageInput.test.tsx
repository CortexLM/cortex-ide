import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("MessageInput Component Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("MessageInput Types", () => {
    interface Attachment {
      id: string;
      name: string;
      path: string;
      type: "file" | "folder" | "image";
      size?: number;
      preview?: string;
    }

    interface MessageContext {
      file?: {
        path: string;
        name: string;
        language: string;
        content?: string;
      };
      selection?: {
        text: string;
        startLine: number;
        endLine: number;
      };
      workspace?: string;
      attachments?: Attachment[];
    }

    interface MessageInputProps {
      onSend: (content: string, context?: MessageContext) => void;
      onCancel?: () => void;
      isStreaming?: boolean;
      placeholder?: string;
      disabled?: boolean;
    }

    it("should define MessageInputProps with required onSend", () => {
      const onSend = vi.fn();
      const props: MessageInputProps = {
        onSend,
        placeholder: "Ask something...",
      };

      expect(props.onSend).toBeDefined();
      expect(props.placeholder).toBe("Ask something...");
      expect(props.isStreaming).toBeUndefined();
      expect(props.disabled).toBeUndefined();
    });

    it("should support streaming and disabled states", () => {
      const props: MessageInputProps = {
        onSend: vi.fn(),
        isStreaming: true,
        disabled: true,
      };

      expect(props.isStreaming).toBe(true);
      expect(props.disabled).toBe(true);
    });

    it("should create attachment with all fields", () => {
      const attachment: Attachment = {
        id: "att-1",
        name: "main.ts",
        path: "/src/main.ts",
        type: "file",
        size: 2048,
        preview: "const app = ...",
      };

      expect(attachment.type).toBe("file");
      expect(attachment.size).toBe(2048);
    });

    it("should create message context with file info", () => {
      const context: MessageContext = {
        file: {
          path: "/src/app.tsx",
          name: "app.tsx",
          language: "typescriptreact",
          content: "export default function App() {}",
        },
        workspace: "/home/user/project",
      };

      expect(context.file?.language).toBe("typescriptreact");
      expect(context.workspace).toBe("/home/user/project");
    });

    it("should create message context with selection", () => {
      const context: MessageContext = {
        selection: {
          text: "const x = 42;",
          startLine: 10,
          endLine: 10,
        },
      };

      expect(context.selection?.startLine).toBe(10);
      expect(context.selection?.endLine).toBe(10);
    });

    it("should call onSend with content and context", () => {
      const onSend = vi.fn();
      const context: MessageContext = {
        file: { path: "/test.ts", name: "test.ts", language: "typescript" },
      };

      onSend("Fix this bug", context);

      expect(onSend).toHaveBeenCalledWith("Fix this bug", context);
    });

    it("should call onCancel when provided", () => {
      const onCancel = vi.fn();
      const props: MessageInputProps = {
        onSend: vi.fn(),
        onCancel,
        isStreaming: true,
      };

      props.onCancel?.();
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe("Slash Commands", () => {
    interface SlashCommand {
      name: string;
      description: string;
      icon: string;
      category: "conversation" | "context" | "settings";
    }

    const SLASH_COMMANDS: SlashCommand[] = [
      { name: "clear", description: "Clear conversation history", icon: "trash", category: "conversation" },
      { name: "new", description: "Start a new thread", icon: "plus", category: "conversation" },
      { name: "model", description: "Change the AI model", icon: "microchip", category: "settings" },
      { name: "system", description: "Set system prompt", icon: "terminal", category: "settings" },
      { name: "file", description: "Include file in context", icon: "file", category: "context" },
      { name: "folder", description: "Include folder context", icon: "folder", category: "context" },
    ];

    it("should have six slash commands", () => {
      expect(SLASH_COMMANDS).toHaveLength(6);
    });

    it("should have conversation category commands", () => {
      const conversationCmds = SLASH_COMMANDS.filter((c) => c.category === "conversation");
      expect(conversationCmds).toHaveLength(2);
      expect(conversationCmds.map((c) => c.name)).toContain("clear");
      expect(conversationCmds.map((c) => c.name)).toContain("new");
    });

    it("should have settings category commands", () => {
      const settingsCmds = SLASH_COMMANDS.filter((c) => c.category === "settings");
      expect(settingsCmds).toHaveLength(2);
      expect(settingsCmds.map((c) => c.name)).toContain("model");
      expect(settingsCmds.map((c) => c.name)).toContain("system");
    });

    it("should have context category commands", () => {
      const contextCmds = SLASH_COMMANDS.filter((c) => c.category === "context");
      expect(contextCmds).toHaveLength(2);
      expect(contextCmds.map((c) => c.name)).toContain("file");
      expect(contextCmds.map((c) => c.name)).toContain("folder");
    });

    it("should filter commands by search query", () => {
      const query = "file";
      const filtered = SLASH_COMMANDS.filter(
        (c) => c.name.includes(query) || c.description.toLowerCase().includes(query)
      );

      expect(filtered.length).toBeGreaterThanOrEqual(1);
      expect(filtered.some((c) => c.name === "file")).toBe(true);
    });
  });

  describe("Context Mentions", () => {
    interface ContextMention {
      id: string;
      label: string;
      icon: string;
      shortcut: string;
      description: string;
      insertText: string;
    }

    const CONTEXT_MENTIONS: ContextMention[] = [
      { id: "file", label: "@file", icon: "file", shortcut: "@f", description: "Include current file", insertText: "@file " },
      { id: "selection", label: "@selection", icon: "code", shortcut: "@s", description: "Include selected code", insertText: "@selection " },
      { id: "workspace", label: "@workspace", icon: "folder", shortcut: "@w", description: "Include workspace context", insertText: "@workspace " },
    ];

    it("should have three context mentions", () => {
      expect(CONTEXT_MENTIONS).toHaveLength(3);
    });

    it("should have unique ids", () => {
      const ids = CONTEXT_MENTIONS.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should have labels starting with @", () => {
      CONTEXT_MENTIONS.forEach((mention) => {
        expect(mention.label.startsWith("@")).toBe(true);
      });
    });

    it("should have insert text ending with space", () => {
      CONTEXT_MENTIONS.forEach((mention) => {
        expect(mention.insertText.endsWith(" ")).toBe(true);
      });
    });

    it("should filter mentions by query", () => {
      const query = "file";
      const filtered = CONTEXT_MENTIONS.filter(
        (m) => m.id.includes(query) || m.label.includes(query)
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("file");
    });
  });

  describe("Utility Functions", () => {
    function generateId(): string {
      return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }

    function formatFileSize(bytes: number): string {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function getFileExtension(filename: string): string {
      const parts = filename.split(".");
      return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
    }

    it("should generate unique IDs", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it("should generate IDs containing a dash", () => {
      const id = generateId();
      expect(id).toContain("-");
    });

    it("should format bytes", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });

    it("should format kilobytes", () => {
      expect(formatFileSize(2048)).toBe("2.0 KB");
    });

    it("should format megabytes", () => {
      expect(formatFileSize(1048576)).toBe("1.0 MB");
    });

    it("should format 1.5 MB", () => {
      expect(formatFileSize(1572864)).toBe("1.5 MB");
    });

    it("should get file extension", () => {
      expect(getFileExtension("app.tsx")).toBe("tsx");
      expect(getFileExtension("styles.module.css")).toBe("css");
      expect(getFileExtension("Makefile")).toBe("");
    });

    it("should return empty string for no extension", () => {
      expect(getFileExtension("README")).toBe("");
    });

    it("should lowercase the extension", () => {
      expect(getFileExtension("Image.PNG")).toBe("png");
    });
  });

  describe("Input State Management", () => {
    it("should track input value", () => {
      let value = "";
      const setValue = (v: string) => { value = v; };

      setValue("Hello, AI");
      expect(value).toBe("Hello, AI");
    });

    it("should detect slash command trigger", () => {
      const input = "/model";
      const isSlashCommand = input.startsWith("/");
      expect(isSlashCommand).toBe(true);
    });

    it("should detect context mention trigger", () => {
      const input = "Fix @file issue";
      const hasMention = input.includes("@");
      expect(hasMention).toBe(true);
    });

    it("should not submit empty messages", () => {
      const onSend = vi.fn();
      const content = "  ";

      if (content.trim().length > 0) {
        onSend(content);
      }

      expect(onSend).not.toHaveBeenCalled();
    });

    it("should trim content before sending", () => {
      const onSend = vi.fn();
      const content = "  Hello  ";
      const trimmed = content.trim();

      if (trimmed.length > 0) {
        onSend(trimmed);
      }

      expect(onSend).toHaveBeenCalledWith("Hello");
    });
  });

  describe("Attachment Management", () => {
    interface Attachment {
      id: string;
      name: string;
      path: string;
      type: "file" | "folder" | "image";
      size?: number;
    }

    it("should add attachments to list", () => {
      const attachments: Attachment[] = [];

      attachments.push({
        id: "a1",
        name: "main.ts",
        path: "/src/main.ts",
        type: "file",
        size: 1024,
      });

      expect(attachments).toHaveLength(1);
    });

    it("should remove attachment by id", () => {
      const attachments: Attachment[] = [
        { id: "a1", name: "file1.ts", path: "/file1.ts", type: "file" },
        { id: "a2", name: "file2.ts", path: "/file2.ts", type: "file" },
      ];

      const filtered = attachments.filter((a) => a.id !== "a1");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("a2");
    });

    it("should support different attachment types", () => {
      const attachments: Attachment[] = [
        { id: "a1", name: "code.ts", path: "/code.ts", type: "file" },
        { id: "a2", name: "src", path: "/src", type: "folder" },
        { id: "a3", name: "screenshot.png", path: "/img.png", type: "image" },
      ];

      const types = attachments.map((a) => a.type);
      expect(types).toContain("file");
      expect(types).toContain("folder");
      expect(types).toContain("image");
    });
  });
});
