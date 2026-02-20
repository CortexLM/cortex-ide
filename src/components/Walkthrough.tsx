/**
 * Walkthrough Component
 * Guided tutorials/walkthroughs for onboarding and learning features
 *
 * Features:
 * - Title and description
 * - List of steps with progress tracking
 * - Step completion checkmarks
 * - Overall progress bar
 * - Persistent completion state
 * - Built-in walkthroughs:
 *   - "Getting Started with Cortex"
 *   - "Learn the Keyboard Shortcuts"
 *   - "Set Up Your Theme"
 *   - "Connect to AI"
 */

import { Show, For, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { Icon } from "./ui/Icon";
import { WalkthroughStep, type WalkthroughStepData } from "./WalkthroughStep";
import { useCommands } from "@/context/CommandContext";

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if a string is an emoji (Extended Pictographic)
 */
const isEmoji = (str: string): boolean => /\p{Extended_Pictographic}/u.test(str);

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_PREFIX = "cortex_walkthrough_";
const STORAGE_KEY_COMPLETED_WALKTHROUGHS = "cortex_walkthroughs_completed";

// ============================================================================
// Types
// ============================================================================

export interface WalkthroughData {
  /** Unique walkthrough identifier */
  id: string;
  /** Walkthrough title */
  title: string;
  /** Walkthrough description */
  description: string;
  /** Icon name for Icon component or emoji string */
  icon: string;
  /** Estimated time to complete (in minutes) */
  estimatedMinutes?: number;
  /** Category for grouping */
  category?: "getting-started" | "features" | "customization" | "advanced";
  /** Steps in the walkthrough */
  steps: WalkthroughStepData[];
}

export interface WalkthroughProps {
  /** Walkthrough data to display */
  walkthrough: WalkthroughData;
  /** Callback when walkthrough is closed */
  onClose?: () => void;
  /** Callback when walkthrough is completed */
  onComplete?: (walkthroughId: string) => void;
  /** Callback when step completion changes */
  onStepComplete?: (walkthroughId: string, stepId: string, completed: boolean) => void;
}

export interface WalkthroughListProps {
  /** Walkthroughs to display */
  walkthroughs?: WalkthroughData[];
  /** Callback when a walkthrough is selected */
  onSelectWalkthrough?: (walkthrough: WalkthroughData) => void;
  /** Callback when walkthroughs panel is closed */
  onClose?: () => void;
}

interface WalkthroughCompletionState {
  completedSteps: string[];
  lastAccessedAt: number;
  completedAt?: number;
}

// ============================================================================
// Built-in Walkthroughs
// ============================================================================

export const BUILTIN_WALKTHROUGHS: WalkthroughData[] = [
  {
    id: "getting-started",
    title: "Getting Started with Cortex",
    description: "Learn the basics of Cortex Desktop and get productive quickly",
    icon: "book-open",
    estimatedMinutes: 5,
    category: "getting-started",
    steps: [
      {
        id: "gs-welcome",
        title: "Welcome to Cortex",
        description: `Cortex is an AI-native code editor designed to make you more productive.

Here's what makes Cortex special:
- **AI-Powered Assistance** - Get help writing, understanding, and refactoring code
- **Modern Interface** - Clean, fast, and customizable
- **Built for Developers** - Everything you need for professional development

Let's explore the key features together!`,
      },
      {
        id: "gs-open-folder",
        title: "Open a Project",
        description: `Start by opening a folder or project.

You can:
- Use **File → Open Folder** from the menu
- Press \`Ctrl+O\` (or \`Cmd+O\` on Mac)
- Drag and drop a folder onto the window
- Clone a Git repository

Opening a folder gives Cortex context about your project, enabling smarter AI suggestions.`,
        action: {
          type: "command",
          label: "Open Folder",
          value: "file.openFolder",
        },
      },
      {
        id: "gs-explorer",
        title: "Navigate with the File Explorer",
        description: `The sidebar on the left shows your project structure.

**Tips:**
- Click a file to open it
- Use \`Ctrl+B\` to toggle the sidebar
- Right-click for context menu options
- Use \`Ctrl+P\` to quickly find files by name

The file explorer keeps you oriented in your codebase.`,
        action: {
          type: "command",
          label: "Toggle Sidebar",
          value: "view.toggleSidebar",
        },
      },
      {
        id: "gs-command-palette",
        title: "Master the Command Palette",
        description: `The Command Palette is your gateway to every feature in Cortex.

Press \`Ctrl+Shift+P\` (or \`Cmd+Shift+P\` on Mac) to open it.

**What you can do:**
- Run any command by typing its name
- Access settings and preferences
- Switch between files and views
- Execute Git operations
- And much more!

It's the fastest way to do anything in Cortex.`,
        action: {
          type: "command",
          label: "Open Command Palette",
          value: "command.palette",
        },
      },
      {
        id: "gs-ai-chat",
        title: "Chat with AI",
        description: `Cortex includes a powerful AI assistant to help you code.

Press \`Ctrl+L\` (or \`Cmd+L\` on Mac) to open the AI chat panel.

**You can ask the AI to:**
- Explain code or concepts
- Write new functions or features
- Debug issues
- Refactor existing code
- Generate tests
- And much more!

The AI understands your current file and project context.`,
        action: {
          type: "command",
          label: "Open AI Chat",
          value: "chat.open",
        },
      },
      {
        id: "gs-complete",
        title: "You're Ready!",
        description: `🎉 **Congratulations!** You've learned the basics of Cortex.

**Next steps:**
- Explore the other walkthroughs to learn more features
- Check out keyboard shortcuts to work faster
- Customize your theme and settings
- Set up AI providers for smarter assistance

Happy coding with Cortex!`,
      },
    ],
  },
  {
    id: "keyboard-shortcuts",
    title: "Learn the Keyboard Shortcuts",
    description: "Master the keyboard shortcuts to boost your productivity",
    icon: "terminal",
    estimatedMinutes: 3,
    category: "features",
    steps: [
      {
        id: "ks-intro",
        title: "Why Keyboard Shortcuts?",
        description: `Keyboard shortcuts let you work faster by keeping your hands on the keyboard.

Cortex is designed with a keyboard-first workflow. Learning these shortcuts will significantly boost your productivity.

**Pro tip:** Many shortcuts can be customized in Settings → Keyboard Shortcuts.`,
      },
      {
        id: "ks-navigation",
        title: "Navigation Shortcuts",
        description: `**Essential navigation shortcuts:**

| Shortcut | Action |
|----------|--------|
| \`Ctrl+P\` | Quick file finder |
| \`Ctrl+G\` | Go to line |
| \`Ctrl+Shift+O\` | Go to symbol |
| \`Ctrl+Tab\` | Switch between open files |
| \`Ctrl+B\` | Toggle sidebar |
| \`Ctrl+J\` | Toggle terminal |

These shortcuts help you move around your project quickly.`,
      },
      {
        id: "ks-editing",
        title: "Editing Shortcuts",
        description: `**Essential editing shortcuts:**

| Shortcut | Action |
|----------|--------|
| \`Ctrl+D\` | Select next occurrence |
| \`Ctrl+Shift+L\` | Select all occurrences |
| \`Alt+Up/Down\` | Move line up/down |
| \`Alt+Shift+Up/Down\` | Duplicate line |
| \`Ctrl+/\` | Toggle comment |
| \`Ctrl+Shift+K\` | Delete line |
| \`Ctrl+Enter\` | Insert line below |

Master these to edit code like a pro!`,
      },
      {
        id: "ks-ai",
        title: "AI Shortcuts",
        description: `**AI-powered shortcuts:**

| Shortcut | Action |
|----------|--------|
| \`Ctrl+L\` | Open AI chat |
| \`Ctrl+K\` | Inline AI assist |
| \`Tab\` | Accept AI completion |
| \`Escape\` | Dismiss suggestion |
| \`Ctrl+Shift+Enter\` | Accept all suggestions |

These shortcuts give you instant access to AI assistance.`,
      },
      {
        id: "ks-customize",
        title: "Customize Your Shortcuts",
        description: `You can customize any keyboard shortcut to match your workflow.

**To customize:**
1. Open Settings (\`Ctrl+,\`)
2. Go to "Keyboard Shortcuts"
3. Search for a command
4. Click to change the binding

You can even create your own keybinding sequences!`,
        action: {
          type: "open-settings",
          label: "Open Keyboard Settings",
          value: "keybindings",
        },
      },
    ],
  },
  {
    id: "theme-setup",
    title: "Set Up Your Theme",
    description: "Customize Cortex's appearance to match your style",
    icon: "droplet",
    estimatedMinutes: 2,
    category: "customization",
    steps: [
      {
        id: "ts-intro",
        title: "Personalize Your Editor",
        description: `A comfortable visual environment helps you focus and code longer.

Cortex comes with multiple built-in themes and supports community themes too.

Let's set up your perfect coding environment!`,
      },
      {
        id: "ts-theme",
        title: "Choose a Theme",
        description: `Cortex includes several beautiful themes:

**Dark themes:**
- One Dark Pro (default)
- Dracula
- GitHub Dark
- Tokyo Night

**Light themes:**
- GitHub Light
- One Light

Open Settings → Appearance to browse and preview themes.`,
        action: {
          type: "open-settings",
          label: "Open Appearance Settings",
          value: "appearance",
        },
      },
      {
        id: "ts-font",
        title: "Configure Your Font",
        description: `Choose a font that's easy on your eyes.

**Popular coding fonts:**
- **JetBrains Mono** - Great ligatures, very readable
- **Fira Code** - Excellent ligatures
- **Source Code Pro** - Clean and professional
- **Cascadia Code** - Microsoft's modern font

You can change the font family and size in Settings → Editor.`,
        action: {
          type: "open-settings",
          label: "Open Editor Settings",
          value: "editor",
        },
      },
      {
        id: "ts-icons",
        title: "Icon Themes",
        description: `File icons help you quickly identify file types.

Cortex supports various icon themes that can be installed as extensions.

**Tip:** Icons appear in:
- File explorer
- Tab bar
- Breadcrumbs

Choose an icon theme that matches your overall theme for a cohesive look.`,
      },
    ],
  },
  {
    id: "connect-ai",
    title: "Connect to AI",
    description: "Set up AI providers for intelligent coding assistance",
    icon: "microchip",
    estimatedMinutes: 3,
    category: "getting-started",
    steps: [
      {
        id: "ai-intro",
        title: "AI-Powered Coding",
        description: `Cortex's AI features help you:

- **Generate code** from natural language
- **Explain** complex code
- **Refactor** for better quality
- **Debug** issues faster
- **Write tests** automatically

To unlock these features, you need to connect an AI provider.`,
      },
      {
        id: "ai-providers",
        title: "Choose a Provider",
        description: `Cortex supports multiple AI providers:

| Provider | Best For |
|----------|----------|
| **Anthropic (Claude)** | Advanced reasoning, code generation |
| **OpenAI (GPT-4)** | General purpose, function calling |
| **Google (Gemini)** | Multimodal, long context |
| **DeepSeek** | Cost-effective, strong coding |
| **Mistral** | Efficient, open-weight models |

Each provider has different strengths. You can configure multiple providers!`,
      },
      {
        id: "ai-setup",
        title: "Set Up Your Provider",
        description: `**To configure an AI provider:**

1. Open Settings (\`Ctrl+,\`)
2. Navigate to "Models" or "AI"
3. Select your provider
4. Enter your API key
5. Choose a model

**Getting API keys:**
- Anthropic: [console.anthropic.com](https://console.anthropic.com)
- OpenAI: [platform.openai.com](https://platform.openai.com)
- Google AI: [aistudio.google.com](https://aistudio.google.com)`,
        action: {
          type: "open-settings",
          label: "Open AI Settings",
          value: "models",
        },
      },
      {
        id: "ai-ready",
        title: "Start Using AI",
        description: `🚀 **You're all set!**

**Quick ways to use AI:**
- Press \`Ctrl+L\` to open chat
- Press \`Ctrl+K\` for inline assist
- Type \`/\` in chat for slash commands
- Select code and ask questions about it

The AI understands your codebase context and provides relevant suggestions.

Happy AI-assisted coding!`,
      },
    ],
  },
];

// ============================================================================
// Storage Utilities
// ============================================================================

function getCompletionState(walkthroughId: string): WalkthroughCompletionState {
  try {
    const key = `${STORAGE_KEY_PREFIX}${walkthroughId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("[Walkthrough] Failed to load completion state:", e);
  }
  return {
    completedSteps: [],
    lastAccessedAt: Date.now(),
  };
}

function saveCompletionState(walkthroughId: string, state: WalkthroughCompletionState): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${walkthroughId}`;
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.error("[Walkthrough] Failed to save completion state:", e);
  }
}

function getCompletedWalkthroughs(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_COMPLETED_WALKTHROUGHS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("[Walkthrough] Failed to load completed walkthroughs:", e);
  }
  return [];
}

function markWalkthroughCompleted(walkthroughId: string): void {
  try {
    const completed = getCompletedWalkthroughs();
    if (!completed.includes(walkthroughId)) {
      completed.push(walkthroughId);
      localStorage.setItem(STORAGE_KEY_COMPLETED_WALKTHROUGHS, JSON.stringify(completed));
    }
  } catch (e) {
    console.error("[Walkthrough] Failed to mark walkthrough completed:", e);
  }
}

/**
 * Check if a walkthrough is completed
 */
export function isWalkthroughCompleted(walkthroughId: string): boolean {
  return getCompletedWalkthroughs().includes(walkthroughId);
}

/**
 * Get completion progress for a walkthrough (0-100)
 */
export function getWalkthroughProgress(walkthroughId: string, totalSteps: number): number {
  const state = getCompletionState(walkthroughId);
  if (totalSteps === 0) return 0;
  return Math.round((state.completedSteps.length / totalSteps) * 100);
}

/**
 * Reset a walkthrough's progress
 */
export function resetWalkthroughProgress(walkthroughId: string): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${walkthroughId}`;
    localStorage.removeItem(key);
    
    const completed = getCompletedWalkthroughs().filter((id) => id !== walkthroughId);
    localStorage.setItem(STORAGE_KEY_COMPLETED_WALKTHROUGHS, JSON.stringify(completed));
  } catch (e) {
    console.error("[Walkthrough] Failed to reset walkthrough:", e);
  }
}

/**
 * Reset all walkthrough progress
 */
export function resetAllWalkthroughs(): void {
  try {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(STORAGE_KEY_PREFIX));
    keys.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(STORAGE_KEY_COMPLETED_WALKTHROUGHS);
  } catch (e) {
    console.error("[Walkthrough] Failed to reset all walkthroughs:", e);
  }
}

// ============================================================================
// Progress Bar Component
// ============================================================================

function ProgressBar(props: { progress: number; showLabel?: boolean }) {
  return (
    <div class="w-full">
      <Show when={props.showLabel}>
        <div class="flex items-center justify-between mb-1">
          <span
            class="text-xs font-medium"
            style={{ color: "var(--text-weak)" }}
          >
            Progress
          </span>
          <span
            class="text-xs font-medium"
            style={{ color: "var(--text-base)" }}
          >
            {props.progress}%
          </span>
        </div>
      </Show>
      <div
        class="h-2 rounded-full overflow-hidden"
        style={{ background: "var(--background-stronger)" }}
      >
        <div
          class="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${props.progress}%`,
            background: props.progress === 100
              ? "var(--success, var(--cortex-success))"
              : "var(--accent-primary)",
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Completion Celebration Component
// ============================================================================

function CompletionCelebration(props: { walkthroughTitle: string; onClose: () => void }) {
  return (
    <div class="text-center py-8 px-4">
      <div
        class="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
        style={{ background: "var(--success-bg, var(--cortex-success)15)" }}
      >
        <Icon
          name="award"
          class="w-10 h-10"
          style={{ color: "var(--success, var(--cortex-success))" }}
        />
      </div>
      <h3
        class="text-xl font-bold mb-2"
        style={{ color: "var(--text-base)" }}
      >
        Walkthrough Complete!
      </h3>
      <p
        class="text-sm mb-6"
        style={{ color: "var(--text-weak)" }}
      >
        You've finished "{props.walkthroughTitle}"
      </p>
      <button
        onClick={props.onClose}
        class="px-6 py-2 rounded-lg font-medium transition-all duration-150"
        style={{
          background: "var(--accent-primary)",
          color: "var(--text-on-accent)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.9";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
      >
        Continue
      </button>
    </div>
  );
}

// ============================================================================
// Main Walkthrough Component
// ============================================================================

export function Walkthrough(props: WalkthroughProps) {
  const [completionState, setCompletionState] = createSignal<WalkthroughCompletionState>(
    getCompletionState(props.walkthrough.id)
  );
  const [activeStepId, setActiveStepId] = createSignal<string | null>(null);
  const [showCelebration, setShowCelebration] = createSignal(false);

  const completedSteps = () => completionState().completedSteps;
  const progress = () => {
    const total = props.walkthrough.steps.length;
    if (total === 0) return 0;
    return Math.round((completedSteps().length / total) * 100);
  };
  const isFullyCompleted = () => completedSteps().length === props.walkthrough.steps.length;

  // Find first incomplete step on mount
  onMount(() => {
    const firstIncomplete = props.walkthrough.steps.find(
      (step) => !completedSteps().includes(step.id)
    );
    if (firstIncomplete) {
      setActiveStepId(firstIncomplete.id);
    } else if (props.walkthrough.steps.length > 0) {
      setActiveStepId(props.walkthrough.steps[0].id);
    }

    // Update last accessed time
    const state = { ...completionState(), lastAccessedAt: Date.now() };
    setCompletionState(state);
    saveCompletionState(props.walkthrough.id, state);
  });

  // Save state when it changes
  createEffect(() => {
    saveCompletionState(props.walkthrough.id, completionState());
  });

  // Check for completion
  createEffect(() => {
    if (isFullyCompleted() && !completionState().completedAt) {
      const state = { ...completionState(), completedAt: Date.now() };
      setCompletionState(state);
      markWalkthroughCompleted(props.walkthrough.id);
      setShowCelebration(true);
      props.onComplete?.(props.walkthrough.id);
    }
  });

  const handleToggleStepComplete = (stepId: string, completed: boolean) => {
    const current = completedSteps();
    let newCompleted: string[];

    if (completed && !current.includes(stepId)) {
      newCompleted = [...current, stepId];
      // Auto-advance to next incomplete step
      const stepIndex = props.walkthrough.steps.findIndex((s) => s.id === stepId);
      const nextIncomplete = props.walkthrough.steps.slice(stepIndex + 1).find(
        (s) => !newCompleted.includes(s.id)
      );
      if (nextIncomplete) {
        setActiveStepId(nextIncomplete.id);
      }
    } else if (!completed && current.includes(stepId)) {
      newCompleted = current.filter((id) => id !== stepId);
    } else {
      return;
    }

    setCompletionState({
      ...completionState(),
      completedSteps: newCompleted,
    });

    props.onStepComplete?.(props.walkthrough.id, stepId, completed);
  };

  const handleStepClick = (stepId: string) => {
    setActiveStepId(stepId);
  };

  const handleResetProgress = () => {
    resetWalkthroughProgress(props.walkthrough.id);
    setCompletionState({
      completedSteps: [],
      lastAccessedAt: Date.now(),
    });
    setShowCelebration(false);
    if (props.walkthrough.steps.length > 0) {
      setActiveStepId(props.walkthrough.steps[0].id);
    }
  };

  return (
    <div
      class="walkthrough h-full flex flex-col"
      style={{
        background: "var(--background-stronger)",
      }}
    >
      {/* Header */}
      <div
        class="flex-shrink-0 px-4 py-4 border-b"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div
              class="flex items-center justify-center rounded-lg"
              style={{
                width: "40px",
                height: "40px",
                background: "var(--accent-primary-bg, rgba(97, 175, 239, 0.1))",
              }}
            >
              <Show when={isEmoji(props.walkthrough.icon)} fallback={
                <Icon name={props.walkthrough.icon} class="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
              }>
                <span class="text-lg">{props.walkthrough.icon}</span>
              </Show>
            </div>
            <div>
              <h2
                class="font-semibold"
                style={{ color: "var(--text-base)" }}
              >
                {props.walkthrough.title}
              </h2>
              <p
                class="text-xs mt-0.5"
                style={{ color: "var(--text-weaker)" }}
              >
                {props.walkthrough.steps.length} steps
                {props.walkthrough.estimatedMinutes && (
                  <> · ~{props.walkthrough.estimatedMinutes} min</>
                )}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Show when={completedSteps().length > 0}>
              <button
                onClick={handleResetProgress}
                class="p-2 rounded-lg transition-colors"
                style={{ color: "var(--text-weaker)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--surface-raised)";
                  e.currentTarget.style.color = "var(--text-weak)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-weaker)";
                }}
                title="Reset progress"
              >
                <Icon name="rotate" class="w-4 h-4" />
              </button>
            </Show>
            <Show when={props.onClose}>
              <button
                onClick={props.onClose}
                class="p-2 rounded-lg transition-colors"
                style={{ color: "var(--text-weaker)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--surface-raised)";
                  e.currentTarget.style.color = "var(--text-weak)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-weaker)";
                }}
                title="Close"
              >
                <Icon name="xmark" class="w-4 h-4" />
              </button>
            </Show>
          </div>
        </div>

        {/* Progress Bar */}
        <div class="mt-4">
          <ProgressBar progress={progress()} showLabel />
        </div>
      </div>

      {/* Content */}
      <Show
        when={!showCelebration()}
        fallback={
          <CompletionCelebration
            walkthroughTitle={props.walkthrough.title}
            onClose={() => {
              setShowCelebration(false);
              props.onClose?.();
            }}
          />
        }
      >
        <div class="flex-1 overflow-y-auto px-4 py-4">
          <p
            class="text-sm mb-4"
            style={{ color: "var(--text-weak)" }}
          >
            {props.walkthrough.description}
          </p>

          {/* Steps */}
          <div class="space-y-3">
            <For each={props.walkthrough.steps}>
              {(step, index) => (
                <WalkthroughStep
                  step={step}
                  stepNumber={index() + 1}
                  totalSteps={props.walkthrough.steps.length}
                  isCompleted={completedSteps().includes(step.id)}
                  isActive={activeStepId() === step.id}
                  onToggleComplete={handleToggleStepComplete}
                  onClick={handleStepClick}
                />
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Walkthrough Card Component (for list view)
// ============================================================================

interface WalkthroughCardProps {
  walkthrough: WalkthroughData;
  onClick: () => void;
}

function WalkthroughCard(props: WalkthroughCardProps) {
  const progress = () => getWalkthroughProgress(props.walkthrough.id, props.walkthrough.steps.length);
  const isCompleted = () => isWalkthroughCompleted(props.walkthrough.id);

  // Check if icon is emoji (single character or emoji) vs icon name
  const isEmojiIcon = (str: string) => /^\p{Emoji}/u.test(str) && str.length <= 2;

  return (
    <button
      onClick={props.onClick}
      class="w-full text-left p-4 rounded-lg transition-all duration-150"
      style={{
        background: "var(--surface-base)",
        border: "1px solid var(--border-weak)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-base)";
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-weak)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div class="flex items-start gap-3">
        {/* Icon */}
        <div
          class="flex-shrink-0 flex items-center justify-center rounded-lg"
          style={{
            width: "40px",
            height: "40px",
            background: isCompleted()
              ? "var(--success-bg, var(--cortex-success)15)"
              : "var(--accent-primary-bg, rgba(97, 175, 239, 0.1))",
          }}
        >
          <Show when={isCompleted()} fallback={
            <Show when={isEmojiIcon(props.walkthrough.icon)} fallback={
              <Icon name={props.walkthrough.icon} class="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
            }>
              <span class="text-lg">{props.walkthrough.icon}</span>
            </Show>
          }>
            <Icon name="check" class="w-5 h-5" style={{ color: "var(--success, var(--cortex-success))" }} />
          </Show>
        </div>

        {/* Content */}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3
              class="font-medium text-sm"
              style={{ color: "var(--text-base)" }}
            >
              {props.walkthrough.title}
            </h3>
            <Show when={isCompleted()}>
              <span
                class="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: "var(--success-bg, var(--cortex-success)15)",
                  color: "var(--success, var(--cortex-success))",
                }}
              >
                Done
              </span>
            </Show>
          </div>
          <p
            class="text-xs mt-1 line-clamp-2"
            style={{ color: "var(--text-weak)" }}
          >
            {props.walkthrough.description}
          </p>
          <div class="flex items-center gap-3 mt-2">
            <span
              class="text-xs"
              style={{ color: "var(--text-weaker)" }}
            >
              {props.walkthrough.steps.length} steps
            </span>
            <Show when={props.walkthrough.estimatedMinutes}>
              <span
                class="text-xs"
                style={{ color: "var(--text-weaker)" }}
              >
                ~{props.walkthrough.estimatedMinutes} min
              </span>
            </Show>
            <Show when={progress() > 0 && progress() < 100}>
              <span
                class="text-xs"
                style={{ color: "var(--accent-primary)" }}
              >
                {progress()}% complete
              </span>
            </Show>
          </div>
        </div>

        {/* Arrow */}
        <Icon
          name="chevron-right"
          class="flex-shrink-0 w-5 h-5"
          style={{ color: "var(--text-weaker)" }}
        />
      </div>

      {/* Progress Bar */}
      <Show when={progress() > 0}>
        <div class="mt-3">
          <ProgressBar progress={progress()} />
        </div>
      </Show>
    </button>
  );
}

// ============================================================================
// Walkthrough List Component
// ============================================================================

export function WalkthroughList(props: WalkthroughListProps) {
  const walkthroughs = () => props.walkthroughs ?? BUILTIN_WALKTHROUGHS;
  const [selectedWalkthrough, setSelectedWalkthrough] = createSignal<WalkthroughData | null>(null);

  const handleSelectWalkthrough = (walkthrough: WalkthroughData) => {
    if (props.onSelectWalkthrough) {
      props.onSelectWalkthrough(walkthrough);
    } else {
      setSelectedWalkthrough(walkthrough);
    }
  };

  const handleCloseWalkthrough = () => {
    setSelectedWalkthrough(null);
  };

  return (
    <Show
      when={!selectedWalkthrough()}
      fallback={
        <Walkthrough
          walkthrough={selectedWalkthrough()!}
          onClose={handleCloseWalkthrough}
        />
      }
    >
      <div
        class="h-full flex flex-col"
        style={{ background: "var(--background-stronger)" }}
      >
        {/* Header */}
        <div
          class="flex-shrink-0 flex items-center justify-between px-4 py-4 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <div>
            <h2
              class="font-semibold"
              style={{ color: "var(--text-base)" }}
            >
              Walkthroughs
            </h2>
            <p
              class="text-xs mt-0.5"
              style={{ color: "var(--text-weaker)" }}
            >
              Learn Cortex with guided tutorials
            </p>
          </div>
          <Show when={props.onClose}>
            <button
              onClick={props.onClose}
              class="p-2 rounded-lg transition-colors"
              style={{ color: "var(--text-weaker)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-raised)";
                e.currentTarget.style.color = "var(--text-weak)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-weaker)";
              }}
              title="Close"
            >
              <Icon name="xmark" class="w-4 h-4" />
            </button>
          </Show>
        </div>

        {/* Walkthroughs List */}
        <div class="flex-1 overflow-y-auto px-4 py-4">
          <div class="space-y-3">
            <For each={walkthroughs()}>
              {(walkthrough) => (
                <WalkthroughCard
                  walkthrough={walkthrough}
                  onClick={() => handleSelectWalkthrough(walkthrough)}
                />
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Walkthrough Panel Component (with command integration)
// ============================================================================

export function WalkthroughPanel() {
  const { registerCommand, unregisterCommand } = useCommands();
  const [isVisible, setIsVisible] = createSignal(false);
  const [activeWalkthrough, setActiveWalkthrough] = createSignal<WalkthroughData | null>(null);

  onMount(() => {
    // Register commands
    registerCommand({
      id: "walkthrough.show",
      label: "Help: Show Walkthroughs",
      category: "Help",
      action: () => {
        setActiveWalkthrough(null);
        setIsVisible(true);
      },
    });

    registerCommand({
      id: "walkthrough.gettingStarted",
      label: "Help: Getting Started Walkthrough",
      category: "Help",
      action: () => {
        const walkthrough = BUILTIN_WALKTHROUGHS.find((w) => w.id === "getting-started");
        if (walkthrough) {
          setActiveWalkthrough(walkthrough);
          setIsVisible(true);
        }
      },
    });

    // Listen for show walkthroughs event
    const handleShowWalkthroughs = () => {
      setActiveWalkthrough(null);
      setIsVisible(true);
    };

    const handleShowWalkthrough = (e: CustomEvent<{ walkthroughId: string }>) => {
      if (!e.detail?.walkthroughId) return;
      const walkthrough = BUILTIN_WALKTHROUGHS.find((w) => w.id === e.detail.walkthroughId);
      if (walkthrough) {
        setActiveWalkthrough(walkthrough);
        setIsVisible(true);
      }
    };

    window.addEventListener("walkthroughs:show", handleShowWalkthroughs);
    window.addEventListener("walkthrough:show", handleShowWalkthrough as EventListener);

    onCleanup(() => {
      unregisterCommand("walkthrough.show");
      unregisterCommand("walkthrough.gettingStarted");
      window.removeEventListener("walkthroughs:show", handleShowWalkthroughs);
      window.removeEventListener("walkthrough:show", handleShowWalkthrough as EventListener);
    });
  });

  const handleClose = () => {
    setIsVisible(false);
    setActiveWalkthrough(null);
  };

  const handleSelectWalkthrough = (walkthrough: WalkthroughData) => {
    setActiveWalkthrough(walkthrough);
  };

  return (
    <Show when={isVisible()}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0, 0, 0, 0.5)", "backdrop-filter": "blur(2px)" }}
        onClick={handleClose}
      >
        <div
          class="w-full max-w-2xl max-h-[80vh] rounded-xl overflow-hidden shadow-2xl"
          style={{
            background: "var(--background-stronger)",
            border: "1px solid var(--border-weak)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Show
            when={activeWalkthrough()}
            fallback={
              <WalkthroughList
                onSelectWalkthrough={handleSelectWalkthrough}
                onClose={handleClose}
              />
            }
          >
            <Walkthrough
              walkthrough={activeWalkthrough()!}
              onClose={() => setActiveWalkthrough(null)}
            />
          </Show>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Helper Functions for External Use
// ============================================================================

/**
 * Programmatically show the walkthroughs panel
 */
export function showWalkthroughs(): void {
  window.dispatchEvent(new CustomEvent("walkthroughs:show"));
}

/**
 * Programmatically show a specific walkthrough
 */
export function showWalkthrough(walkthroughId: string): void {
  window.dispatchEvent(
    new CustomEvent("walkthrough:show", {
      detail: { walkthroughId },
    })
  );
}

/**
 * Get all built-in walkthroughs
 */
export function getBuiltinWalkthroughs(): WalkthroughData[] {
  return [...BUILTIN_WALKTHROUGHS];
}

/**
 * Get walkthrough by ID
 */
export function getWalkthroughById(id: string): WalkthroughData | undefined {
  return BUILTIN_WALKTHROUGHS.find((w) => w.id === id);
}



