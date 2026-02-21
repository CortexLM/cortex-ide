# Hardcoded Colors & Legacy Token Usage — Migration TODO

> **Goal**: Migrate all hardcoded hex colors and legacy `--surface-*`, `--text-*`,
> `--palette-*`, `--accent-*` variable usage to the canonical `--cortex-*` design
> tokens from `src/styles/cortex-tokens.css`.

---

## 1. Hardcoded Hex Colors in Components (~458 instances)

### Cortex-Prefixed Components (Priority — should use cortex tokens)

| File | Colors Found | Suggested Replacement |
|------|-------------|----------------------|
| `cortex/CortexChatPanel.tsx` | `#1C1C1D` | `var(--cortex-sidebar-bg)` |
| `cortex/CortexFileExplorer.tsx` | `#141415`, `#2E2F31` | `var(--cortex-bg-primary)`, `var(--cortex-border-default)` |
| `cortex/CortexDesktopLayout.tsx` | `#141415`, `#2E2F31` | `var(--cortex-bg-primary)`, `var(--cortex-border-default)` |
| `cortex/CortexExtensionsPanel.tsx` | `#4A9EFF`, `#FF6B6B`, `#51CF66`, `#FAB005`, `#CC5DE8`, `#20C997`, `#FF922B`, `#845EF7` | Define as `--cortex-ext-color-*` tokens |
| `cortex/CortexUpdateFile.tsx` | `#5DCF3B`, `#F83737`, `#8C8D8F` | `var(--cortex-success)`, `var(--cortex-error)`, `var(--cortex-text-secondary)` |
| `cortex/CortexTokenLimit.tsx` | `#5DCF3B`, `#F59E0B`, `#F83737`, `#252628` | `var(--cortex-success)`, `var(--cortex-warning)`, `var(--cortex-error)`, `var(--cortex-bg-elevated)` |
| `cortex/CortexAgentSidebar.tsx` | `#D28B39` | `var(--cortex-warning)` or new token |
| `cortex/CortexConversationView.tsx` | various | Use `--cortex-*` semantic tokens |
| `cortex/CortexEditorTabs.tsx` | various | Use `--cortex-*` semantic tokens |
| `cortex/CortexChangesPanel.tsx` | various | Use `--cortex-*` semantic tokens |
| `cortex/CortexActivityBar.tsx` | various | Use `--cortex-*` semantic tokens |
| `cortex/CortexBreadcrumb.tsx` | various | Use `--cortex-*` semantic tokens |
| `cortex/CortexTitleBar.tsx` | various | Use `--cortex-*` semantic tokens |
| `cortex/CortexThemePicker.tsx` | various | Use `--cortex-*` semantic tokens |
| `cortex/diagnostics/DiagnosticsPanel.tsx` | `#3794ff`, `#4ec9b0`, `#1e1e1e` | `var(--cortex-info)`, `var(--cortex-success)`, `var(--cortex-bg-primary)` |
| `cortex/diagnostics/ErrorDetailView.tsx` | `#3794ff`, `#c8ff00`, `#1e1e1e` | `var(--cortex-info)`, `var(--cortex-accent-primary)`, `var(--cortex-bg-primary)` |
| `cortex/diagnostics/VulnerableDepsView.tsx` | `#FF922B`, `#3794ff`, `#4ec9b0` | `var(--cortex-warning)`, `var(--cortex-info)`, `var(--cortex-success)` |
| `cortex/diagnostics/DiagnosticsFilterBar.tsx` | `#3794ff` | `var(--cortex-info)` |
| `cortex/editor/CortexDiffEditor.tsx` | `#2A2B2F`, `#4ADE80`, `#F87171` | `var(--cortex-bg-elevated)`, `var(--cortex-success)`, `var(--cortex-error)` |
| `cortex/editor/EditorStatusBarItems.tsx` | `#BFFF00` | `var(--cortex-accent-primary)` |
| `cortex/editor/QuickPickMenu.tsx` | `#1e1e2e` | `var(--cortex-bg-elevated)` |
| `cortex/command-palette/CortexCommandPalette.tsx` | `#1e1e1e`, `#e0e0e0` | `var(--cortex-bg-elevated)`, `var(--cortex-text-primary)` |
| `cortex/remote/TunnelPanel.tsx` | `#1e1e1e` | `var(--cortex-bg-primary)` |
| `cortex/remote/TunnelStatusBar.tsx` | `#2d2d2d` | `var(--cortex-bg-elevated)` |
| `cortex/git/PullRequestPanel.tsx` | various | Use `--cortex-*` semantic tokens |
| `cortex/primitives/CortexButton.tsx` | various | Use `--cortex-btn-*` tokens |
| `cortex/primitives/CortexSendButton.tsx` | various | Use `--cortex-accent-*` tokens |
| `cortex/primitives/CortexSmallButton.tsx` | various | Use `--cortex-small-btn-*` tokens |
| `cortex/primitives/CortexInput.tsx` | various | Use `--cortex-input-*` tokens |
| `cortex/primitives/CortexDropdown.tsx` | various | Use `--cortex-dropdown-*` tokens |
| `cortex/primitives/CortexDropdownItem.tsx` | various | Use `--cortex-dropdown-*` tokens |
| `cortex/primitives/CortexDropdownMenu.tsx` | various | Use `--cortex-dropdown-*` tokens |
| `cortex/primitives/CortexHeaderItem.tsx` | various | Use `--cortex-*` tokens |
| `cortex/primitives/CortexModelSelector.tsx` | various | Use `--cortex-model-selector-*` tokens |
| `cortex/primitives/CortexOpenProjectDropdown.tsx` | various | Use `--cortex-open-project-*` tokens |
| `cortex/primitives/CortexVibeToggle.tsx` | various | Use `--cortex-accent-*` tokens |
| `cortex/primitives/CortexToggle.tsx` | various | Use `--cortex-switch-*` tokens |
| `cortex/primitives/CortexTabs.tsx` | various | Use `--cortex-tab-*` tokens |
| `cortex/primitives/CortexSeparator.tsx` | various | Use `--cortex-border-*` tokens |
| `cortex/primitives/CortexCodeNavHelp.tsx` | various | Use `--cortex-*` tokens |
| `cortex/primitives/CortexConfigBadge.tsx` | various | Use `--cortex-*` tokens |
| `cortex/primitives/CortexStartPause.tsx` | various | Use `--cortex-pause-color` token |

### Other Components with Hardcoded Colors

| File | Colors Found | Notes |
|------|-------------|-------|
| `editor/EditorGroupHeader.tsx` | `#3b82f6`, `#8b5cf6`, `#ec4899`, `#f59e0b` | Tab group color indicators |
| `editor/grid/DropZoneOverlay.tsx` | `#3b82f6` (fallback) | Uses `var(--accent-primary, #3b82f6)` — update fallback |
| `editor/Minimap.tsx` | `#569cd6` | Minimap keyword color |
| `editor/BracketPairColorizer.tsx` | various bracket colors | Syntax-specific, may keep |
| `editor/DiffEditor3Way.tsx` | diff colors | Merge-specific colors |
| `editor/InlineDiff.tsx` | diff colors | Diff-specific colors |
| `editor/PeekView.tsx` | various | UI colors |
| `editor/StickyScroll.tsx` | various | UI colors |
| `editor/BreadcrumbBar.tsx` | various | UI colors |
| `editor/SnippetManager.tsx` | various | UI colors |
| `workspace/WorkspaceManager.tsx` | `#262637`, `#313244`, `#6c7086`, `#a6adc8`, `#cdd6f4` | Catppuccin palette — migrate |
| `workspace/WorkspaceSwitcher.tsx` | `#262637`, `#313244`, `#6c7086`, `#a6adc8`, `#cdd6f4` | Catppuccin palette — migrate |
| `workspace/WorkspaceTrustDialog.tsx` | `#181825`, `#1e1e2e`, `#a6adc8`, `#cdd6f4`, `#f9e2af` | Catppuccin palette — migrate |
| `workspace/WorkspacePanel.tsx` | `#ef4444` | Use `var(--cortex-error)` |
| `debugger/BreakpointPanel.tsx` | various | Debug-specific colors |
| `debugger/CallStackPanel.tsx` | various | Debug-specific colors |
| `debugger/VariablesPanel.tsx` | various | Debug-specific colors |
| `debugger/WatchPanel.tsx` | various | Debug-specific colors |
| `debugger/MemoryInspector.tsx` | various | Debug-specific colors |
| `git/GitGraph.tsx` | branch colors | May need dedicated tokens |
| `notebook/outputs/AnsiOutput.tsx` | ANSI color palette | Terminal-specific, may keep |
| `notifications/NotificationItem.tsx` | various | Use `--cortex-*` semantic tokens |
| `notifications/NotificationToast.tsx` | various | Use `--cortex-*` semantic tokens |
| `output/OutputChannel.tsx` | various | Use `--cortex-*` semantic tokens |
| `search/RegexPatternsLibrary.tsx` | various | Use `--cortex-*` semantic tokens |
| `search/ReplacePreview.tsx` | various | Use `--cortex-*` semantic tokens |
| `search/SearchHistoryPanel.tsx` | various | Use `--cortex-*` semantic tokens |
| `settings/ThemeSelector.tsx` | various | Theme preview colors, may keep |
| `settings/SemanticTokenColorEditor.tsx` | various | Color editor, may keep |
| `testing/TestOutput.tsx` | various | Use `--cortex-*` semantic tokens |
| `preview/BrowserPreview.tsx` | various | Use `--cortex-*` semantic tokens |
| `extensions/ContributedPanel.tsx` | various | Use `--cortex-*` semantic tokens |
| `extensions/ContributedView.tsx` | various | Use `--cortex-*` semantic tokens |
| `remote/PortForwardingPanel.tsx` | various | Use `--cortex-*` semantic tokens |
| `workspace-trust/WorkspaceTrustBanner.tsx` | various | Use `--cortex-*` semantic tokens |
| `KeyboardShortcutsEditorRow.tsx` | various | Use `--cortex-*` semantic tokens |

---

## 2. Legacy `--surface-*` / `--text-*` Variable Usage (~5080 instances)

These variables are now aliased to `--cortex-*` equivalents in `cortex-tokens.css`
and `design-tokens.css`, so they work correctly. However, they should be migrated
to `--cortex-*` variables for consistency.

### Most-Used Legacy Variables (by count)

| Variable | Count | Cortex Equivalent |
|----------|-------|-------------------|
| `var(--text-weak)` | ~1449 | `var(--cortex-text-secondary)` |
| `var(--text-base)` | ~669 | `var(--cortex-text-primary)` |
| `var(--border-weak)` | ~543 | `var(--cortex-border-default)` |
| `var(--surface-raised)` | ~512 | `var(--cortex-bg-secondary)` |
| `var(--text-weaker)` | ~354 | `var(--cortex-text-tertiary)` |
| `var(--surface-hover)` | ~281 | `var(--cortex-bg-hover)` |
| `var(--border-base)` | ~257 | `var(--cortex-border-default)` |
| `var(--surface-base)` | ~199 | `var(--cortex-bg-primary)` |
| `var(--accent-primary)` | ~163 | `var(--cortex-accent-primary)` |
| `var(--surface-active)` | ~127 | `var(--cortex-bg-active)` |
| `var(--text-muted)` | ~105 | `var(--cortex-text-muted)` |
| `var(--text-strong)` | ~87 | `var(--cortex-text-primary)` |
| `var(--surface-sunken)` | ~85 | `var(--cortex-bg-primary)` |
| `var(--text-primary)` | ~52 | `var(--cortex-text-primary)` |
| `var(--border-default)` | ~45 | `var(--cortex-border-default)` |
| `var(--accent)` | ~40 | `var(--cortex-accent-primary)` |
| `var(--surface-overlay)` | ~36 | `var(--cortex-bg-overlay)` |
| `var(--text-title)` | ~25 | `var(--cortex-text-primary)` |
| `var(--surface-border)` | ~21 | `var(--cortex-border-default)` |
| `var(--surface-card)` | ~18 | `var(--cortex-bg-secondary)` |
| `var(--text-placeholder)` | ~17 | `var(--cortex-text-placeholder)` |
| `var(--text-secondary)` | ~14 | `var(--cortex-text-secondary)` |
| `var(--text-tertiary)` | ~9 | `var(--cortex-text-tertiary)` |
| `var(--surface-input)` | ~9 | `var(--cortex-bg-tertiary)` |
| `var(--surface-panel)` | ~7 | `var(--cortex-bg-secondary)` |
| `var(--text-on-accent)` | ~5 | `var(--cortex-accent-text)` |
| `var(--accent-muted)` | ~4 | `var(--cortex-accent-muted)` |
| `var(--error)` | ~4 | `var(--cortex-error)` |

---

## 3. Legacy TypeScript Token Imports (~109 files)

Files importing from `@/design-system/tokens` (legacy Orion tokens) instead of
`@/design-system/tokens/cortex-tokens`:

These continue to work because the CSS variables they reference are aliased.
Migration is recommended for consistency.

---

## Migration Strategy

1. **Phase 1 (Done)**: CSS variable aliases ensure no breakage
2. **Phase 2**: Migrate Cortex-prefixed components first (highest priority)
3. **Phase 3**: Migrate remaining components file-by-file
4. **Phase 4**: Update TypeScript imports from legacy `tokens` to `cortex-tokens`
5. **Phase 5**: Remove legacy `design-tokens.css` and `tokens/index.ts`
