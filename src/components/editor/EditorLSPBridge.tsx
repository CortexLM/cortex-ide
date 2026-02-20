/**
 * EditorLSPBridge - Renderless SolidJS component for LSP provider registration
 * and settings synchronization.
 *
 * Handles one-time registration of all Monaco LSP providers and keeps
 * editor-level LSP settings (codeLens, formatOnType, unicodeHighlight,
 * linkedEditing) in sync with the application settings state.
 *
 * This component is part of the CodeEditor refactor that splits the monolithic
 * editor into focused, composable sub-components.
 */

import { createEffect, onMount } from "solid-js";
import type * as Monaco from "monaco-editor";
import {
  registerAllProviders,
  updateCodeLensSettings,
  updateFormatOnTypeSettings,
  updateUnicodeHighlightSettings,
  updateLinkedEditingEnabled,
} from "./modules/EditorLSP";

// ============================================================================
// Types
// ============================================================================

export interface EditorLSPBridgeProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  settingsState: any;
  currentLanguage: () => string;
  getEffectiveEditorSettings: any;
}

// ============================================================================
// Module State
// ============================================================================

let providersRegistered = false;

// ============================================================================
// Component
// ============================================================================

/**
 * Renderless component that bridges Monaco LSP providers with application settings.
 *
 * Responsibilities:
 * - Registers all LSP providers once globally (inlay hints, codeLens, etc.)
 * - Syncs codeLens settings when they change
 * - Syncs format-on-type settings when they change
 * - Syncs unicode highlight settings when they change
 * - Syncs linked editing settings when they change
 */
export function EditorLSPBridge(
  props: EditorLSPBridgeProps,
): null {
  onMount(() => {
    const monaco = props.monaco;
    if (!monaco || providersRegistered) return;

    providersRegistered = true;
    requestAnimationFrame(() => {
      registerAllProviders(monaco);
    });
  });

  createEffect(() => {
    const codeLensConfig = props.settingsState.settings.editor.codeLens;
    if (codeLensConfig) {
      updateCodeLensSettings(codeLensConfig);
    }
  });

  createEffect(() => {
    const language = props.currentLanguage();
    const langSettings = props.getEffectiveEditorSettings(language);
    updateFormatOnTypeSettings({
      enabled: langSettings.formatOnType ?? false,
      triggerCharacters:
        props.settingsState.settings.editor.formatOnTypeTriggerCharacters ?? [
          ";",
          "}",
          "\n",
        ],
    });
  });

  createEffect(() => {
    const unicodeSettings =
      props.settingsState.settings.editor.unicodeHighlight;
    if (unicodeSettings) {
      updateUnicodeHighlightSettings({
        enabled: unicodeSettings.enabled ?? true,
        invisibleCharacters: unicodeSettings.invisibleCharacters ?? true,
        ambiguousCharacters: unicodeSettings.ambiguousCharacters ?? true,
        nonBasicASCII: unicodeSettings.nonBasicASCII ?? false,
        includeComments:
          unicodeSettings.includeComments ?? "inUntrustedWorkspace",
        includeStrings: unicodeSettings.includeStrings ?? true,
        allowedCharacters: unicodeSettings.allowedCharacters ?? {},
        allowedLocales: unicodeSettings.allowedLocales ?? {
          _os: true,
          _vscode: true,
        },
      });
    }
  });

  createEffect(() => {
    const language = props.currentLanguage();
    const langSettings = props.getEffectiveEditorSettings(language);
    updateLinkedEditingEnabled(langSettings.linkedEditing ?? true);
  });

  return null;
}
