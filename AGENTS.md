# AGENTS.md — Cortex Desktop

## Project Purpose

Cortex Desktop is an AI-powered development environment (IDE) built with Tauri v2. It provides a modern GUI for AI coding agents with features including an integrated terminal, LSP support, debugger (DAP), Git integration, MCP context servers, extension hosting, and multi-provider AI chat/agent orchestration. The frontend is built with SolidJS and the backend is Rust.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  Frontend (SolidJS + TypeScript)                                 │
│  src/                                                            │
│  ├── components/   797 UI component files (editor, terminal, git, etc.)│
│  ├── context/      181 context files (99 top-level + sub-contexts)    │
│  ├── hooks/        Custom SolidJS hooks                          │
│  ├── pages/        Route pages (Home, Session, Admin, Share)     │
│  ├── providers/    Monaco editor providers (LSP bridge)          │
│  ├── sdk/          Tauri IPC client SDK (client.ts, executor.ts) │
│  ├── services/     Business logic services                       │
│  └── design-system/ Design tokens and primitives                 │
├──────────────────────────────────────────────────────────────────┤
│  Tauri IPC Bridge (invoke commands + emit/listen events)         │
├──────────────────────────────────────────────────────────────────┤
│  Backend (Rust / Tauri v2)                                       │
│  src-tauri/src/                                                  │
│  ├── ai/           AI provider management, agent orchestration   │
│  ├── lsp/          Language Server Protocol client                │
│  ├── dap/          Debug Adapter Protocol client                 │
│  ├── terminal/     PTY terminal management + shell integration   │
│  ├── git/          Git operations via libgit2 (29 submodules)    │
│  ├── fs/           File system operations + caching              │
│  ├── extensions/   VS Code-compatible extension system           │
│  ├── remote/       SSH remote development                        │
│  ├── factory/      Agent workflow orchestration (designer/exec)  │
│  ├── collab/       Real-time collaboration (CRDT, WebSocket)     │
│  ├── mcp/          Model Context Protocol server                 │
│  ├── timeline/     Local file history tracking                   │
│  ├── acp/          Agent Control Protocol tools                  │
│  ├── editor/       Editor features (folding, symbols, refactor)  │
│  ├── i18n/         Internationalization (locale detection)       │
│  ├── settings/     User/workspace settings persistence           │
│  └── ...           48 modules total (150-line lib.rs)            │
├──────────────────────────────────────────────────────────────────┤
│  Sidecar Services                                                │
│  └── mcp-server/   MCP stdio server (TypeScript/Node.js)         │
├──────────────────────────────────────────────────────────────────┤
│  Local Engine Modules (formerly from cortex-cli)                  │
│  ├── cortex_engine    (Config, Session, SessionHandle, SSRF)     │
│  ├── cortex_protocol  (Event/Submission types, policies)         │
│  └── cortex_storage   (Session persistence, message history)     │
└──────────────────────────────────────────────────────────────────┘
```

**Data Flow:** Frontend components dispatch Tauri IPC `invoke()` calls → Rust `#[tauri::command]` handlers process requests → Results returned as JSON. Real-time events use Tauri's `emit()`/`listen()` event system (e.g., terminal output, LSP diagnostics, AI streaming). The SDK layer (`src/sdk/`) wraps all IPC calls with typed functions and error handling.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | SolidJS 1.9.11 with TypeScript 5.9 |
| UI Components | Kobalte (headless), custom design system |
| Styling | Tailwind CSS v4.1.18 |
| Code Editor | Monaco Editor 0.55.1 |
| Terminal | xterm.js 6.0 with WebGL renderer |
| Bundler | Vite 7.3 with vite-plugin-solid |
| Testing (Frontend) | Vitest 3.2 with jsdom |
| Testing Library | @solidjs/testing-library 0.8 |
| Desktop Framework | Tauri v2.9 (Rust) |
| Rust Edition | 2024 (rust-version 1.85, nightly required) |
| Async Runtime | Tokio (full features) |
| Database | SQLite via rusqlite (bundled) |
| Git | libgit2 via git2 crate |
| Serialization | serde + serde_json + rmp-serde (MessagePack) |
| Security | keyring, secrecy, zeroize for credential management |
| Syntax Highlighting | Shiki 3.21+ |
| MCP Server | @modelcontextprotocol/sdk + zod |

## Critical Rules

1. **Never use blocking I/O in async Tauri commands.** The backend uses `tokio` with full features. All `#[tauri::command]` handlers that are `async` must use async I/O (`tokio::fs`, `reqwest` without `blocking` feature). Use `tokio::task::spawn_blocking()` for CPU-bound or unavoidably synchronous work. See `src-tauri/Cargo.toml` line 61: reqwest has no `blocking` feature intentionally.

2. **All Tauri state must be thread-safe.** State managed via `app.manage()` must implement `Send + Sync`. Use `Arc<Mutex<T>>`, `Arc<parking_lot::Mutex<T>>`, `DashMap`, or `OnceLock` for shared state. See `LazyState<T>` pattern in `src-tauri/src/lib.rs` for deferred initialization.

3. **Credentials must use secure storage.** Never store API keys, passwords, or tokens in plaintext files. Use the `keyring` crate for OS keychain access, `secrecy::SecretString` for in-memory secrets, and `zeroize` for cleanup. See `src-tauri/src/remote/credentials.rs`.

4. **Frontend uses SolidJS, NOT React.** Do not use React APIs (`useState`, `useEffect`, `React.createElement`). Use SolidJS equivalents (`createSignal`, `createEffect`, `onMount`, `onCleanup`). JSX import source is `solid-js` (see `tsconfig.json` line 14). Components return JSX elements, not `React.FC`.

5. **Respect the Content Security Policy.** The CSP in `src-tauri/tauri.conf.json` restricts script sources to `'self'` and `'wasm-unsafe-eval'`. Do not add `'unsafe-eval'` or `'unsafe-inline'` for scripts. All connect-src must be explicitly whitelisted. New Tauri plugins require updating CSP and capabilities in `src-tauri/capabilities/default.json`.

6. **Use path aliases consistently.** Frontend imports use `@/` alias mapped to `./src/` (see `tsconfig.json` paths and `vite.config.ts` resolve.alias). Always use `@/components/...`, `@/context/...`, etc. instead of relative paths from deep nesting.

7. **Tauri commands must return `Result<T, String>`.** All `#[tauri::command]` functions must return `Result<T, String>` where `T: Serialize`. Use `.map_err(|e| format!("...: {}", e))` for error conversion. Do not return `anyhow::Error` directly.

8. **TypeScript strict mode is enforced.** `tsconfig.json` enables `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, and `noFallthroughCasesInSwitch: true`. All frontend code must pass `tsc --noEmit`.

9. **Startup performance is critical.** The backend uses lazy initialization (`OnceLock`, `LazyState<T>`) and parallel `tokio::join!` for startup. Do not add synchronous initialization in the `setup()` closure. Heavy work must be deferred to async tasks. Frontend uses `AppShell.tsx` for instant first paint, lazy-loading `AppCore.tsx`.

10. **Conventional commits required.** All commit messages must follow the Conventional Commits format: `type(scope): description`. Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`. This drives semantic versioning and release notes via `.releaserc.json`.

11. **Vendored dependencies are read-only.** The `src-tauri/window-vibrancy/` directory is a vendored crate. Do not modify it.

12. **Vite code splitting is intentional.** The `vite.config.ts` has a detailed `createManualChunks()` function that splits Monaco, xterm, Shiki, and heavy contexts into separate lazy-loaded chunks. Understand the splitting strategy before adding large dependencies.

## Do / Don't

### DO
- Use `#[tauri::command]` with proper error handling returning `Result<T, String>`
- Use `Arc<Mutex<T>>` or `DashMap` for shared backend state
- Write Vitest tests for frontend logic in `src/**/__tests__/`
- Use `createSignal`, `createMemo`, `createEffect` from `solid-js`
- Use `@/` path alias for frontend imports
- Use `tracing::{info, warn, error}` for backend logging (not `println!`)
- Keep Tauri commands thin — delegate to module-specific logic
- Use `tokio::task::spawn_blocking` for CPU-heavy operations
- Run `cargo fmt --all` before committing Rust code (from `src-tauri/`)
- Run `npm run typecheck` before committing TypeScript code
- Add new context providers to `src/context/OptimizedProviders.tsx`
- Lazy-load heavy components with `lazy(() => import(...))` and wrap in `<Suspense>`
- Use `Show`, `For`, `Switch/Match` for conditional rendering (SolidJS)

### DON'T
- Don't use React hooks or patterns — this is SolidJS
- Don't use `unwrap()` or `expect()` in production paths without justification (though clippy allows them per lints config in `src-tauri/Cargo.toml`)
- Don't store secrets in `.env` files or settings JSON — use OS keychain via `keyring`
- Don't add synchronous blocking calls in async command handlers
- Don't modify `src-tauri/window-vibrancy/` — it's a vendored dependency
- Don't import from `node_modules` paths directly — use package names
- Don't add new Tauri plugins without updating CSP and capabilities in `src-tauri/capabilities/default.json`
- Don't skip the frontend build before testing Tauri (`npm run build` is `beforeBuildCommand`)
- Don't use `console.log` in extension-host — stdout is the JSON-RPC transport
- Don't add CSS modules for new components — use Tailwind v4 utility classes
- Don't exceed 300 lines per component — extract hooks and sub-components

## Build & Test Commands

### Frontend
```bash
npm install                    # Install dependencies
npm run dev                    # Start Vite dev server (port 1420)
npm run build                  # Production build (output: dist/)
npm run typecheck              # TypeScript type checking (tsc --noEmit)
npm run test                   # Run Vitest tests
npm run test:watch             # Run tests in watch mode
npm run test:coverage          # Run tests with coverage
npm run build:analyze          # Build with bundle analysis
```

### Backend (Rust / Tauri)
```bash
cd src-tauri
cargo fmt --all                                   # Format Rust code
cargo fmt --all -- --check                        # Check formatting
cargo clippy --all-targets -- -D warnings         # Lint
cargo check                                       # Type check (fast)
cargo build                                       # Debug build
cargo build --release                             # Release build (LTO enabled)
cargo test                                        # Run Rust tests
```

### Full App (Tauri)
```bash
npm run tauri:dev              # Dev mode (frontend + backend hot reload)
npm run tauri:build            # Production desktop app build
```

### Sidecar Services
```bash
# MCP Server
cd mcp-server && npm install && npm run build
```

## Git Hooks

| Hook | What it does |
|------|-------------|
| `pre-commit` | Runs `cargo fmt --all -- --check` (Rust formatting), `npm run typecheck` (TS type checking) |
| `pre-push` | Full quality gate: frontend build, Rust fmt + clippy + check + test, TypeScript typecheck, Vitest tests |

Both hooks respect `SKIP_GIT_HOOKS=1` environment variable to bypass checks when needed.

Hooks are configured via `git config core.hooksPath .githooks` and live in `.githooks/`.

## CI Pipeline

The `.github/workflows/ci.yml` runs on push to `main`/`master`/`develop` and on PRs to `main`/`master`:

| Job | What it does |
|-----|-------------|
| `frontend` | TypeScript type check + Vitest tests + Vite build (uploads `dist/` artifact) |
| `rust-checks` | Rust fmt (nightly) + clippy + tests on Ubuntu (downloads `dist/` artifact) |
| `gui-check-macos` | `cargo check` on macOS (downloads `dist/` artifact) |
| `gui-check-windows` | `cargo check` on Windows (downloads `dist/` artifact) |
| `ci-success` | Aggregates all check results |
| `release` | Semantic release on push to main/master (depends on ci-success) |

## Project Structure

```
cortex-gui/
├── AGENTS.md                  # This file
├── package.json               # Frontend dependencies & scripts
├── vite.config.ts             # Vite bundler configuration (code splitting)
├── vitest.config.ts           # Vitest test configuration (jsdom, coverage)
├── tsconfig.json              # TypeScript configuration (strict mode)
├── index.html                 # Vite entry HTML
├── .env.example               # Environment variable template (VITE_API_URL)
├── src/                       # Frontend source (SolidJS + TypeScript)
│   ├── AGENTS.md              # Frontend-specific agent docs
│   ├── index.tsx              # Entry point → AppShell.tsx
│   ├── App.tsx                # Main app with OptimizedProviders
│   ├── AppCore.tsx            # Lazy-loaded core app logic
│   ├── AppShell.tsx           # Minimal shell for instant first paint
│   ├── components/            # 797 UI component files organized by feature
│   ├── context/               # 181 context files: 99 top-level + sub-contexts (editor, ai, debug, diff, merge, extensions, notebook, iconTheme, keymap, theme, tasks, i18n, workspace) + utils
│   ├── sdk/                   # Tauri IPC SDK (typed invoke wrappers)
│   ├── providers/             # Monaco ↔ LSP bridge providers
│   ├── hooks/                 # Custom SolidJS hooks
│   ├── pages/                 # Route pages (Home, Session, Admin, Share)
│   ├── services/              # Business logic services
│   ├── design-system/         # Design tokens and primitives
│   ├── styles/                # Global CSS + Tailwind config
│   ├── types/                 # Shared TypeScript types
│   ├── utils/                 # Utility functions
│   └── workers/               # Web Workers (extension-host.ts)
├── src-tauri/                 # Tauri backend (Rust)
│   ├── AGENTS.md              # Backend-specific agent docs
│   ├── Cargo.toml             # Rust dependencies (edition 2024)
│   ├── tauri.conf.json        # Tauri app configuration (CSP, windows)
│   ├── capabilities/          # Tauri security capabilities
│   ├── src/                   # Rust source code (48 modules)
│   │   ├── lib.rs             # App setup, module declarations (150 lines)
│   │   ├── main.rs            # Entry point
│   │   ├── ai/                # AI providers + agents
│   │   ├── lsp/               # LSP client
│   │   ├── dap/               # DAP client
│   │   ├── terminal/          # PTY management
│   │   ├── git/               # Git ops (29 submodules)
│   │   ├── factory/           # Agent workflow orchestration
│   │   ├── timeline/          # Local file history tracking
│   │   ├── app/               # Command registration + app setup
│   │   ├── error.rs           # Shared error types (CortexError)
│   │   ├── editor/            # Editor features (folding, symbols, refactor)
│   │   ├── i18n/              # Internationalization (locale detection)
│   │   └── ...                # 48 modules total
│   └── window-vibrancy/       # Vendored crate (DO NOT MODIFY)
├── mcp-server/                # MCP stdio server (TypeScript)
│   ├── AGENTS.md
│   └── package.json
├── public/                    # Static assets (icons, SVGs)
├── .github/workflows/ci.yml   # CI pipeline
├── .githooks/                 # Git hooks (pre-commit, pre-push)
├── .releaserc.json            # Semantic release configuration
└── VERSION                    # Current version (2.22.0)
```