# AI Event Contracts

This document describes all Tauri IPC event channels used for AI features in Cortex Desktop, their payload shapes, emitters, and listeners.

## Overview

Cortex Desktop has **two separate AI event pipelines**:

| Pipeline | Tauri Event | Purpose | Status |
|----------|-------------|---------|--------|
| **Cortex Protocol** | `"cortex-event"` | Primary agent pipeline (sessions, streaming, tools, approvals) | Active / Primary |
| **Legacy AI Module** | `"ai:stream_chunk"`, `"ai:tool_call"`, etc. | Direct model streaming, inline completions | Active / Secondary |

---

## Pipeline 1: Cortex Protocol (`"cortex-event"`)

### Channel

- **Tauri Event:** `"cortex-event"`
- **Emitter:** `src-tauri/src/ai/session.rs` → `convert_event_to_ws()`
- **Payload Type:** `WsMessage` enum (see `src-tauri/src/ai/protocol.rs`)
- **Serialization:** `#[serde(tag = "type", rename_all = "snake_case")]`

### Frontend Listeners

| File | Hook/Method |
|------|-------------|
| `src/context/SDKContext.tsx` | `useTauriListen<CortexEvent>("cortex-event", ...)` |
| `src/context/AgentFollowContext.tsx` | `listen("cortex-event", ...)` |

### Message Types

All messages are JSON objects with a `type` field discriminator:

#### Streaming

| `type` | Fields | Description |
|--------|--------|-------------|
| `stream_chunk` | `{ content: string }` | Streaming text delta |
| `agent_message` | `{ content: string }` | Full message (end of stream) |
| `reasoning_delta` | `{ delta: string }` | Thinking/reasoning text delta |

#### Tool Execution

| `type` | Fields | Description |
|--------|--------|-------------|
| `tool_call_begin` | `{ call_id, tool_name, arguments }` | Tool execution started |
| `tool_call_output_delta` | `{ call_id, stream, chunk }` | Tool stdout/stderr (base64) |
| `tool_call_end` | `{ call_id, tool_name, output, success, duration_ms, metadata? }` | Tool execution completed |
| `approval_request` | `{ call_id, command, cwd }` | Awaiting user approval |

#### Task Lifecycle

| `type` | Fields | Description |
|--------|--------|-------------|
| `task_started` | `{}` | Agent task began |
| `task_complete` | `{ message? }` | Agent task finished |
| `cancelled` | `{}` | Operation was cancelled |

#### Session Management

| `type` | Fields | Description |
|--------|--------|-------------|
| `joined_session` | `{ session_id }` | Joined a session |
| `session_configured` | `{ session_id, model, cwd }` | Session configured by CLI |
| `model_updated` | `{ model }` | Model changed |
| `session_closed` | `{}` | Session ended |

#### Metadata

| `type` | Fields | Description |
|--------|--------|-------------|
| `token_usage` | `{ input_tokens, output_tokens, total_tokens }` | Token count update |
| `message_received` | `{ id, role, content }` | Message echo |
| `status` | `{ connected, authenticated, session_id?, uptime_seconds }` | Connection status |

#### Errors

| `type` | Fields | Description |
|--------|--------|-------------|
| `error` | `{ code, message }` | Error message |
| `warning` | `{ message }` | Warning message |

#### Terminal

| `type` | Fields | Description |
|--------|--------|-------------|
| `terminal_created` | `{ terminal_id, name, cwd }` | Terminal created |
| `terminal_output` | `{ terminal_id, timestamp, content, stream }` | Terminal output |
| `terminal_status` | `{ terminal_id, status, exit_code? }` | Terminal status change |
| `terminal_list` | `{ terminals }` | Terminal list |

#### Design System

| `type` | Fields | Description |
|--------|--------|-------------|
| `design_system_pending` | `{ call_id, project_type, fonts, palettes }` | Awaiting design system selection |
| `design_system_received` | `{ call_id }` | Design system selection received |

---

## Pipeline 2: Legacy AI Module (`"ai:*"` events)

### Events

#### `"ai:stream_chunk"`

- **Emitter:** `src-tauri/src/ai/mod.rs` → `ai_stream` command
- **Payload:** `{ threadId: string, content: string, done: boolean }`
- **Listeners:**
  - `src/context/AIContext.tsx` → `setupEventListeners()`
  - `src/context/ai/AIStreamContext.tsx` → `setupEventListeners()`
  - `src/components/ai/InlineAssistant.tsx` → `listen("ai:stream_chunk", ...)`

#### `"ai:tool_call"`

- **Emitter:** `src-tauri/src/ai/mod.rs` → `ai_stream` command (when `StreamChunk.tool_calls` is present)
- **Payload:** `{ threadId: string, callId: string, name: string, arguments: string }`
- **Listeners:**
  - `src/context/AIContext.tsx` → `setupEventListeners()`
  - `src/context/ai/AIStreamContext.tsx` → `setupEventListeners()`

#### `"ai:tool_result"`

- **Emitter:** Not currently emitted by backend (tool results flow through `"cortex-event"` pipeline)
- **Payload:** `{ threadId: string, callId: string, output: string, success: boolean, durationMs?: number }`
- **Listeners:**
  - `src/context/AIContext.tsx` → `setupEventListeners()`
  - `src/context/ai/AIStreamContext.tsx` → `setupEventListeners()`
  - `src/components/cortex/CortexAIModificationsPanel.tsx` → `listen("ai:tool_result", ...)`

#### `"ai:error"`

- **Emitter:** Not currently emitted by backend (errors flow through `"cortex-event"` pipeline)
- **Payload:** `{ code: string, message: string }`
- **Listeners:**
  - `src/context/AIContext.tsx` → `setupEventListeners()`
  - `src/context/ai/AIStreamContext.tsx` → `setupEventListeners()`

#### `"ai:completion_stream"`

- **Emitter:** `src-tauri/src/ai/completions.rs` → `ai_inline_completion` command
- **Payload:** `{ requestId: string, delta: string, done: boolean }`
- **Listeners:**
  - `src/providers/InlineCompletionsProvider.ts` → `listen("ai:completion_stream", ...)`

#### `"ai:index_progress"`

- **Emitter:** `src-tauri/src/ai/indexer.rs`
- **Payload:** `{ totalFiles, indexedFiles, totalChunks, done, currentFile }`
- **Listeners:**
  - `src/context/ai/AIAgentContext.tsx` → `listen("ai:index_progress", ...)`

#### `"ai:agent_status"`

- **Emitter:** `src-tauri/src/ai/agents/commands.rs` (via agent lifecycle events)
- **Payload:** `{ agentId: string, status: string }`
- **Listeners:**
  - `src/context/ai/AIAgentContext.tsx` → `listen("ai:agent_status", ...)`

---

## Other AI-Related Events

#### `"agent-action"`

- **Emitter:** `src-tauri/src/ai/session.rs` → `log_action()`
- **Payload:** `{ action: { type, ... }, description, category }`
- **Listeners:**
  - `src/context/AgentFollowContext.tsx` → `listen("agent-action", ...)`

#### `"openrouter:stream"`

- **Emitter:** `src-tauri/src/ai/openrouter_commands.rs` → `openrouter_stream_chat`
- **Payload:** `{ threadId: string, chunk: StreamChunk }`
- **Listeners:**
  - `src/utils/llm/OpenRouterProvider.ts` → `listen("openrouter:stream", ...)`

#### Agent Lifecycle Events

| Event | Emitter | Payload |
|-------|---------|---------|
| `"agent:spawned"` | `agents/commands.rs` | `{ agent: Agent }` |
| `"agent:task_started"` | `agents/commands.rs` | `{ agentId, prompt }` |
| `"agent:task_progress"` | `agents/commands.rs` | Progress chunk |
| `"agent:task_completed"` | `agents/commands.rs` | `{ task: Task }` |
| `"agent:task_failed"` | `agents/commands.rs` | `{ agentId, error }` |
| `"agent:task_cancelled"` | `agents/commands.rs` | `{ taskId }` |
| `"agent:removed"` | `agents/commands.rs` | `{ agentId }` |
