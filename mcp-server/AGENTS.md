# AGENTS.md — mcp-server/ (MCP Server)

## Purpose

Model Context Protocol (MCP) stdio server that enables external AI agents (Cursor, Claude Code, etc.) to interact with Cortex Desktop. Exposes IDE capabilities as MCP tools — allowing agents to read/write files, run terminal commands, take screenshots, and query workspace state through the Cortex Desktop socket API.

## Architecture

- **Entry:** `src/index.ts` (396 lines) — MCP server setup with stdio transport, tool definitions
- **Client:** `src/client.ts` (264 lines) — `CortexSocketClient` class connecting to Cortex Desktop's TCP server (port 4000)
- **Protocol:** `@modelcontextprotocol/sdk` with `zod` for schema validation
- **Transport:** Stdio (stdin/stdout JSON-RPC)
- **TypeScript target:** ES2022, NodeNext module resolution

### Data Flow
```
External AI Agent → stdio (JSON-RPC) → mcp-server → TCP socket → Cortex Desktop (port 4000)
```

### Key Features
- Output truncation (configurable max length/lines) to stay within AI context limits
- Tool definitions with Zod schemas for type-safe parameter validation
- Bidirectional communication with Cortex Desktop via socket client
- Command-specific timeouts (e.g., screenshots 60s, default 30s)
- Reconnection handling in socket client

## Build & Run

```bash
cd mcp-server
npm install          # Install dependencies
npm run build        # Compile TypeScript (tsc → dist/)
npm run start        # Run compiled server (node dist/index.js)
npm run dev          # Run with tsx (development, hot reload)
```

## Dependencies

- `@modelcontextprotocol/sdk` ^1.25.3 — MCP protocol implementation
- `zod` ^3.25.76 — Runtime schema validation
- `typescript` ^5.9.3 — Compiler
- `tsx` — Dev-time TypeScript execution
- `@types/node` ^22.10.0 — Node.js type definitions

## Rules

- All tool outputs must respect truncation config to prevent context overflow
- Socket client must handle reconnection gracefully
- Tool parameter schemas must use Zod for runtime validation
- Keep the server stateless — all state lives in Cortex Desktop
- Never use `console.log` — stdout is the MCP JSON-RPC transport; use stderr for debug logging
- Strict TypeScript mode: `strict: true`, `forceConsistentCasingInFileNames: true`
