/**
 * FormatterSelector - Multiple Formatters Selection Component
 *
 * Provides a dropdown UI for selecting formatters per language:
 * - Shows available formatters for the current language
 * - Includes both built-in formatters and LSP formatters
 * - Remembers user's choice via localStorage
 * - Quick switch capability in status bar
 * - Prompts user when multiple formatters are available
 */

import { createSignal, Show, For, createMemo, onMount, onCleanup } from "solid-js";
import { useFormatter, type FormatterType } from "@/context/FormatterContext";
import { Icon } from "./ui/Icon";

/** Display names for built-in formatters */
const FORMATTER_DISPLAY_NAMES: Record<FormatterType, string> = {
  prettier: "Prettier",
  rustfmt: "rustfmt",
  black: "Black",
  gofmt: "gofmt",
  clangformat: "ClangFormat",
  biome: "Biome",
  deno: "Deno",
};

/** Descriptions for built-in formatters */
const FORMATTER_DESCRIPTIONS: Record<FormatterType, string> = {
  prettier: "Opinionated code formatter supporting many languages",
  rustfmt: "Official Rust code formatter",
  black: "The uncompromising Python code formatter",
  gofmt: "Official Go code formatter",
  clangformat: "C/C++ code formatter from LLVM",
  biome: "Fast formatter for JavaScript, TypeScript, and JSON",
  deno: "Built-in Deno formatter for TypeScript and JavaScript",
};

interface FormatterSelectorProps {
  /** Current language ID */
  language: string;
  /** Callback when selector is closed */
  onClose?: () => void;
  /** Additional class names */
  class?: string;
}

/**
 * FormatterSelector - Main dropdown component for selecting formatters
 */
export function FormatterSelector(props: FormatterSelectorProps) {
  const formatter = useFormatter();
  const [isOpen, setIsOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  let containerRef: HTMLDivElement | undefined;

  const languageFormatters = createMemo(() => formatter.getFormatters(props.language));

  const currentFormatter = createMemo(() => {
    const langFormatters = languageFormatters();
    return langFormatters.defaultFormatter || formatter.state.settings.defaultFormatter;
  });

  const filteredFormatters = createMemo(() => {
    const query = searchQuery().toLowerCase();
    const langFormatters = languageFormatters();

    const builtinFiltered = langFormatters.formatters.filter((f) => {
      const name = FORMATTER_DISPLAY_NAMES[f]?.toLowerCase() || f.toLowerCase();
      const desc = FORMATTER_DESCRIPTIONS[f]?.toLowerCase() || "";
      return name.includes(query) || desc.includes(query);
    });

    const lspFiltered = langFormatters.lspFormatters.filter((p) => {
      return p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query);
    });

    return { builtin: builtinFiltered, lsp: lspFiltered };
  });

  const hasMultiple = createMemo(() => {
    const langFormatters = languageFormatters();
    return langFormatters.formatters.length + langFormatters.lspFormatters.length > 1;
  });

  const handleSelect = (formatterId: FormatterType | string) => {
    formatter.setDefaultFormatter(props.language, formatterId);
    setIsOpen(false);
    props.onClose?.();
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  const getFormatterDisplayName = (formatterId: FormatterType | string): string => {
    if (formatterId in FORMATTER_DISPLAY_NAMES) {
      return FORMATTER_DISPLAY_NAMES[formatterId as FormatterType];
    }
    const lspFormatter = languageFormatters().lspFormatters.find((p) => p.id === formatterId);
    return lspFormatter?.name || formatterId;
  };

  return (
    <div ref={containerRef} class={`relative ${props.class || ""}`}>
      <button
        onClick={() => setIsOpen(!isOpen())}
        class="flex items-center gap-2 rounded-lg border border-border bg-background-tertiary px-3 py-1.5 text-sm hover:border-border-active transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
        title={`Current formatter: ${getFormatterDisplayName(currentFormatter())}`}
      >
        <Icon name="code" class="h-4 w-4 text-primary" />
        <span class="max-w-[120px] truncate">{getFormatterDisplayName(currentFormatter())}</span>
        <Show when={hasMultiple()}>
          <span class="text-xs text-foreground-muted px-1 py-0.5 rounded bg-background-secondary">
            {languageFormatters().formatters.length + languageFormatters().lspFormatters.length}
          </span>
        </Show>
        <Icon name="chevron-down" class={`h-4 w-4 transition-transform ${isOpen() ? "rotate-180" : ""}`} />
      </button>

      <Show when={isOpen()}>
        <div class="absolute right-0 top-full mt-1 z-50 min-w-[280px] max-h-[400px] overflow-hidden rounded-lg border border-border bg-background-secondary shadow-lg">
          {/* Search input */}
          <div class="p-2 border-b border-border">
            <input
              type="text"
              placeholder="Search formatters..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full px-3 py-1.5 text-sm rounded border border-border bg-background-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Formatter list */}
          <div class="max-h-[300px] overflow-y-auto p-2">
            {/* Built-in formatters */}
            <Show when={filteredFormatters().builtin.length > 0}>
              <div class="mb-2">
                <div class="mb-1 flex items-center gap-2 px-2 text-xs font-semibold text-foreground-muted uppercase tracking-wide">
                  <Icon name="code" class="h-3 w-3" />
                  <span>Built-in Formatters</span>
                </div>
                <For each={filteredFormatters().builtin}>
                  {(formatterId) => {
                    const isSelected = () => currentFormatter() === formatterId;
                    const isAvailable = () =>
                      formatter.state.availableFormatters.some(
                        (f) => f.formatter === formatterId && f.available
                      );

                    return (
                      <button
                        onClick={() => handleSelect(formatterId)}
                        disabled={!isAvailable()}
                        class={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50 ${
                          isSelected()
                            ? "bg-primary/10 text-primary"
                            : isAvailable()
                            ? "hover:bg-background-tertiary"
                            : "opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="font-medium">{FORMATTER_DISPLAY_NAMES[formatterId]}</span>
                            <Show when={!isAvailable()}>
                              <span class="text-[10px] rounded bg-yellow-500/20 px-1 py-0.5 text-yellow-400">
                                Not installed
                              </span>
                            </Show>
                          </div>
                          <div class="text-xs text-foreground-muted truncate">
                            {FORMATTER_DESCRIPTIONS[formatterId]}
                          </div>
                        </div>
                        <Show when={isSelected()}>
                          <Icon name="check" class="h-4 w-4 text-primary flex-shrink-0" />
                        </Show>
                      </button>
                    );
                  }}
                </For>
              </div>
            </Show>

            {/* LSP formatters */}
            <Show when={filteredFormatters().lsp.length > 0}>
              <div class="mb-2">
                <div class="mb-1 flex items-center gap-2 px-2 text-xs font-semibold text-foreground-muted uppercase tracking-wide">
                  <Icon name="server" class="h-3 w-3" />
                  <span>Language Server Formatters</span>
                </div>
                <For each={filteredFormatters().lsp}>
                  {(provider) => {
                    const isSelected = () => currentFormatter() === provider.id;

                    return (
                      <button
                        onClick={() => handleSelect(provider.id)}
                        class={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50 ${
                          isSelected()
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-background-tertiary"
                        }`}
                      >
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="font-medium">{provider.name}</span>
                            <span class="text-[10px] rounded bg-blue-500/20 px-1 py-0.5 text-blue-400">
                              LSP
                            </span>
                          </div>
                          <div class="text-xs text-foreground-muted truncate">
                            {provider.id}
                          </div>
                        </div>
                        <Show when={isSelected()}>
                          <Icon name="check" class="h-4 w-4 text-primary flex-shrink-0" />
                        </Show>
                      </button>
                    );
                  }}
                </For>
              </div>
            </Show>

            {/* Empty state */}
            <Show
              when={
                filteredFormatters().builtin.length === 0 &&
                filteredFormatters().lsp.length === 0
              }
            >
              <div class="px-3 py-6 text-center text-sm text-foreground-muted">
                <Icon name="circle-exclamation" class="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No formatters available for this language</p>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div class="border-t border-border px-3 py-2 bg-background-tertiary/50">
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("settings:open-tab"));
                setIsOpen(false);
              }}
              class="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground-base transition-colors cursor-pointer"
            >
              <Icon name="gear" class="h-3 w-3" />
              <span>Configure Formatter Settings</span>
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

interface FormatterStatusBarItemProps {
  /** Language ID for the current file */
  language: string;
}

/**
 * FormatterStatusBarItem - Compact status bar component for quick formatter switching
 */
export function FormatterStatusBarItem(props: FormatterStatusBarItemProps) {
  const formatter = useFormatter();
  const [isOpen, setIsOpen] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  const languageFormatters = createMemo(() => formatter.getFormatters(props.language));

  const currentFormatter = createMemo(() => {
    const langFormatters = languageFormatters();
    return langFormatters.defaultFormatter || formatter.state.settings.defaultFormatter;
  });

  const hasMultiple = createMemo(() => {
    const langFormatters = languageFormatters();
    return langFormatters.formatters.length + langFormatters.lspFormatters.length > 1;
  });

  const getFormatterDisplayName = (formatterId: FormatterType | string): string => {
    if (formatterId in FORMATTER_DISPLAY_NAMES) {
      return FORMATTER_DISPLAY_NAMES[formatterId as FormatterType];
    }
    const lspFormatter = languageFormatters().lspFormatters.find((p) => p.id === formatterId);
    return lspFormatter?.name || formatterId;
  };

  const handleSelect = (formatterId: FormatterType | string) => {
    formatter.setDefaultFormatter(props.language, formatterId);
    setIsOpen(false);
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  const itemBaseClass = "flex items-center gap-1 px-1.5 py-0.5 rounded-sm transition-colors";
  const itemHoverStyle = "hover:bg-[rgba(255,255,255,0.06)]";

  return (
    <div ref={containerRef} class="relative">
      <button
        class={`${itemBaseClass} ${itemHoverStyle}`}
        onClick={() => hasMultiple() && setIsOpen(!isOpen())}
        title={
          hasMultiple()
            ? `Formatter: ${getFormatterDisplayName(currentFormatter())} (Click to change)`
            : `Formatter: ${getFormatterDisplayName(currentFormatter())}`
        }
        style={{
          color: hasMultiple() ? "var(--text-base)" : "var(--text-weaker)",
          cursor: hasMultiple() ? "pointer" : "default",
        }}
      >
        <Icon name="code" class="w-3 h-3" />
        <span style={{ "font-size": "11px" }}>{getFormatterDisplayName(currentFormatter())}</span>
        <Show when={hasMultiple()}>
          <Icon name="chevron-down" class={`w-3 h-3 transition-transform ${isOpen() ? "rotate-180" : ""}`} />
        </Show>
      </button>

      <Show when={isOpen()}>
        <div
          class="absolute bottom-full mb-1 right-0 z-50 min-w-[200px] max-h-[250px] overflow-hidden rounded-lg border shadow-lg"
          style={{
            background: "var(--background-base)",
            "border-color": "var(--border-weak)",
          }}
        >
          <div class="max-h-[200px] overflow-y-auto p-1">
            {/* Built-in formatters */}
            <For each={languageFormatters().formatters}>
              {(formatterId) => {
                const isSelected = () => currentFormatter() === formatterId;
                const isAvailable = () =>
                  formatter.state.availableFormatters.some(
                    (f) => f.formatter === formatterId && f.available
                  );

                return (
                  <button
                    onClick={() => handleSelect(formatterId)}
                    disabled={!isAvailable()}
                    class="flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors"
                    style={{
                      "font-size": "11px",
                      color: isSelected()
                        ? "var(--accent)"
                        : isAvailable()
                        ? "var(--text-base)"
                        : "var(--text-weaker)",
                      background: isSelected() ? "rgba(var(--accent-rgb), 0.1)" : "transparent",
                      cursor: isAvailable() ? "pointer" : "not-allowed",
                      opacity: isAvailable() ? 1 : 0.5,
                    }}
                    onMouseEnter={(e) => {
                      if (isAvailable() && !isSelected()) {
                        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected()) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <span class="flex-1">{FORMATTER_DISPLAY_NAMES[formatterId]}</span>
                    <Show when={isSelected()}>
                      <Icon name="check" class="w-3 h-3" />
                    </Show>
                  </button>
                );
              }}
            </For>

            {/* LSP formatters */}
            <Show when={languageFormatters().lspFormatters.length > 0}>
              <div
                class="my-1 mx-2"
                style={{ height: "1px", background: "var(--border-weak)" }}
              />
              <For each={languageFormatters().lspFormatters}>
                {(provider) => {
                  const isSelected = () => currentFormatter() === provider.id;

                  return (
                    <button
                      onClick={() => handleSelect(provider.id)}
                      class="flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors"
                      style={{
                        "font-size": "11px",
                        color: isSelected() ? "var(--accent)" : "var(--text-base)",
                        background: isSelected() ? "rgba(var(--accent-rgb), 0.1)" : "transparent",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected()) {
                          e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected()) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <span class="flex-1">{provider.name}</span>
                      <span
                        style={{
                          "font-size": "9px",
                          padding: "1px 4px",
                          "border-radius": "var(--cortex-radius-sm)",
                          background: "rgba(59, 130, 246, 0.2)",
                          color: "rgb(147, 197, 253)",
                        }}
                      >
                        LSP
                      </span>
                      <Show when={isSelected()}>
                        <Icon name="check" class="w-3 h-3" />
                      </Show>
                    </button>
                  );
                }}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

interface FormatterPromptDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Language ID */
  language: string;
  /** Callback when a formatter is selected */
  onSelect: (formatter: FormatterType | string) => void;
  /** Callback when dialog is dismissed */
  onDismiss: () => void;
  /** Whether to remember the choice */
  rememberChoice?: boolean;
}

/**
 * FormatterPromptDialog - Dialog shown when multiple formatters are available
 * and no default has been set for the language
 */
export function FormatterPromptDialog(props: FormatterPromptDialogProps) {
  const formatter = useFormatter();
  const [rememberChoice, setRememberChoice] = createSignal(props.rememberChoice ?? true);

  const languageFormatters = createMemo(() => formatter.getFormatters(props.language));

  const handleSelect = (formatterId: FormatterType | string) => {
    if (rememberChoice()) {
      formatter.setDefaultFormatter(props.language, formatterId);
    }
    props.onSelect(formatterId);
  };

  return (
    <Show when={props.isOpen}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0, 0, 0, 0.5)" }}
        onClick={props.onDismiss}
      >
        {/* Dialog */}
        <div
          class="w-full max-w-md rounded-lg border shadow-xl"
          style={{
            background: "var(--background-base)",
            "border-color": "var(--border-weak)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="px-4 py-3 border-b" style={{ "border-color": "var(--border-weak)" }}>
            <h2 class="text-lg font-semibold" style={{ color: "var(--text-base)" }}>
              Choose a Formatter
            </h2>
            <p class="text-sm mt-1" style={{ color: "var(--text-weaker)" }}>
              Multiple formatters are available for {props.language}. Select one to use:
            </p>
          </div>

          {/* Content */}
          <div class="p-4 max-h-[300px] overflow-y-auto">
            <div class="space-y-2">
              {/* Built-in formatters */}
              <For each={languageFormatters().formatters}>
                {(formatterId) => {
                  const isAvailable = () =>
                    formatter.state.availableFormatters.some(
                      (f) => f.formatter === formatterId && f.available
                    );

                  return (
                    <button
                      onClick={() => handleSelect(formatterId)}
                      disabled={!isAvailable()}
                      class="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors border"
                      style={{
                        "border-color": "var(--border-weak)",
                        background: "var(--background-secondary)",
                        cursor: isAvailable() ? "pointer" : "not-allowed",
                        opacity: isAvailable() ? 1 : 0.5,
                      }}
                      onMouseEnter={(e) => {
                        if (isAvailable()) {
                          e.currentTarget.style.borderColor = "var(--accent)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-weak)";
                      }}
                    >
                      <div class="flex-shrink-0 mt-0.5">
                        <Icon name="code" class="w-5 h-5" style={{ color: "var(--accent)" }} />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="font-medium" style={{ color: "var(--text-base)" }}>
                            {FORMATTER_DISPLAY_NAMES[formatterId]}
                          </span>
                          <Show when={!isAvailable()}>
                            <span
                              class="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: "rgba(234, 179, 8, 0.2)", color: "rgb(253, 224, 71)" }}
                            >
                              Not installed
                            </span>
                          </Show>
                        </div>
                        <p class="text-sm mt-0.5" style={{ color: "var(--text-weaker)" }}>
                          {FORMATTER_DESCRIPTIONS[formatterId]}
                        </p>
                      </div>
                    </button>
                  );
                }}
              </For>

              {/* LSP formatters */}
              <For each={languageFormatters().lspFormatters}>
                {(provider) => (
                  <button
                    onClick={() => handleSelect(provider.id)}
                    class="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors border"
                    style={{
                      "border-color": "var(--border-weak)",
                      background: "var(--background-secondary)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-weak)";
                    }}
                  >
                    <div class="flex-shrink-0 mt-0.5">
                      <Icon name="server" class="w-5 h-5" style={{ color: "var(--accent)" }} />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-medium" style={{ color: "var(--text-base)" }}>
                          {provider.name}
                        </span>
                        <span
                          class="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(59, 130, 246, 0.2)", color: "rgb(147, 197, 253)" }}
                        >
                          LSP
                        </span>
                      </div>
                      <p class="text-sm mt-0.5" style={{ color: "var(--text-weaker)" }}>
                        Formatter provided by language server: {provider.id}
                      </p>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Footer */}
          <div
            class="px-4 py-3 border-t flex items-center justify-between"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberChoice()}
                onChange={(e) => setRememberChoice(e.currentTarget.checked)}
                class="rounded border-border"
              />
              <span class="text-sm" style={{ color: "var(--text-weaker)" }}>
                Remember my choice
              </span>
            </label>
            <button
              onClick={props.onDismiss}
              class="px-3 py-1.5 text-sm rounded transition-colors"
              style={{
                color: "var(--text-weaker)",
                background: "var(--background-tertiary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--background-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--background-tertiary)";
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

/**
 * useFormatterPrompt - Hook for prompting user when multiple formatters are available
 */
export function useFormatterPrompt() {
  const formatter = useFormatter();
  const [showPrompt, setShowPrompt] = createSignal(false);
  const [promptLanguage, setPromptLanguage] = createSignal<string | null>(null);
  const [resolvePrompt, setResolvePrompt] = createSignal<((value: FormatterType | string | null) => void) | null>(null);

  const promptForFormatter = (language: string): Promise<FormatterType | string | null> => {
    const langFormatters = formatter.getFormatters(language);
    const hasDefault = langFormatters.defaultFormatter !== null;
    const hasMultiple = langFormatters.formatters.length + langFormatters.lspFormatters.length > 1;

    if (hasDefault || !hasMultiple) {
      return Promise.resolve(langFormatters.defaultFormatter);
    }

    return new Promise((resolve) => {
      setPromptLanguage(language);
      setShowPrompt(true);
      setResolvePrompt(() => resolve);
    });
  };

  const handleSelect = (formatterId: FormatterType | string) => {
    const resolve = resolvePrompt();
    if (resolve) {
      resolve(formatterId);
    }
    setShowPrompt(false);
    setPromptLanguage(null);
    setResolvePrompt(null);
  };

  const handleDismiss = () => {
    const resolve = resolvePrompt();
    if (resolve) {
      resolve(null);
    }
    setShowPrompt(false);
    setPromptLanguage(null);
    setResolvePrompt(null);
  };

  return {
    showPrompt,
    promptLanguage,
    promptForFormatter,
    handleSelect,
    handleDismiss,
  };
}

