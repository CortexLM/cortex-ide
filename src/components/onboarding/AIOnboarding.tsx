/**
 * AI Onboarding Component
 * A welcome wizard for AI features in Cortex Desktop
 * 
 * Features:
 * - First-run detection
 * - Provider selection
 * - API key setup with validation
 * - Feature tour
 * - Tips and best practices
 * - Skip option
 * - Completion state persistence
 */

import { 
  Show, 
  For, 
  createSignal, 
  onMount,
} from "solid-js";
import { Icon } from "../ui/Icon";
import { useLLM } from "@/context/LLMContext";
import type { LLMProviderType } from "@/utils/llm";

// ============================================================================
// Storage Keys and Constants
// ============================================================================

const STORAGE_KEY_ONBOARDING_COMPLETED = "cortex_ai_onboarding_completed";
const STORAGE_KEY_ONBOARDING_SKIPPED = "cortex_ai_onboarding_skipped";
const STORAGE_KEY_FIRST_RUN_DATE = "cortex_first_run_date";

// ============================================================================
// Types
// ============================================================================

type OnboardingStep = "welcome" | "provider" | "apiKey" | "features" | "tips" | "complete";

interface ProviderInfo {
  type: LLMProviderType;
  name: string;
  description: string;
  icon: string;
  features: string[];
  requiresApiKey: boolean;
  apiKeyUrl?: string;
  apiKeyPlaceholder?: string;
}

interface FeatureInfo {
  iconName: string;
  title: string;
  description: string;
  badge?: string;
}

interface TipInfo {
  iconName: string;
  title: string;
  description: string;
}

interface AIOnboardingProps {
  onComplete?: () => void;
  onSkip?: () => void;
  forceShow?: boolean;
}

// ============================================================================
// Provider Configurations
// ============================================================================

const PROVIDERS: ProviderInfo[] = [
  {
    type: "anthropic",
    name: "Anthropic",
    description: "Claude models with advanced reasoning and coding capabilities",
    icon: "🤖",
    features: ["Best-in-class code generation", "200K context window", "Artifact creation"],
    requiresApiKey: true,
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    apiKeyPlaceholder: "sk-ant-...",
  },
  {
    type: "openai",
    name: "OpenAI",
    description: "GPT-4 and GPT-3.5 models with broad capabilities",
    icon: "🧠",
    features: ["Function calling", "JSON mode", "Vision support"],
    requiresApiKey: true,
    apiKeyUrl: "https://platform.openai.com/api-keys",
    apiKeyPlaceholder: "sk-...",
  },
  {
    type: "google",
    name: "Google AI",
    description: "Gemini models optimized for multimodal tasks",
    icon: "🔷",
    features: ["Multimodal understanding", "Long context", "Fast inference"],
    requiresApiKey: true,
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    apiKeyPlaceholder: "AIza...",
  },
  {
    type: "mistral",
    name: "Mistral AI",
    description: "Efficient open-weight models from Mistral",
    icon: "💨",
    features: ["Open weights", "Fast inference", "Code-focused models"],
    requiresApiKey: true,
    apiKeyUrl: "https://console.mistral.ai/api-keys/",
    apiKeyPlaceholder: "...",
  },
  {
    type: "deepseek",
    name: "DeepSeek",
    description: "Cost-effective models with strong coding ability",
    icon: "🌊",
    features: ["Low cost", "Strong reasoning", "Code optimization"],
    requiresApiKey: true,
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    apiKeyPlaceholder: "sk-...",
  },
];

// ============================================================================
// Feature Configurations
// ============================================================================

const FEATURES: FeatureInfo[] = [
  {
    iconName: "message",
    title: "AI Chat Assistant",
    description: "Have natural conversations about your code. Ask questions, get explanations, and brainstorm solutions.",
    badge: "Core",
  },
  {
    iconName: "code",
    title: "Code Generation",
    description: "Generate code from natural language descriptions. Supports all major programming languages.",
    badge: "Core",
  },
  {
    iconName: "bolt",
    title: "Inline Completions",
    description: "Get AI-powered code suggestions as you type. Context-aware completions that understand your codebase.",
  },
  {
    iconName: "terminal",
    title: "Terminal Integration",
    description: "AI assistance for command generation, error diagnosis, and shell scripting.",
  },
  {
    iconName: "layer-group",
    title: "Multi-file Refactoring",
    description: "Perform complex refactoring operations across multiple files with AI guidance.",
  },
  {
    iconName: "book-open",
    title: "Documentation Generation",
    description: "Automatically generate documentation, comments, and README files for your code.",
  },
];

// ============================================================================
// Tips Configuration
// ============================================================================

const TIPS: TipInfo[] = [
  {
    iconName: "star",
    title: "Be Specific in Your Prompts",
    description: "The more context you provide, the better results you'll get. Include file paths, error messages, and expected behavior.",
  },
  {
    iconName: "message",
    title: "Use Chat History",
    description: "Build on previous conversations. The AI remembers context from earlier messages in the same session.",
  },
  {
    iconName: "code",
    title: "Review Generated Code",
    description: "Always review AI-generated code before accepting. Check for edge cases, security implications, and code style.",
  },
  {
    iconName: "key",
    title: "Manage Your API Keys",
    description: "You can add multiple providers and switch between them. Configure keys in Settings → Models.",
  },
  {
    iconName: "microchip",
    title: "Choose the Right Model",
    description: "Different models have different strengths. Use larger models for complex tasks and smaller ones for quick questions.",
  },
  {
    iconName: "bolt",
    title: "Use Keyboard Shortcuts",
    description: "Press Cmd/Ctrl+L to open chat, Cmd/Ctrl+K for inline assist, and Tab to accept completions.",
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if this is the first run of the application
 */
export function isFirstRun(): boolean {
  try {
    const completed = localStorage.getItem(STORAGE_KEY_ONBOARDING_COMPLETED);
    const skipped = localStorage.getItem(STORAGE_KEY_ONBOARDING_SKIPPED);
    return !completed && !skipped;
  } catch {
    return true;
  }
}

/**
 * Check if onboarding was completed
 */
export function isOnboardingCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_ONBOARDING_COMPLETED) === "true";
  } catch {
    return false;
  }
}

/**
 * Check if onboarding was skipped
 */
export function isOnboardingSkipped(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_ONBOARDING_SKIPPED) === "true";
  } catch {
    return false;
  }
}

/**
 * Mark onboarding as completed
 */
export function markOnboardingComplete(): void {
  try {
    localStorage.setItem(STORAGE_KEY_ONBOARDING_COMPLETED, "true");
    localStorage.setItem(STORAGE_KEY_FIRST_RUN_DATE, new Date().toISOString());
  } catch (e) {
    console.error("[Onboarding] Failed to save completion state:", e);
  }
}

/**
 * Mark onboarding as skipped
 */
export function markOnboardingSkipped(): void {
  try {
    localStorage.setItem(STORAGE_KEY_ONBOARDING_SKIPPED, "true");
    localStorage.setItem(STORAGE_KEY_FIRST_RUN_DATE, new Date().toISOString());
  } catch (e) {
    console.error("[Onboarding] Failed to save skip state:", e);
  }
}

/**
 * Reset onboarding state (for testing or re-running)
 */
export function resetOnboardingState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_ONBOARDING_COMPLETED);
    localStorage.removeItem(STORAGE_KEY_ONBOARDING_SKIPPED);
  } catch (e) {
    console.error("[Onboarding] Failed to reset state:", e);
  }
}

// ============================================================================
// Step Indicator Component
// ============================================================================

function StepIndicator(props: { 
  steps: OnboardingStep[]; 
  currentStep: OnboardingStep;
}) {
  const currentIndex = () => props.steps.indexOf(props.currentStep);

  return (
    <div class="flex items-center justify-center gap-2 mb-6">
      <For each={props.steps}>
        {(_step, index) => (
          <div class="flex items-center">
            <div
              class={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                index() < currentIndex()
                  ? "bg-primary text-white"
                  : index() === currentIndex()
                  ? "bg-primary/20 text-primary border-2 border-primary"
                  : "bg-background-tertiary text-foreground-muted"
              }`}
            >
              <Show 
                when={index() < currentIndex()} 
                fallback={index() + 1}
              >
                <Icon name="check" class="w-4 h-4" />
              </Show>
            </div>
            <Show when={index() < props.steps.length - 1}>
              <div 
                class={`w-8 h-0.5 mx-1 ${
                  index() < currentIndex() ? "bg-primary" : "bg-background-tertiary"
                }`} 
              />
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}

// ============================================================================
// Welcome Step Component
// ============================================================================

function WelcomeStep(props: { onNext: () => void; onSkip: () => void }) {
  return (
    <div class="text-center">
      <div class="mb-6">
        <div class="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Icon name="bolt" class="w-10 h-10 text-primary" />
        </div>
        <h2 class="text-2xl font-bold mb-2">Welcome to Cortex AI</h2>
        <p class="text-foreground-muted max-w-md mx-auto">
          Cortex Desktop comes with powerful AI capabilities to help you write, understand, and refactor code faster.
        </p>
      </div>

      <div class="grid grid-cols-3 gap-4 mb-8">
        <div class="p-4 rounded-lg bg-background-tertiary/50">
          <Icon name="message" class="w-6 h-6 text-primary mx-auto mb-2" />
          <p class="text-sm font-medium">Chat with AI</p>
        </div>
        <div class="p-4 rounded-lg bg-background-tertiary/50">
          <Icon name="code" class="w-6 h-6 text-primary mx-auto mb-2" />
          <p class="text-sm font-medium">Generate Code</p>
        </div>
        <div class="p-4 rounded-lg bg-background-tertiary/50">
          <Icon name="bolt" class="w-6 h-6 text-primary mx-auto mb-2" />
          <p class="text-sm font-medium">Smart Completions</p>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <button
          onClick={props.onNext}
          class="w-full py-3 px-6 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          Get Started
          <Icon name="arrow-right" class="w-4 h-4" />
        </button>
        <button
          onClick={props.onSkip}
          class="text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Provider Selection Step Component
// ============================================================================

function ProviderSelectionStep(props: { 
  selectedProvider: LLMProviderType | null;
  onSelectProvider: (type: LLMProviderType) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div class="text-center mb-6">
        <h2 class="text-xl font-bold mb-2">Choose Your AI Provider</h2>
        <p class="text-foreground-muted text-sm">
          Select a provider to power your AI features. You can add more providers later.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3 mb-6 max-h-[320px] overflow-y-auto pr-1">
        <For each={PROVIDERS}>
          {(provider) => (
            <button
              onClick={() => props.onSelectProvider(provider.type)}
              class={`p-4 rounded-lg border text-left transition-all ${
                props.selectedProvider === provider.type
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-border-active hover:bg-background-tertiary/50"
              }`}
            >
              <div class="flex items-start gap-3">
                <span class="text-2xl">{provider.icon}</span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="font-medium text-sm">{provider.name}</p>
                    <Show when={!provider.requiresApiKey}>
                      <span class="text-[10px] rounded-full bg-green-500/20 px-2 py-0.5 text-green-400">Local</span>
                    </Show>
                  </div>
                  <p class="text-xs text-foreground-muted mt-1 line-clamp-2">{provider.description}</p>
                  <div class="flex flex-wrap gap-1 mt-2">
                    <For each={provider.features.slice(0, 2)}>
                      {(feature) => (
                        <span class="text-[10px] rounded bg-background-tertiary px-1.5 py-0.5 text-foreground-muted">
                          {feature}
                        </span>
                      )}
                    </For>
                  </div>
                </div>
              </div>
              <Show when={props.selectedProvider === provider.type}>
                <div class="flex justify-end mt-2">
                  <Icon name="circle-check" class="w-5 h-5 text-primary" />
                </div>
              </Show>
            </button>
          )}
        </For>
      </div>

      <div class="flex gap-3">
        <button
          onClick={props.onBack}
          class="flex-1 py-2.5 px-4 rounded-lg border border-border hover:bg-background-tertiary transition-colors flex items-center justify-center gap-2"
        >
          <Icon name="arrow-left" class="w-4 h-4" />
          Back
        </button>
        <button
          onClick={props.onNext}
          disabled={!props.selectedProvider}
          class="flex-1 py-2.5 px-4 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Continue
          <Icon name="arrow-right" class="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// API Key Setup Step Component
// ============================================================================

function ApiKeySetupStep(props: {
  provider: ProviderInfo;
  onNext: () => void;
  onBack: () => void;
  onSkipApiKey: () => void;
}) {
  const llm = useLLM();
  const [apiKey, setApiKey] = createSignal("");
  const [showApiKey, setShowApiKey] = createSignal(false);
  const [isValidating, setIsValidating] = createSignal(false);
  const [validationResult, setValidationResult] = createSignal<"success" | "error" | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  const isConfigured = () => {
    const statuses = llm.getProviderStatuses();
    const status = statuses.find(s => s.type === props.provider.type);
    return status?.isConfigured || false;
  };

  const handleValidateAndSave = async () => {
    if (!apiKey()) return;
    
    setIsValidating(true);
    setValidationResult(null);
    setErrorMessage(null);

    try {
      // Save the API key
      llm.setApiKey(props.provider.type, apiKey());
      
      // Validate the API key
      await llm.refreshProviderStatus(props.provider.type);
      
      // Check if validation was successful
      const statuses = llm.getProviderStatuses();
      const status = statuses.find(s => s.type === props.provider.type);
      
      if (status?.isConnected) {
        setValidationResult("success");
        setApiKey("");
        // Auto-advance after successful validation
        setTimeout(() => props.onNext(), 1500);
      } else {
        setValidationResult("error");
        setErrorMessage(status?.lastError || "API key validation failed");
      }
    } catch (e) {
      setValidationResult("error");
      setErrorMessage(e instanceof Error ? e.message : "Unknown error occurred");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div>
      <div class="text-center mb-6">
        <span class="text-4xl mb-3 block">{props.provider.icon}</span>
        <h2 class="text-xl font-bold mb-2">Set Up {props.provider.name}</h2>
        <p class="text-foreground-muted text-sm">
          Enter your API key to enable AI features
        </p>
      </div>

      <Show when={isConfigured()}>
        <div class="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
          <div class="flex items-center gap-2 text-green-400">
            <Icon name="circle-check" class="w-5 h-5" />
            <span class="font-medium">API key already configured</span>
          </div>
          <p class="text-xs text-foreground-muted mt-1">
            You can continue with your existing configuration or enter a new key.
          </p>
        </div>
      </Show>

      <div class="space-y-4 mb-6">
        <div>
          <label class="block text-sm font-medium mb-2">API Key</label>
          <div class="relative">
            <input
              type={showApiKey() ? "text" : "password"}
              value={apiKey()}
              onInput={(e) => setApiKey(e.currentTarget.value)}
              placeholder={props.provider.apiKeyPlaceholder || "Enter your API key"}
              class="w-full rounded-lg border border-border bg-background px-4 py-3 pr-20 text-sm"
            />
            <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                onClick={() => setShowApiKey(!showApiKey())}
                class="p-2 text-foreground-muted hover:text-foreground"
              >
                <Show when={showApiKey()} fallback={<Icon name="eye-slash" class="w-4 h-4" />}>
                  <Icon name="eye" class="w-4 h-4" />
                </Show>
              </button>
            </div>
          </div>
        </div>

        <Show when={props.provider.apiKeyUrl}>
          <a
            href={props.provider.apiKeyUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
          >
            Get an API key from {props.provider.name}
            <Icon name="arrow-up-right-from-square" class="w-3 h-3" />
          </a>
        </Show>

        <Show when={validationResult() === "success"}>
          <div class="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <div class="flex items-center gap-2 text-green-400">
              <Icon name="circle-check" class="w-5 h-5" />
              <span>API key validated successfully!</span>
            </div>
          </div>
        </Show>

        <Show when={validationResult() === "error"}>
          <div class="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <div class="flex items-center gap-2 text-red-400">
              <Icon name="circle-exclamation" class="w-5 h-5" />
              <span>{errorMessage() || "API key validation failed"}</span>
            </div>
          </div>
        </Show>
      </div>

      <div class="space-y-3">
        <button
          onClick={handleValidateAndSave}
          disabled={!apiKey() || isValidating()}
          class="w-full py-3 px-4 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Show when={isValidating()} fallback={
            <>
              <Icon name="key" class="w-4 h-4" />
              Save & Validate
            </>
          }>
            <Icon name="rotate" class="w-4 h-4 animate-spin" />
            Validating...
          </Show>
        </button>

        <div class="flex gap-3">
          <button
            onClick={props.onBack}
            class="flex-1 py-2.5 px-4 rounded-lg border border-border hover:bg-background-tertiary transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="arrow-left" class="w-4 h-4" />
            Back
          </button>
          <button
            onClick={props.onSkipApiKey}
            class="flex-1 py-2.5 px-4 rounded-lg border border-border hover:bg-background-tertiary transition-colors"
          >
            <Show when={isConfigured()} fallback="Skip for now">
              Continue
            </Show>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Features Tour Step Component
// ============================================================================

function FeaturesStep(props: { onNext: () => void; onBack: () => void }) {
  return (
    <div>
      <div class="text-center mb-6">
        <h2 class="text-xl font-bold mb-2">AI Features Overview</h2>
        <p class="text-foreground-muted text-sm">
          Discover what you can do with Cortex AI
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3 mb-6 max-h-[300px] overflow-y-auto pr-1">
        <For each={FEATURES}>
          {(feature) => (
            <div class="p-4 rounded-lg bg-background-tertiary/50 border border-border">
              <div class="flex items-start gap-3">
                <div class="p-2 rounded-lg bg-primary/10">
                  <Icon name={feature.iconName} class="w-5 h-5 text-primary" />
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <p class="font-medium text-sm">{feature.title}</p>
                    <Show when={feature.badge}>
                      <span class="text-[9px] rounded-full bg-primary/20 px-1.5 py-0.5 text-primary">{feature.badge}</span>
                    </Show>
                  </div>
                  <p class="text-xs text-foreground-muted mt-1">{feature.description}</p>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      <div class="flex gap-3">
        <button
          onClick={props.onBack}
          class="flex-1 py-2.5 px-4 rounded-lg border border-border hover:bg-background-tertiary transition-colors flex items-center justify-center gap-2"
        >
          <Icon name="arrow-left" class="w-4 h-4" />
          Back
        </button>
        <button
          onClick={props.onNext}
          class="flex-1 py-2.5 px-4 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          Continue
          <Icon name="arrow-right" class="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Tips Step Component
// ============================================================================

function TipsStep(props: { onNext: () => void; onBack: () => void }) {
  return (
    <div>
      <div class="text-center mb-6">
        <h2 class="text-xl font-bold mb-2">Tips & Best Practices</h2>
        <p class="text-foreground-muted text-sm">
          Get the most out of your AI assistant
        </p>
      </div>

      <div class="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-1">
        <For each={TIPS}>
          {(tip) => (
            <div class="p-4 rounded-lg bg-background-tertiary/50 border border-border">
              <div class="flex items-start gap-3">
                <div class="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                  <Icon name={tip.iconName} class="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p class="font-medium text-sm">{tip.title}</p>
                  <p class="text-xs text-foreground-muted mt-1">{tip.description}</p>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      <div class="flex gap-3">
        <button
          onClick={props.onBack}
          class="flex-1 py-2.5 px-4 rounded-lg border border-border hover:bg-background-tertiary transition-colors flex items-center justify-center gap-2"
        >
          <Icon name="arrow-left" class="w-4 h-4" />
          Back
        </button>
        <button
          onClick={props.onNext}
          class="flex-1 py-2.5 px-4 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          Finish Setup
          <Icon name="arrow-right" class="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Complete Step Component
// ============================================================================

function CompleteStep(props: { providerName: string; onFinish: () => void }) {
  return (
    <div class="text-center">
      <div class="mb-6">
        <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
          <Icon name="circle-check" class="w-10 h-10 text-green-500" />
        </div>
        <h2 class="text-2xl font-bold mb-2">You're All Set!</h2>
        <p class="text-foreground-muted max-w-md mx-auto">
          Cortex AI is ready to use with {props.providerName}. Start coding smarter with AI assistance.
        </p>
      </div>

      <div class="p-4 rounded-lg bg-background-tertiary/50 border border-border mb-6">
        <h3 class="font-medium mb-3">Quick Start</h3>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="flex items-center gap-2">
            <kbd class="px-2 py-1 rounded bg-background text-xs border border-border">Cmd+L</kbd>
            <span class="text-foreground-muted">Open Chat</span>
          </div>
          <div class="flex items-center gap-2">
            <kbd class="px-2 py-1 rounded bg-background text-xs border border-border">Cmd+K</kbd>
            <span class="text-foreground-muted">Inline Assist</span>
          </div>
          <div class="flex items-center gap-2">
            <kbd class="px-2 py-1 rounded bg-background text-xs border border-border">Tab</kbd>
            <span class="text-foreground-muted">Accept Completion</span>
          </div>
          <div class="flex items-center gap-2">
            <kbd class="px-2 py-1 rounded bg-background text-xs border border-border">Cmd+,</kbd>
            <span class="text-foreground-muted">Settings</span>
          </div>
        </div>
      </div>

      <button
        onClick={props.onFinish}
        class="w-full py-3 px-6 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
      >
        Start Using Cortex AI
        <Icon name="bolt" class="w-4 h-4" />
      </button>
    </div>
  );
}

// ============================================================================
// Main AIOnboarding Component
// ============================================================================

export function AIOnboarding(props: AIOnboardingProps) {
  const llm = useLLM();
  const [isVisible, setIsVisible] = createSignal(false);
  const [currentStep, setCurrentStep] = createSignal<OnboardingStep>("welcome");
  const [selectedProvider, setSelectedProvider] = createSignal<LLMProviderType | null>(null);

  // Determine which steps to show based on provider selection
  const steps = (): OnboardingStep[] => {
    const provider = selectedProvider();
    if (provider) {
      const providerInfo = PROVIDERS.find(p => p.type === provider);
      if (providerInfo?.requiresApiKey) {
        return ["welcome", "provider", "apiKey", "features", "tips", "complete"];
      }
    }
    return ["welcome", "provider", "apiKey", "features", "tips", "complete"];
  };

  // Get current provider info
  const currentProviderInfo = (): ProviderInfo | undefined => {
    const type = selectedProvider();
    return type ? PROVIDERS.find(p => p.type === type) : undefined;
  };

  // Check visibility on mount
  onMount(() => {
    if (props.forceShow) {
      setIsVisible(true);
    } else if (isFirstRun()) {
      setIsVisible(true);
    }
  });

  // Navigation handlers
  const goToStep = (step: OnboardingStep) => {
    setCurrentStep(step);
  };

  const goNext = () => {
    const currentSteps = steps();
    const currentIndex = currentSteps.indexOf(currentStep());
    if (currentIndex < currentSteps.length - 1) {
      setCurrentStep(currentSteps[currentIndex + 1]);
    }
  };

  const goBack = () => {
    const currentSteps = steps();
    const currentIndex = currentSteps.indexOf(currentStep());
    if (currentIndex > 0) {
      setCurrentStep(currentSteps[currentIndex - 1]);
    }
  };

  // Skip handler
  const handleSkip = () => {
    markOnboardingSkipped();
    setIsVisible(false);
    props.onSkip?.();
  };

  // Complete handler
  const handleComplete = () => {
    markOnboardingComplete();
    
    // Set the selected provider as active if one was chosen
    const provider = selectedProvider();
    if (provider) {
      llm.setActiveProvider(provider);
    }
    
    setIsVisible(false);
    props.onComplete?.();
  };

  // Handle provider selection
  const handleSelectProvider = (type: LLMProviderType) => {
    setSelectedProvider(type);
  };

  // Handle skipping API key setup
  const handleSkipApiKey = () => {
    goToStep("features");
  };

  // Close handler
  const handleClose = () => {
    handleSkip();
  };

  return (
    <Show when={isVisible()}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      >
        <div
          class="relative mx-4 w-full max-w-xl rounded-2xl border border-border bg-background-secondary shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="flex items-center justify-between px-6 py-4 border-b border-border">
            <div class="flex items-center gap-2">
              <Icon name="bolt" class="w-5 h-5 text-primary" />
              <span class="font-semibold">AI Setup</span>
            </div>
            <button
              onClick={handleClose}
              class="p-2 rounded-lg hover:bg-background-tertiary transition-colors"
              aria-label="Close"
            >
              <Icon name="xmark" class="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div class="p-6">
            {/* Step Indicator */}
            <Show when={currentStep() !== "welcome" && currentStep() !== "complete"}>
              <StepIndicator steps={steps()} currentStep={currentStep()} />
            </Show>

            {/* Step Content */}
            <Show when={currentStep() === "welcome"}>
              <WelcomeStep onNext={() => goToStep("provider")} onSkip={handleSkip} />
            </Show>

            <Show when={currentStep() === "provider"}>
              <ProviderSelectionStep
                selectedProvider={selectedProvider()}
                onSelectProvider={handleSelectProvider}
                onNext={goNext}
                onBack={goBack}
              />
            </Show>

            <Show when={currentStep() === "apiKey"}>
              <Show when={currentProviderInfo()}>
                {(provider) => (
                  <ApiKeySetupStep
                    provider={provider()}
                    onNext={() => goToStep("features")}
                    onBack={goBack}
                    onSkipApiKey={handleSkipApiKey}
                  />
                )}
              </Show>
            </Show>

            <Show when={currentStep() === "features"}>
              <FeaturesStep onNext={goNext} onBack={goBack} />
            </Show>

            <Show when={currentStep() === "tips"}>
              <TipsStep onNext={() => goToStep("complete")} onBack={goBack} />
            </Show>

            <Show when={currentStep() === "complete"}>
              <CompleteStep
                providerName={currentProviderInfo()?.name || "your chosen provider"}
                onFinish={handleComplete}
              />
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Exports
// ============================================================================

export type { AIOnboardingProps, OnboardingStep, ProviderInfo, FeatureInfo, TipInfo };
