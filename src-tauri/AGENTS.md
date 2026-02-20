# AGENTS.md — src-tauri/ (Tauri Backend)

## Purpose

The Rust backend for Cortex Desktop. Implements all native functionality exposed to the frontend via Tauri IPC commands: file system operations, terminal PTY management, LSP/DAP protocol clients, Git operations, AI provider orchestration, extension hosting, remote SSH development, sandboxed agent execution, and more. This is a 48-module monolith compiled as `cortex-gui` (library: `cortex_gui_lib`).

## Architecture

- **Entry point:** `src/main.rs` → calls `cortex_gui_lib::run()` from `src/lib.rs`
- **Crate name:** `cortex-gui` (library: `cortex_gui_lib`)
- **Crate type:** `staticlib`, `cdylib`, `rlib`
- **Rust edition:** 2024, requires nightly (1.85+)
- **lib.rs:** 150 lines — module declarations, `LazyState<T>` pattern, and `run()` entry point. Command registration and app setup are delegated to the `app/` module

### Module Map

| Module | Path | Submodules | Description |
|--------|------|------------|-------------|
| `app` | `src/app/` | `ai_commands.rs`, `collab_commands.rs`, `editor_commands.rs`, `extension_commands.rs`, `git_commands.rs`, `i18n_commands.rs`, `misc_commands.rs`, `notebook_commands.rs`, `remote_commands.rs`, `settings_commands.rs`, `terminal_commands.rs`, `workspace_commands.rs`, `tests.rs` | Tauri command registration (`cortex_commands!` macro), state initialization (`register_state`), app setup (`setup_app`), and run-event handling — split into feature-grouped sub-modules |
| `error` | `src/error.rs` | — | Shared `CortexError` enum with `thiserror` variants for IO, Git, JSON, SSH, LSP, DAP, Extension, Terminal, AI errors |
| `ai` | `src/ai/` | `agents/` (`commands.rs`, `orchestrator.rs`, `prompt_generation.rs`, `storage.rs`, `storage_types.rs`, `types.rs`), `completions.rs`, `context.rs`, `indexer.rs`, `protocol.rs`, `providers.rs`, `session.rs`, `session_commands.rs`, `storage.rs`, `thread.rs`, `tools.rs`, `types.rs`, `vector_store.rs` | AI provider management (OpenAI, Anthropic, etc.), agent spawning, conversation threads, tool execution, streaming, completions, vector store indexing |
| `lsp` | `src/lsp/` | `client/`, `commands/`, `types.rs` | Full LSP client: document sync, completions, hover, definitions, references, diagnostics |
| `dap` | `src/dap/` | `client.rs`, `commands/`, `protocol/`, `session/`, `transport.rs` | Debug Adapter Protocol: sessions, breakpoints, stepping, variables, stack frames |
| `terminal` | `src/terminal/` | `commands.rs`, `constants.rs`, `flow_control.rs`, `process.rs`, `shell_integration.rs`, `state.rs`, `types.rs` | PTY terminal management with flow control and shell integration |
| `git` | `src/git/` | 29 files: `bisect`, `blame`, `branch`, `cache`, `cherry_pick`, `clone`, `command`, `diff`, `forge`, `graph`, `helpers`, `hunk`, `lfs`, `lines`, `log`, `merge`, `merge_editor`, `mod`, `pull_request`, `rebase`, `remote`, `staging`, `stash`, `status`, `submodule`, `tag`, `types`, `watcher`, `worktree` | Full Git operations via libgit2 |
| `fs` | `src/fs/` | `directory.rs`, `encoding.rs`, `operations.rs`, `search.rs`, `security.rs`, `types.rs`, `utils.rs`, `watcher.rs`, `workspace_edit.rs` | File system ops with caching, watching, encoding detection, workspace edits |
| `extensions` | `src/extensions/` | `activation.rs`, `api/` (`commands.rs`, `debug.rs`, `languages.rs`, `scm.rs`, `window.rs`, `workspace.rs`), `commands.rs`, `contributions.rs`, `marketplace.rs`, `node_host/` (`api_shim.rs`, `commands.rs`, `manifest.rs`, `process.rs`, `protocol.rs`), `permissions.rs`, `plugin_api.rs`, `registry.rs`, `state.rs`, `types.rs`, `utils.rs`, `wasm/` (`host.rs`, `runtime.rs`), `wit/` (`cortex.wit`) | VS Code-compatible extension system + marketplace integration + Node.js extension host |
| `remote` | `src/remote/` | `commands.rs`, `connection.rs`, `credentials.rs`, `error.rs`, `manager.rs`, `types.rs` | SSH remote development (connection, file ops, credential storage) |
| `factory` | `src/factory/` | `audit.rs`, `commands.rs`, `events.rs`, `executor/` (`actions.rs`, `agents.rs`, `control_flow.rs`, `helpers.rs`, `triggers.rs`, `types.rs`), `interception.rs`, `orchestrator.rs`, `persistence.rs`, `types.rs` | Agent workflow orchestration: designer, executor, interception, audit logging |
| `mcp` | `src/mcp/` | `commands.rs`, `socket_server.rs`, `tools.rs` | MCP TCP server for AI agent debugging |
| `collab` | `src/collab/` | `auth.rs`, `awareness.rs`, `commands.rs`, `crdt.rs`, `server.rs`, `session.rs`, `types.rs` | Real-time collaboration: CRDT-based document sync (yrs), WebSocket server, session/room management, awareness protocol, authentication |
| `context_server` | `src/context_server/` | `commands.rs`, `protocol.rs`, `transport.rs`, `types.rs` | MCP client for connecting to external context servers |
| `acp` | `src/acp/` | `commands.rs`, `executor.rs`, `types.rs` | Agent Control Protocol tool registry and execution |
| `settings` | `src/settings/` | `commands.rs`, `profiles.rs`, `secure_store.rs`, `storage.rs`, `types.rs` | User/workspace settings with profiles and secure storage |
| `settings_sync` | `src/settings_sync/` | `commands.rs`, `github_gist.rs`, `storage.rs`, `types.rs` | Settings sync via GitHub Gist |
| `formatter` | `src/formatter/` | `commands.rs`, `handlers.rs`, `prettier.rs`, `types.rs` | Code formatting (Prettier integration) |
| `testing` | `src/testing/` | `coverage.rs`, `detection.rs`, `discovery.rs`, `execution.rs`, `single_test.rs`, `types.rs`, `watch.rs` (8 files incl. `mod.rs`) | Test framework detection, discovery, execution, coverage |
| `sandbox` | `src/sandbox/` | `acl.rs`, `audit.rs`, `cap.rs`, `commands.rs`, `dpapi.rs`, `elevated_impl.rs`, `env.rs`, `identity.rs`, `linux.rs`, `macos.rs`, `process.rs`, `sandbox_users.rs`, `token.rs`, `winutil.rs` | Sandboxed execution environment for AI agents |
| `repl` | `src/repl/` | `jupyter.rs`, `kernel.rs`, `types.rs` (4 files incl. `mod.rs`) | REPL kernel management (Jupyter protocol) |
| `batch` | `src/batch.rs` | — | IPC batch command system with MessagePack support |
| `action_log` | `src/action_log.rs` | — | Agent action tracking for diff/accept/reject workflows |
| `auto_update` | `src/auto_update.rs` | — | Application auto-update via Tauri updater plugin |
| `browser` | `src/browser.rs` | — | Embedded browser webview management |
| `deep_link` | `src/deep_link.rs` | — | `cortex://` deep link handler |
| `notebook` | `src/notebook/` | `commands.rs`, `kernel.rs`, `types.rs` | Jupyter-style notebook kernel management |
| `search` | `src/search.rs` | — | Search and replace across files |
| `ssh_terminal` | `src/ssh_terminal.rs` | — | Remote SSH PTY sessions |
| `system_specs` | `src/system_specs.rs` | — | System info and live metrics |
| `toolchain` | `src/toolchain.rs` | — | Language toolchain detection (Node, Python, Rust) |
| `window` | `src/window.rs` | — | Multi-window management with session persistence |
| `workspace` | `src/workspace/` | `commands.rs`, `core.rs`, `manager.rs`, `types.rs` | Cross-folder file operations, workspace trust management, multi-root git status |
| `workspace_settings` | `src/workspace_settings.rs` | — | Workspace/folder/language-level settings |
| `wsl` | `src/wsl.rs` | — | Windows Subsystem for Linux integration |
| `activity` | `src/activity.rs` | — | User activity tracking |
| `diagnostics` | `src/diagnostics.rs` | — | Diagnostic aggregation |
| `editor` | `src/editor/` | `folding.rs`, `inline_diff.rs`, `refactoring.rs`, `snippets.rs`, `symbols.rs` | Editor features: folding ranges, inline diffs, refactoring, snippets, symbol indexing |
| `i18n` | `src/i18n/` | — | Internationalization: locale detection, available locales, translation plumbing |
| `language_selector` | `src/language_selector.rs` | — | Language detection and selection |
| `prompt_store` | `src/prompt_store.rs` | — | Prompt template persistence |
| `rules_library` | `src/rules_library.rs` | — | Agent rules library |
| `tasks` | `src/tasks.rs` | — | Task runner integration |
| `timeline` | `src/timeline.rs` | — | Local file history tracking (VS Code-like) |
| `keybindings` | `src/keybindings.rs` | — | Keybinding management: load, save, import, export, conflict detection |
| `themes` | `src/themes.rs` | — | Theme management: loading, storage, export (Cortex native + VS Code formats) |
| `process` | `src/process.rs` | — | Process management |
| `process_utils` | `src/process_utils.rs` | — | Process utilities |
| *(undeclared)* | `src/output_channels.rs` | — | VS Code-like output channels (not yet wired into lib.rs) |
| *(undeclared)* | `src/snippets.rs` | — | VS Code-compatible snippet management (not yet wired into lib.rs) |
| *(undeclared)* | `src/workspace_symbols.rs` | — | Workspace-wide symbol search (not yet wired into lib.rs) |
| *(non-module)* | `src/resources/` | Shell integration scripts (bash, zsh, fish, pwsh) | Shell integration scripts injected into terminal sessions |

### State Management Pattern

State is registered via `app::register_state()` and initialized during `app::setup_app()`. Heavy state uses `LazyState<T>` (wraps `OnceLock`) for deferred initialization. Startup uses `tokio::join!` for parallel async init of settings, extensions, LSP, SSH profiles, AI providers, and auto-update. State types: `AIState`, `AgentState`, `AgentStoreState`, `AIToolsState`, `LspState`, `ActivityState`, etc. Command registration uses a `cortex_commands!` macro that chains sub-module command macros into `tauri::generate_handler![]`.

## Key Dependencies

- `tauri` 2.10 with `macos-private-api` and `unstable` features
- `cortex_engine`, `cortex_protocol`, `cortex_storage` — local modules (no external dependency)
- `tokio` (full), `serde`/`serde_json`, `rmp-serde` (MessagePack), `anyhow`/`thiserror`
- `git2` (libgit2), `rusqlite` (SQLite, bundled), `ssh2`, `portable-pty`
- `keyring`/`secrecy`/`zeroize` for secure credential storage
- `dashmap`, `parking_lot`, `lru` for concurrent data structures
- `reqwest` (async-only, no `blocking` feature — intentional)
- `wasmtime` 29 (Cranelift) for WASM extension runtime
- `yrs` (Yjs CRDT) + `tokio-tungstenite` for real-time collaboration
- Platform-specific: `window-vibrancy`, `win-screenshot`, `xcap`, `windows-sys`

## Build Commands

```bash
cargo fmt --all -- --check             # Check formatting
cargo clippy --all-targets -- -D warnings  # Lint
cargo check                            # Type check
cargo build                            # Debug build
cargo build --release                  # Release build (LTO, strip, panic=abort)
cargo test                             # Run tests
```

## Rules

- All `#[tauri::command]` must return `Result<T, String>` — never `anyhow::Result`
- Use `tracing::{info, warn, error}` for logging, not `println!`
- State accessed via `app.state::<T>()` must be `Send + Sync`
- Never block the async runtime — use `spawn_blocking` for sync work
- Platform-specific code uses `#[cfg(target_os = "...")]` guards
- The `window-vibrancy/` subdirectory is a vendored crate — do not modify
- Release profile enables LTO, single codegen unit, symbol stripping, and panic=abort
- Rust lint `unsafe_code` is set to `deny` in `Cargo.toml`; modules that require unsafe use `#![allow(unsafe_code)]` at the crate/module level
- Clippy lints `unwrap_used` and `expect_used` are set to `warn` in `Cargo.toml`; non-test code that needs them uses function-level `#[allow(...)]` with justification; test modules use `#[allow(clippy::unwrap_used, clippy::expect_used)]`
- Clippy lints `print_stdout`, `print_stderr`, `unnecessary_sort_by`, `iter_without_into_iter`, `module_inception`, `derivable_impls` are set to `allow` in `Cargo.toml`
- New Tauri plugins require updating `src-tauri/capabilities/default.json` and CSP in `tauri.conf.json`