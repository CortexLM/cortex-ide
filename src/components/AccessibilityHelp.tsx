import {
  Show,
  For,
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
  JSX,
} from "solid-js";
import { Icon } from "./ui/Icon";
import { useAccessibility } from "@/context/AccessibilityContext";

// ============================================================================
// Types
// ============================================================================

interface KeyboardShortcut {
  keys: string;
  description: string;
  category: string;
}

interface HelpSection {
  id: string;
  title: string;
  icon: JSX.Element;
}

type TabId = "shortcuts" | "screenReader" | "navigation" | "settings";

// ============================================================================
// Keyboard Shortcuts Data
// ============================================================================

const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // General
  { keys: "Ctrl+Shift+P", description: "Open Command Palette", category: "General" },
  { keys: "Ctrl+P", description: "Quick Open / Go to File", category: "General" },
  { keys: "Ctrl+,", description: "Open Settings", category: "General" },
  { keys: "Ctrl+N", description: "New Session", category: "General" },
  { keys: "F1", description: "Show Accessibility Help", category: "General" },
  { keys: "Ctrl+Shift+?", description: "Show Accessibility Help", category: "General" },

  // Navigation
  { keys: "Ctrl+G", description: "Go to Line", category: "Navigation" },
  { keys: "F12", description: "Go to Definition", category: "Navigation" },
  { keys: "Shift+F12", description: "Go to References", category: "Navigation" },
  { keys: "Ctrl+-", description: "Navigate Back", category: "Navigation" },
  { keys: "Ctrl+Shift+-", description: "Navigate Forward", category: "Navigation" },
  { keys: "Ctrl+Tab", description: "Switch Tabs", category: "Navigation" },
  { keys: "Alt+1-9", description: "Focus Nth Tab", category: "Navigation" },

  // Editor
  { keys: "Ctrl+F", description: "Find in File", category: "Editor" },
  { keys: "Ctrl+H", description: "Find and Replace", category: "Editor" },
  { keys: "Ctrl+Shift+F", description: "Find in Project", category: "Editor" },
  { keys: "Ctrl+Z", description: "Undo", category: "Editor" },
  { keys: "Ctrl+Shift+Z", description: "Redo", category: "Editor" },
  { keys: "Ctrl+X", description: "Cut Line/Selection", category: "Editor" },
  { keys: "Ctrl+C", description: "Copy Line/Selection", category: "Editor" },
  { keys: "Ctrl+V", description: "Paste", category: "Editor" },
  { keys: "Ctrl+/", description: "Toggle Comment", category: "Editor" },
  { keys: "Alt+Up", description: "Move Line Up", category: "Editor" },
  { keys: "Alt+Down", description: "Move Line Down", category: "Editor" },
  { keys: "Ctrl+D", description: "Add Selection to Next Match", category: "Editor" },
  { keys: "Ctrl+Shift+L", description: "Select All Occurrences", category: "Editor" },

  // View & Panels
  { keys: "Ctrl+B", description: "Toggle Sidebar", category: "View" },
  { keys: "Ctrl+`", description: "Toggle Terminal", category: "View" },
  { keys: "Ctrl+Shift+M", description: "Toggle Problems Panel", category: "View" },
  { keys: "Ctrl+=", description: "Zoom In", category: "View" },
  { keys: "Ctrl+-", description: "Zoom Out", category: "View" },
  { keys: "Ctrl+\\", description: "Split Editor", category: "View" },

  // Debug
  { keys: "F5", description: "Start/Continue Debugging", category: "Debug" },
  { keys: "Shift+F5", description: "Stop Debugging", category: "Debug" },
  { keys: "F9", description: "Toggle Breakpoint", category: "Debug" },
  { keys: "F10", description: "Step Over", category: "Debug" },
  { keys: "F11", description: "Step Into", category: "Debug" },
  { keys: "Shift+F11", description: "Step Out", category: "Debug" },

  // File
  { keys: "Ctrl+S", description: "Save File", category: "File" },
  { keys: "Ctrl+Shift+S", description: "Save All", category: "File" },
  { keys: "Ctrl+W", description: "Close Editor", category: "File" },
  { keys: "Ctrl+Shift+T", description: "Reopen Closed Editor", category: "File" },

  // Accessibility
  { keys: "Tab", description: "Move to Next Focusable Element", category: "Accessibility" },
  { keys: "Shift+Tab", description: "Move to Previous Focusable Element", category: "Accessibility" },
  { keys: "Enter/Space", description: "Activate Focused Button/Link", category: "Accessibility" },
  { keys: "Escape", description: "Close Dialog/Cancel", category: "Accessibility" },
  { keys: "Arrow Keys", description: "Navigate Within Components", category: "Accessibility" },
];

// ============================================================================
// Screen Reader Tips
// ============================================================================

const SCREEN_READER_TIPS = [
  {
    title: "Navigation Landmarks",
    tips: [
      "Use your screen reader's landmark navigation (e.g., D in NVDA) to quickly jump between regions",
      "Main content area is marked with 'main' landmark",
      "Sidebar uses 'complementary' landmark",
      "Activity bar uses 'navigation' landmark",
    ],
  },
  {
    title: "Headings Structure",
    tips: [
      "Use heading navigation (H key) to browse document structure",
      "Panel titles are marked as headings",
      "File names in tabs are accessible via aria-label",
    ],
  },
  {
    title: "Interactive Elements",
    tips: [
      "All buttons have accessible names",
      "Form inputs have associated labels",
      "Status changes are announced via live regions",
      "Loading states are announced automatically",
    ],
  },
  {
    title: "Editor Navigation",
    tips: [
      "Line numbers are announced when navigating",
      "Syntax errors and warnings are announced",
      "Use Ctrl+G to go to a specific line",
      "Use Ctrl+Shift+O to navigate symbols",
    ],
  },
  {
    title: "Announcements",
    tips: [
      "File saves, errors, and completions are announced",
      "Debug events like breakpoint hits are announced",
      "Task completions trigger announcements",
      "Audio signals can provide additional feedback (enable in settings)",
    ],
  },
];

// ============================================================================
// Navigation Help
// ============================================================================

const NAVIGATION_HELP = [
  {
    area: "Application Window",
    instructions: [
      "Press Tab to move through main areas: Activity Bar → Sidebar → Editor → Panel",
      "Press Escape to close any open dialog or popup",
      "Use Ctrl+1/2/3... to focus specific editor groups",
      "Press F6 to cycle between main window sections",
    ],
  },
  {
    area: "File Explorer",
    instructions: [
      "Use Arrow Up/Down to navigate files and folders",
      "Press Enter to open files or expand/collapse folders",
      "Press Right Arrow to expand a folder",
      "Press Left Arrow to collapse a folder or go to parent",
      "Type to filter files by name",
    ],
  },
  {
    area: "Editor",
    instructions: [
      "Use Ctrl+Tab to switch between open files",
      "Press Ctrl+\\ to split the editor",
      "Use Alt+Click for multiple cursors",
      "Press Ctrl+L to select the current line",
      "Use Ctrl+Shift+[ and ] to fold/unfold code",
    ],
  },
  {
    area: "Terminal",
    instructions: [
      "Press Ctrl+` to toggle terminal visibility",
      "Use Ctrl+Shift+` to create a new terminal",
      "Press Ctrl+PageUp/PageDown to switch terminals",
      "Terminal supports standard shell navigation",
    ],
  },
  {
    area: "Dialogs & Popups",
    instructions: [
      "Tab moves between interactive elements",
      "Enter confirms/submits",
      "Escape closes without action",
      "Arrow keys navigate lists and menus",
    ],
  },
];

// ============================================================================
// Help Sections Configuration
// ============================================================================

const HELP_SECTIONS: HelpSection[] = [
  { id: "shortcuts", title: "Keyboard Shortcuts", icon: <Icon name="command" size={16} /> },
  { id: "screenReader", title: "Screen Reader Tips", icon: <Icon name="desktop" size={16} /> },
  { id: "navigation", title: "Navigation Help", icon: <Icon name="location-arrow" size={16} /> },
  { id: "settings", title: "Accessibility Settings", icon: <Icon name="gear" size={16} /> },
];

// ============================================================================
// Component
// ============================================================================

export function AccessibilityHelp() {
  const [isOpen, setIsOpen] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<TabId>("shortcuts");
  const [searchQuery, setSearchQuery] = createSignal("");
  const accessibility = useAccessibility();

  let dialogRef: HTMLDivElement | undefined;
  let searchInputRef: HTMLInputElement | undefined;
  let lastFocusableRef: HTMLButtonElement | undefined;

  // Group shortcuts by category
  const shortcutsByCategory = createMemo(() => {
    const query = searchQuery().toLowerCase();
    const filtered = query
      ? KEYBOARD_SHORTCUTS.filter(
          (s) =>
            s.description.toLowerCase().includes(query) ||
            s.keys.toLowerCase().includes(query) ||
            s.category.toLowerCase().includes(query)
        )
      : KEYBOARD_SHORTCUTS;

    const grouped = new Map<string, KeyboardShortcut[]>();
    for (const shortcut of filtered) {
      const existing = grouped.get(shortcut.category) || [];
      existing.push(shortcut);
      grouped.set(shortcut.category, existing);
    }
    return grouped;
  });

  // Category order for display
  const categoryOrder = [
    "General",
    "Navigation",
    "Editor",
    "View",
    "Debug",
    "File",
    "Accessibility",
  ];

  // Handle keyboard events for opening/closing
  const handleGlobalKeydown = (e: KeyboardEvent) => {
    // F1 to open
    if (e.key === "F1") {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    // Ctrl+Shift+? to open (require ONLY Ctrl+Shift, not Alt or Meta)
    // Note: We explicitly check for ctrlKey to avoid interfering with typing "?"
    // which only requires Shift on most keyboard layouts
    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.key === "?") {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    // Escape to close
    if (e.key === "Escape" && isOpen()) {
      e.preventDefault();
      setIsOpen(false);
      return;
    }
  };

  // Focus trap for modal
  const handleDialogKeydown = (e: KeyboardEvent) => {
    if (e.key === "Tab" && accessibility.state.focusTrapEnabled) {
      const focusableElements = dialogRef?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  // Setup global keyboard listener
  onMount(() => {
    window.addEventListener("keydown", handleGlobalKeydown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleGlobalKeydown);
    });
  });

  // Focus management when dialog opens
  createEffect(() => {
    if (isOpen()) {
      // Focus search input when opening
      requestAnimationFrame(() => {
        searchInputRef?.focus();
      });

      // Announce to screen readers
      accessibility.announceToScreenReader(
        "Accessibility Help dialog opened. Use Tab to navigate, Escape to close."
      );
    }
  });

  // Close dialog
  const closeDialog = () => {
    setIsOpen(false);
    setSearchQuery("");
  };

  // Render keyboard shortcuts tab
  const renderShortcutsTab = () => (
    <div class="space-y-4">
      {/* Search */}
      <div class="relative">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search shortcuts..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          aria-label="Search keyboard shortcuts"
          class="w-full px-3 py-2 rounded-md text-sm"
          style={{
            background: "var(--surface-base)",
            color: "var(--text-base)",
            border: "1px solid var(--border-weak)",
            outline: "none",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border-weak)";
          }}
        />
      </div>

      {/* Shortcuts by category */}
      <div class="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        <For each={categoryOrder.filter((c) => shortcutsByCategory().has(c))}>
          {(category) => (
            <div>
              <h3
                class="text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded mb-2"
                style={{
                  color: "var(--text-weak)",
                  background: "var(--background-base)",
                }}
              >
                {category}
              </h3>
              <div class="space-y-1">
                <For each={shortcutsByCategory().get(category)}>
                  {(shortcut) => (
                    <div
                      class="flex items-center justify-between px-2 py-1.5 rounded"
                      style={{ background: "var(--surface-base)" }}
                    >
                      <span class="text-sm" style={{ color: "var(--text-base)" }}>
                        {shortcut.description}
                      </span>
                      <kbd
                        class="text-xs px-2 py-1 rounded font-mono"
                        style={{
                          background: "var(--background-base)",
                          color: "var(--text-weak)",
                          border: "1px solid var(--border-weak)",
                        }}
                      >
                        {shortcut.keys}
                      </kbd>
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>

        <Show when={shortcutsByCategory().size === 0}>
          <div class="text-center py-8" style={{ color: "var(--text-weak)" }}>
            No shortcuts found matching "{searchQuery()}"
          </div>
        </Show>
      </div>
    </div>
  );

  // Render screen reader tips tab
  const renderScreenReaderTab = () => (
    <div class="space-y-4 max-h-[450px] overflow-y-auto pr-2">
      <For each={SCREEN_READER_TIPS}>
        {(section) => (
          <div>
            <h3
              class="text-sm font-semibold px-2 py-1.5 rounded mb-2"
              style={{
                color: "var(--text-base)",
                background: "var(--surface-base)",
              }}
            >
              {section.title}
            </h3>
            <ul class="space-y-1 pl-4" role="list">
              <For each={section.tips}>
                {(tip) => (
                  <li
                    class="text-sm py-1 flex items-start gap-2"
                    style={{ color: "var(--text-weak)" }}
                  >
                    <span style={{ color: "var(--accent)" }}>•</span>
                    <span>{tip}</span>
                  </li>
                )}
              </For>
            </ul>
          </div>
        )}
      </For>
    </div>
  );

  // Render navigation help tab
  const renderNavigationTab = () => (
    <div class="space-y-4 max-h-[450px] overflow-y-auto pr-2">
      <For each={NAVIGATION_HELP}>
        {(area) => (
          <div>
            <h3
              class="text-sm font-semibold px-2 py-1.5 rounded mb-2 flex items-center gap-2"
              style={{
                color: "var(--text-base)",
                background: "var(--surface-base)",
              }}
            >
              <Icon name="location-arrow" size={14} style={{ color: "var(--accent)" }} />
              {area.area}
            </h3>
            <ul class="space-y-1 pl-4" role="list">
              <For each={area.instructions}>
                {(instruction) => (
                  <li
                    class="text-sm py-1 flex items-start gap-2"
                    style={{ color: "var(--text-weak)" }}
                  >
                    <span style={{ color: "var(--accent)" }}>→</span>
                    <span>{instruction}</span>
                  </li>
                )}
              </For>
            </ul>
          </div>
        )}
      </For>
    </div>
  );

  // Render settings tab
  const renderSettingsTab = () => (
    <div class="space-y-4 max-h-[450px] overflow-y-auto pr-2">
      {/* Screen Reader Mode */}
      <SettingToggle
        icon={<Icon name="desktop" size={16} />}
        title="Screen Reader Mode"
        description="Enhances ARIA attributes and enables automatic announcements"
        enabled={accessibility.screenReaderMode()}
        onToggle={accessibility.toggleScreenReaderMode}
      />

      {/* High Contrast */}
      <SettingToggle
        icon={<Icon name="eye" size={16} />}
        title="High Contrast Mode"
        description="Increases visual contrast for better visibility"
        enabled={accessibility.highContrastMode()}
        onToggle={accessibility.toggleHighContrast}
      />

      {/* Reduced Motion */}
      <SettingToggle
        icon={<Icon name="bolt" size={16} />}
        title="Reduced Motion"
        description="Minimizes animations and transitions"
        enabled={accessibility.reducedMotion()}
        onToggle={accessibility.toggleReducedMotion}
      />

      {/* Audio Signals */}
      <SettingToggle
        icon={<Icon name="volume-high" size={16} />}
        title="Audio Signals"
        description="Play sounds for errors, warnings, and completions"
        enabled={accessibility.audioSignalsEnabled()}
        onToggle={accessibility.toggleAudioSignals}
      />

      {/* Font Scale */}
      <div
        class="p-3 rounded-lg"
        style={{
          background: "var(--surface-base)",
          border: "1px solid var(--border-weak)",
        }}
      >
        <div class="flex items-center gap-3 mb-3">
          <Icon name="font" size={16} style={{ color: "var(--accent)" }} />
          <div>
            <div class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
              Font Size
            </div>
            <div class="text-xs" style={{ color: "var(--text-weak)" }}>
              Scale text throughout the application
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs" style={{ color: "var(--text-weak)" }}>
            80%
          </span>
          <input
            type="range"
            min="0.8"
            max="1.5"
            step="0.1"
            value={accessibility.fontScale()}
            onInput={(e) =>
              accessibility.setFontScale(parseFloat(e.currentTarget.value) as 0.8 | 0.9 | 1.0 | 1.1 | 1.2 | 1.3 | 1.4 | 1.5)
            }
            aria-label="Font size scale"
            class="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--accent) ${((accessibility.fontScale() - 0.8) / 0.7) * 100}%, var(--border-weak) ${((accessibility.fontScale() - 0.8) / 0.7) * 100}%)`,
            }}
          />
          <span class="text-xs" style={{ color: "var(--text-weak)" }}>
            150%
          </span>
          <span
            class="text-xs font-mono px-2 py-1 rounded"
            style={{
              background: "var(--background-base)",
              color: "var(--text-base)",
              "min-width": "48px",
              "text-align": "center",
            }}
          >
            {Math.round(accessibility.fontScale() * 100)}%
          </span>
        </div>
      </div>

      {/* Keyboard Hints */}
      <SettingToggle
        icon={<Icon name="command" size={16} />}
        title="Show Keyboard Hints"
        description="Display keyboard shortcut hints on UI elements"
        enabled={accessibility.keyboardHintsVisible()}
        onToggle={accessibility.toggleKeyboardHints}
      />

      {/* Reset Button */}
      <div class="pt-2">
        <button
          onClick={accessibility.resetToDefaults}
          class="w-full px-4 py-2 text-sm rounded-md transition-colors"
          style={{
            background: "var(--surface-raised)",
            color: "var(--text-base)",
            border: "1px solid var(--border-weak)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface-raised-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--surface-raised)";
          }}
        >
          Reset All Settings to Defaults
        </button>
      </div>
    </div>
  );

  return (
    <Show when={isOpen()}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 z-[100] flex items-center justify-center"
        onClick={closeDialog}
        role="presentation"
      >
        <div class="absolute inset-0 bg-black/50" />

        {/* Dialog */}
        <div
          ref={dialogRef}
          class="relative w-full max-w-2xl mx-4 rounded-lg shadow-2xl overflow-hidden"
          style={{ background: "var(--surface-raised)" }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleDialogKeydown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="accessibility-help-title"
        >
          {/* Header */}
          <div
            class="flex items-center justify-between px-4 py-3 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <div class="flex items-center gap-3">
              <Icon name="circle-question" size={20} style={{ color: "var(--accent)" }} />
              <h2
                id="accessibility-help-title"
                class="text-lg font-semibold"
                style={{ color: "var(--text-base)" }}
              >
                Accessibility Help
              </h2>
            </div>
            <div class="flex items-center gap-2">
              <kbd
                class="text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--background-base)",
                  color: "var(--text-weak)",
                }}
              >
                esc
              </kbd>
              <button
                ref={lastFocusableRef}
                onClick={closeDialog}
                class="p-1.5 rounded-md transition-colors"
                style={{ color: "var(--text-weak)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--surface-active)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
                aria-label="Close accessibility help"
              >
                <Icon name="xmark" size={18} />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div
            class="flex border-b px-4"
            style={{ "border-color": "var(--border-weak)" }}
            role="tablist"
            aria-label="Accessibility help sections"
          >
            <For each={HELP_SECTIONS}>
              {(section) => (
                <button
                  role="tab"
                  aria-selected={activeTab() === section.id}
                  aria-controls={`${section.id}-panel`}
                  id={`${section.id}-tab`}
                  class="flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors relative"
                  style={{
                    color:
                      activeTab() === section.id
                        ? "var(--accent)"
                        : "var(--text-weak)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onClick={() => setActiveTab(section.id as TabId)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") {
                      const currentIndex = HELP_SECTIONS.findIndex(
                        (s) => s.id === activeTab()
                      );
                      const nextIndex = (currentIndex + 1) % HELP_SECTIONS.length;
                      setActiveTab(HELP_SECTIONS[nextIndex].id as TabId);
                    } else if (e.key === "ArrowLeft") {
                      const currentIndex = HELP_SECTIONS.findIndex(
                        (s) => s.id === activeTab()
                      );
                      const prevIndex =
                        (currentIndex - 1 + HELP_SECTIONS.length) %
                        HELP_SECTIONS.length;
                      setActiveTab(HELP_SECTIONS[prevIndex].id as TabId);
                    }
                  }}
                >
                  {section.icon}
                  <span class="hidden sm:inline">{section.title}</span>
                  <Show when={activeTab() === section.id}>
                    <div
                      class="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ background: "var(--accent)" }}
                    />
                  </Show>
                </button>
              )}
            </For>
          </div>

          {/* Content */}
          <div
            class="p-4"
            style={{ background: "var(--surface-base)" }}
            role="tabpanel"
            id={`${activeTab()}-panel`}
            aria-labelledby={`${activeTab()}-tab`}
          >
            <Show when={activeTab() === "shortcuts"}>{renderShortcutsTab()}</Show>
            <Show when={activeTab() === "screenReader"}>
              {renderScreenReaderTab()}
            </Show>
            <Show when={activeTab() === "navigation"}>
              {renderNavigationTab()}
            </Show>
            <Show when={activeTab() === "settings"}>{renderSettingsTab()}</Show>
          </div>

          {/* Footer */}
          <div
            class="flex items-center justify-between px-4 py-3 border-t"
            style={{
              "border-color": "var(--border-weak)",
              background: "var(--surface-raised)",
            }}
          >
            <span class="text-xs" style={{ color: "var(--text-weak)" }}>
              Press{" "}
              <kbd
                class="px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--background-base)",
                  color: "var(--text-weak)",
                }}
              >
                F1
              </kbd>{" "}
              or{" "}
              <kbd
                class="px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--background-base)",
                  color: "var(--text-weak)",
                }}
              >
                Ctrl+Shift+?
              </kbd>{" "}
              to open this help
            </span>
            <a
              href="https://docs.cortex.ai/accessibility"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs underline transition-colors"
              style={{ color: "var(--accent)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--accent-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--accent)";
              }}
            >
              Learn more about accessibility
            </a>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

interface SettingToggleProps {
  icon: JSX.Element;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

function SettingToggle(props: SettingToggleProps) {
  return (
    <div
      class="flex items-center justify-between p-3 rounded-lg"
      style={{
        background: "var(--surface-base)",
        border: "1px solid var(--border-weak)",
      }}
    >
      <div class="flex items-center gap-3">
        <span style={{ color: "var(--accent)" }}>{props.icon}</span>
        <div>
          <div class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
            {props.title}
          </div>
          <div class="text-xs" style={{ color: "var(--text-weak)" }}>
            {props.description}
          </div>
        </div>
      </div>
      <button
        role="switch"
        aria-checked={props.enabled}
        aria-label={`${props.title}: ${props.enabled ? "enabled" : "disabled"}`}
        class="relative w-10 h-5 rounded-full transition-colors"
        style={{
          background: props.enabled ? "var(--accent)" : "var(--border-weak)",
        }}
        onClick={props.onToggle}
      >
        <span
          class="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
          style={{
            background: "white",
            transform: props.enabled ? "translateX(22px)" : "translateX(2px)",
          }}
        />
      </button>
    </div>
  );
}

// ============================================================================
// Export hook for programmatic control
// ============================================================================

/**
 * Hook to control the AccessibilityHelp dialog programmatically
 * Note: This requires the AccessibilityHelp component to be mounted
 */
export function useAccessibilityHelpDialog() {
  const open = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "F1" }));
  };

  const close = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  };

  return { open, close };
}
