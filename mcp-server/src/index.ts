#!/usr/bin/env node
/**
 * Cortex Desktop MCP Server
 * 
 * Enables AI agents (Cursor, Claude Code, etc.) to interact with Cortex Desktop
 * via the Model Context Protocol (MCP).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { socketClient } from "./client.js";

interface TruncationConfig {
  enabled: boolean;
  maxLength?: number;
  maxLines?: number;
  truncateMessage?: string;
}

const DEFAULT_TRUNCATION: TruncationConfig = {
  enabled: true,
  maxLength: 2000,
  maxLines: 100,
  truncateMessage: "... [truncated]",
};

function truncateText(text: string, config: TruncationConfig = DEFAULT_TRUNCATION): string {
  if (!config.enabled) {
    return text;
  }

  let result = text;

  if (config.maxLines && config.maxLines > 0) {
    const lines = result.split('\n');
    if (lines.length > config.maxLines) {
      result = lines.slice(0, config.maxLines).join('\n');
      if (config.truncateMessage) {
        result += '\n' + config.truncateMessage;
      }
    }
  }

  if (config.maxLength && config.maxLength > 0 && result.length > config.maxLength) {
    result = result.substring(0, config.maxLength);
    if (config.truncateMessage) {
      result += config.truncateMessage;
    }
  }

  return result;
}

// Create MCP server instance
  const server = new McpServer({
    name: "cortex-desktop-mcp",
    version: "1.0.0",
  });

  const truncationSchema = z.object({
    enabled: z.boolean().optional().default(true).describe("Enable truncation (default: true)"),
    maxLength: z.number().optional().default(2000).describe("Maximum character length (default: 2000)"),
    maxLines: z.number().optional().default(100).describe("Maximum number of lines (default: 100)"),
    truncateMessage: z.string().optional().default("... [truncated]").describe("Message to append when truncated (default: '... [truncated]')"),
  }).optional();

// Register tools
function registerTools() {
  // Ping - test connectivity
  server.tool(
    "ping",
    "Test connectivity to Cortex Desktop",
    {},
    async () => {
      const response = await socketClient.sendCommand("ping", {});
      return {
        content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
      };
    }
  );

  // Take Screenshot
  server.tool(
    "take_screenshot",
    "Capture a screenshot of the Cortex Desktop window. Supports compression to reduce file size.",
    {
      windowLabel: z.string().optional().default("main").describe("Window label (default: 'main')"),
      quality: z.number().min(1).max(100).optional().describe("JPEG quality 1-100 (default: 75). Lower = smaller file, more compression"),
      maxWidth: z.number().optional().describe("Maximum width in pixels. Images larger than this will be resized proportionally"),
    },
    async (args) => {
      const response = await socketClient.sendCommand("takeScreenshot", {
        windowLabel: args.windowLabel || "main",
        quality: args.quality,
        maxWidth: args.maxWidth,
      });

      if (!response.success) {
        return {
          content: [{ type: "text", text: `Error: ${response.error}` }],
          isError: true,
        };
      }

      const data = response.data as { data: string; width: number; height: number };
      return {
        content: [
          {
            type: "image",
            data: data.data.replace(/^data:image\/\w+;base64,/, ""),
            mimeType: "image/jpeg",
          },
          {
            type: "text",
            text: `Screenshot captured: ${data.width}x${data.height}`,
          },
        ],
      };
    }
  );

  // Get DOM
  server.tool(
    "get_dom",
    "Get the HTML DOM content from Cortex Desktop",
    {
      windowLabel: z.string().optional().default("main").describe("Window label (default: 'main')"),
      selector: z.string().optional().describe("CSS selector to get specific element (optional)"),
    },
    async (args) => {
      const response = await socketClient.sendCommand("getDom", {
        windowLabel: args.windowLabel || "main",
        selector: args.selector,
      });

      if (!response.success) {
        return {
          content: [{ type: "text", text: `Error: ${response.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
      };
    }
  );

  // Execute JavaScript
  server.tool(
    "execute_js",
    "Execute JavaScript code in Cortex Desktop",
    {
      script: z.string().describe("JavaScript code to execute"),
      windowLabel: z.string().optional().default("main").describe("Window label (default: 'main')"),
    },
    async (args) => {
      const response = await socketClient.sendCommand("executeJs", {
        windowLabel: args.windowLabel || "main",
        script: args.script,
      });

      if (!response.success) {
        return {
          content: [{ type: "text", text: `Error: ${response.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
      };
    }
  );

  // Manage Window
  server.tool(
    "manage_window",
    "Control the Cortex Desktop window (minimize, maximize, move, resize, etc.)",
    {
      operation: z.string().describe("Operation: minimize, maximize, unmaximize, close, show, hide, focus, center, setPosition, setSize, toggleFullscreen"),
      windowLabel: z.string().optional().default("main").describe("Window label (default: 'main')"),
      x: z.number().optional().describe("X position (for setPosition)"),
      y: z.number().optional().describe("Y position (for setPosition)"),
      width: z.number().optional().describe("Width (for setSize)"),
      height: z.number().optional().describe("Height (for setSize)"),
    },
    async (args) => {
      const response = await socketClient.sendCommand("manageWindow", {
        windowLabel: args.windowLabel || "main",
        operation: args.operation,
        x: args.x,
        y: args.y,
        width: args.width,
        height: args.height,
      });

      if (!response.success) {
        return {
          content: [{ type: "text", text: `Error: ${response.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: `Window operation '${args.operation}' completed` }],
      };
    }
  );

  // Text Input
  server.tool(
    "text_input",
    "Simulate keyboard text input",
    {
      text: z.string().describe("Text to type"),
      delayMs: z.number().optional().default(20).describe("Delay between keystrokes in milliseconds (default: 20)"),
    },
    async (args) => {
      const response = await socketClient.sendCommand("textInput", {
        text: args.text,
        delayMs: args.delayMs || 20,
      });

      if (!response.success) {
        return {
          content: [{ type: "text", text: `Error: ${response.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: `Typed ${args.text.length} characters` }],
      };
    }
  );

  // Mouse Movement
  server.tool(
    "mouse_action",
    "Simulate mouse actions (move, click, scroll)",
    {
      action: z.string().describe("Action: move, click, doubleClick, rightClick, scroll"),
      x: z.number().optional().describe("X coordinate (for move)"),
      y: z.number().optional().describe("Y coordinate (for move)"),
      scrollX: z.number().optional().describe("Horizontal scroll amount"),
      scrollY: z.number().optional().describe("Vertical scroll amount"),
    },
    async (args) => {
      const response = await socketClient.sendCommand("mouseMovement", {
        action: args.action,
        x: args.x,
        y: args.y,
        scrollX: args.scrollX,
        scrollY: args.scrollY,
      });

      if (!response.success) {
        return {
          content: [{ type: "text", text: `Error: ${response.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: `Mouse action '${args.action}' completed` }],
      };
    }
  );

  // LocalStorage
  server.tool(
    "local_storage",
    "Manage localStorage in Cortex Desktop",
    {
      operation: z.string().describe("Operation: get, set, remove, clear, keys"),
      key: z.string().optional().describe("Storage key (for get, set, remove)"),
      value: z.string().optional().describe("Value to set (for set operation)"),
      windowLabel: z.string().optional().default("main").describe("Window label (default: 'main')"),
    },
    async (args) => {
      const response = await socketClient.sendCommand("manageLocalStorage", {
        windowLabel: args.windowLabel || "main",
        operation: args.operation,
        key: args.key,
        value: args.value,
      });

      if (!response.success) {
        return {
          content: [{ type: "text", text: `Error: ${response.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
      };
    }
  );

  // Get Element Position
  server.tool(
    "get_element_position",
    "Get the screen position of a DOM element",
    {
      selector: z.string().describe("CSS selector for the element"),
      windowLabel: z.string().optional().default("main").describe("Window label (default: 'main')"),
    },
    async (args) => {
      const response = await socketClient.sendCommand("getElementPosition", {
        windowLabel: args.windowLabel || "main",
        selector: args.selector,
      });

      if (!response.success) {
        return {
          content: [{ type: "text", text: `Error: ${response.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
      };
    }
  );

  // Send Text to Element
  server.tool(
    "send_text_to_element",
    "Send text to a specific DOM element (focuses and sets value)",
    {
      selector: z.string().describe("CSS selector for the element"),
      text: z.string().describe("Text to send to the element"),
      windowLabel: z.string().optional().default("main").describe("Window label (default: 'main')"),
    },
    async (args) => {
      const response = await socketClient.sendCommand("sendTextToElement", {
        windowLabel: args.windowLabel || "main",
        selector: args.selector,
        text: args.text,
      });

      if (!response.success) {
        return {
          content: [{ type: "text", text: `Error: ${response.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: `Text sent to element '${args.selector}'` }],
      };
    }
  );

  // List Windows
  server.tool(
    "list_windows",
    "List all available windows in Cortex Desktop",
    {},
    async () => {
      const response = await socketClient.sendCommand("listWindows", {});

      if (!response.success) {
        return {
          content: [{ type: "text", text: `Error: ${response.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
      };
    }
  );
}

// Main entry point
async function main() {
  // Register all tools FIRST (before connecting transport)
  registerTools();

  // Create and connect stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Connect to Cortex Desktop socket in background (don't block MCP initialization)
  socketClient.connect().catch(() => {
    // Silent fail - Cortex Desktop may not be running
  });
}

main();
