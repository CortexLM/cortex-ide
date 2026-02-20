import { Show, createMemo, createEffect } from "solid-js";
import { Icon } from "./ui/Icon";
import { useSpeech, type SpeechLanguage } from "@/context/SpeechContext";

/**
 * Props for VoiceInput component
 */
export interface VoiceInputProps {
  /** Called when user submits transcript to chat */
  onSendToChat?: (transcript: string) => void;
  /** Called when user sends transcript to editor */
  onSendToEditor?: (transcript: string) => void;
  /** Placeholder text when no transcript */
  placeholder?: string;
  /** Whether to show the send to editor button */
  showEditorButton?: boolean;
  /** Whether to show the language selector */
  showLanguageSelector?: boolean;
  /** Custom class name for the container */
  class?: string;
  /** Compact mode - just the microphone button */
  compact?: boolean;
}

/**
 * VoiceInput component for speech-to-text input
 * 
 * Features:
 * - Microphone toggle button with visual feedback
 * - Pulsing animation when listening
 * - Live transcript display
 * - Audio level indicator
 * - Send to chat or editor
 * - Language selection
 * - Keyboard shortcut (Ctrl+Alt+V) handled by SpeechContext
 */
export function VoiceInput(props: VoiceInputProps) {
  const { state, stopListening, toggleListening, clearTranscript, setLanguage, getAvailableLanguages } = useSpeech();

  let languageSelectRef: HTMLSelectElement | undefined;

  // Compute button style based on state
  const buttonStyle = createMemo(() => {
    if (!state.isSupported) {
      return {
        background: "var(--surface-disabled)",
        color: "var(--text-disabled)",
        cursor: "not-allowed",
      };
    }

    if (state.isListening) {
      return {
        background: "rgba(239, 68, 68, 0.15)",
        color: "var(--cortex-error)",
        cursor: "pointer",
      };
    }

    if (state.isStarting) {
      return {
        background: "rgba(234, 179, 8, 0.15)",
        color: "var(--cortex-warning)",
        cursor: "wait",
      };
    }

    return {
      background: "var(--surface-raised)",
      color: "var(--text-base)",
      cursor: "pointer",
    };
  });

  // Compute whether we have content to send
  const hasTranscript = createMemo(() => state.transcript.trim().length > 0);

  // Handle sending transcript to chat
  const handleSendToChat = () => {
    if (hasTranscript() && props.onSendToChat) {
      props.onSendToChat(state.transcript.trim());
      clearTranscript();
      if (state.isListening) {
        stopListening();
      }
    }
  };

  // Handle sending transcript to editor
  const handleSendToEditor = () => {
    if (hasTranscript() && props.onSendToEditor) {
      props.onSendToEditor(state.transcript.trim());
      clearTranscript();
      if (state.isListening) {
        stopListening();
      }
    }
  };

  // Handle language change
  const handleLanguageChange = (e: Event) => {
    const select = e.target as HTMLSelectElement;
    setLanguage(select.value as SpeechLanguage);
  };

  // Handle clear/cancel
  const handleClear = () => {
    clearTranscript();
    if (state.isListening) {
      stopListening();
    }
  };

  // Compute audio level bar width (percentage)
  const audioLevelWidth = createMemo(() => {
    return Math.max(2, state.audioLevel * 100);
  });

  // Pulse animation class
  const pulseAnimation = createMemo(() => {
    if (state.isListening) {
      return "voice-input-pulse";
    }
    return "";
  });

  // Compact mode - just the microphone button
  if (props.compact) {
    return (
      <button
        onClick={toggleListening}
        disabled={!state.isSupported}
        class={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 ${pulseAnimation()} ${props.class || ""}`}
        style={{
          ...buttonStyle(),
          "--tw-ring-color": state.isListening ? "var(--cortex-error)" : "var(--text-weak)",
        }}
        title={
          !state.isSupported
            ? "Speech recognition not supported"
            : state.isListening
              ? "Stop listening (Ctrl+Alt+V)"
              : "Start voice input (Ctrl+Alt+V)"
        }
      >
        <Show when={state.isListening} fallback={<Icon name="microphone" class="w-4 h-4" />}>
          <Icon name="microphone-slash" class="w-4 h-4" />
        </Show>
        
        {/* Audio level indicator ring */}
        <Show when={state.isListening && state.audioLevel > 0.05}>
          <div
            class="absolute inset-0 rounded-lg border-2 pointer-events-none"
            style={{
              "border-color": `rgba(239, 68, 68, ${0.3 + state.audioLevel * 0.7})`,
              transform: `scale(${1 + state.audioLevel * 0.2})`,
              transition: "transform 50ms ease-out, border-color 50ms ease-out",
            }}
          />
        </Show>
        
        {/* Inject pulse animation styles */}
        <style>{`
          @keyframes voice-input-pulse-animation {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
            }
            50% {
              box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
            }
          }
          .voice-input-pulse {
            animation: voice-input-pulse-animation 1.5s ease-in-out infinite;
          }
        `}</style>
      </button>
    );
  }

  // Full mode with transcript display
  return (
    <div
      class={`rounded-lg border overflow-hidden transition-all duration-200 ${props.class || ""}`}
      style={{
        background: "var(--surface-base)",
        "border-color": state.isListening ? "var(--cortex-error)" : state.error ? "var(--cortex-warning)" : "var(--border-base)",
        "box-shadow": state.isListening ? "0 0 0 2px rgba(239, 68, 68, 0.2)" : "none",
      }}
    >
      {/* Header with controls */}
      <div
        class="flex items-center gap-2 px-3 py-2 border-b"
        style={{
          background: "var(--surface-raised)",
          "border-color": "var(--border-weak)",
        }}
      >
        {/* Microphone toggle button */}
        <button
          onClick={toggleListening}
          disabled={!state.isSupported}
          class={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 ${pulseAnimation()}`}
          style={{
            ...buttonStyle(),
            "--tw-ring-color": state.isListening ? "var(--cortex-error)" : "var(--text-weak)",
          }}
          title={
            !state.isSupported
              ? "Speech recognition not supported"
              : state.isListening
                ? "Stop listening (Ctrl+Alt+V)"
                : "Start voice input (Ctrl+Alt+V)"
          }
        >
          <Show when={state.isListening} fallback={<Icon name="microphone" class="w-5 h-5" />}>
            <Icon name="microphone-slash" class="w-5 h-5" />
          </Show>
          
          {/* Audio level indicator ring */}
          <Show when={state.isListening && state.audioLevel > 0.05}>
            <div
              class="absolute inset-0 rounded-lg border-2 pointer-events-none"
              style={{
                "border-color": `rgba(239, 68, 68, ${0.3 + state.audioLevel * 0.7})`,
                transform: `scale(${1 + state.audioLevel * 0.15})`,
                transition: "transform 50ms ease-out, border-color 50ms ease-out",
              }}
            />
          </Show>
        </button>

        {/* Status text */}
        <div class="flex-1 min-w-0">
          <Show
            when={state.isListening}
            fallback={
              <Show
                when={state.error}
                fallback={
                  <span class="text-sm" style={{ color: "var(--text-weak)" }}>
                    {props.placeholder || "Click microphone or press Ctrl+Alt+V"}
                  </span>
                }
              >
                <span class="flex items-center gap-1.5 text-sm" style={{ color: "var(--cortex-warning)" }}>
                  <Icon name="circle-exclamation" class="w-4 h-4 shrink-0" />
                  <span class="truncate">{state.errorMessage}</span>
                </span>
              </Show>
            }
          >
            <div class="flex items-center gap-2">
              <span
                class="w-2 h-2 rounded-full animate-pulse"
                style={{ background: "var(--cortex-error)" }}
              />
              <span class="text-sm" style={{ color: "var(--cortex-error)" }}>
                Listening...
              </span>
            </div>
          </Show>
        </div>

        {/* Language selector */}
        <Show when={props.showLanguageSelector !== false}>
          <div class="relative">
            <select
              ref={languageSelectRef}
              value={state.language}
              onChange={handleLanguageChange}
              class="appearance-none pl-7 pr-2 py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus:ring-2 cursor-pointer"
              style={{
                background: "var(--surface-base)",
                color: "var(--text-weak)",
                border: "1px solid var(--border-weak)",
                "--tw-ring-color": "var(--text-weak)",
              }}
              title="Select recognition language"
            >
              {getAvailableLanguages().map((lang) => (
                <option value={lang.code}>{lang.name}</option>
              ))}
            </select>
            <Icon
              name="globe"
              class="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
              style={{ color: "var(--text-weaker)" }}
            />
          </div>
        </Show>

        {/* Clear button */}
        <Show when={hasTranscript() || state.isListening}>
          <button
            onClick={handleClear}
            class="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--surface-raised-hover)] focus:outline-none focus:ring-2"
            style={{
              color: "var(--text-weak)",
              "--tw-ring-color": "var(--text-weak)",
            }}
            title="Clear transcript"
          >
            <Icon name="xmark" class="w-4 h-4" />
          </button>
        </Show>
      </div>

      {/* Audio level indicator bar */}
      <Show when={state.isListening}>
        <div
          class="h-1 transition-all duration-75"
          style={{
            background: `linear-gradient(to right, var(--cortex-error) ${audioLevelWidth()}%, transparent ${audioLevelWidth()}%)`,
          }}
        />
      </Show>

      {/* Transcript display area */}
      <div
        class="px-4 py-3 min-h-[80px] max-h-[200px] overflow-y-auto"
        style={{ background: "var(--surface-base)" }}
      >
        <Show
          when={hasTranscript()}
          fallback={
            <p class="text-sm italic" style={{ color: "var(--text-weaker)" }}>
              {state.isListening
                ? "Speak now..."
                : state.isSupported
                  ? "Your speech will appear here"
                  : "Speech recognition is not supported in this browser"}
            </p>
          }
        >
          <p class="text-sm leading-relaxed" style={{ color: "var(--text-base)" }}>
            {/* Show final transcript */}
            <span>{state.finalTranscript}</span>
            {/* Show interim transcript with different styling */}
            <Show when={state.interimTranscript}>
              <span style={{ color: "var(--text-weak)", opacity: 0.8 }}>
                {state.interimTranscript}
              </span>
            </Show>
          </p>
        </Show>
      </div>

      {/* Action buttons footer */}
      <div
        class="flex items-center justify-between px-3 py-2 border-t"
        style={{
          background: "var(--surface-raised)",
          "border-color": "var(--border-weak)",
        }}
      >
        {/* Character count */}
        <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
          {state.transcript.length} characters
        </span>

        {/* Action buttons */}
        <div class="flex items-center gap-2">
          {/* Send to editor button */}
          <Show when={props.showEditorButton && props.onSendToEditor}>
            <button
              onClick={handleSendToEditor}
              disabled={!hasTranscript()}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2"
              style={{
                background: hasTranscript() ? "var(--surface-active)" : "var(--surface-raised)",
                color: hasTranscript() ? "var(--text-base)" : "var(--text-weaker)",
                opacity: hasTranscript() ? "1" : "0.5",
                cursor: hasTranscript() ? "pointer" : "not-allowed",
                "--tw-ring-color": "var(--text-weak)",
              }}
              title="Insert into editor"
            >
              <Icon name="pen-to-square" class="w-3.5 h-3.5" />
              <span>Editor</span>
            </button>
          </Show>

          {/* Send to chat button */}
          <Show when={props.onSendToChat}>
            <button
              onClick={handleSendToChat}
              disabled={!hasTranscript()}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1"
              style={{
                background: hasTranscript()
                  ? "linear-gradient(135deg, var(--cortex-info) 0%, var(--cortex-info) 100%)"
                  : "var(--surface-raised)",
                color: hasTranscript() ? "white" : "var(--text-weaker)",
                opacity: hasTranscript() ? "1" : "0.5",
                cursor: hasTranscript() ? "pointer" : "not-allowed",
                "--tw-ring-color": "var(--cortex-info)",
                "--tw-ring-offset-color": "var(--surface-raised)",
              }}
              title="Send to chat"
            >
              <Icon name="paper-plane" class="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </Show>
        </div>
      </div>

      {/* Keyboard hint */}
      <div
        class="px-3 py-1.5 text-xs border-t"
        style={{
          background: "var(--surface-base)",
          "border-color": "var(--border-weak)",
          color: "var(--text-weaker)",
        }}
      >
        <kbd
          class="px-1.5 py-0.5 rounded text-xs font-mono"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-weak)",
          }}
        >
          Ctrl+Alt+V
        </kbd>
        {" "}to toggle voice input
      </div>

      {/* Inject pulse animation styles (for full mode) */}
      <style>{`
        @keyframes voice-input-pulse-animation {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
          }
        }
        .voice-input-pulse {
          animation: voice-input-pulse-animation 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

/**
 * Standalone microphone button component for use in other places
 * Provides just the microphone toggle with visual feedback
 */
export function VoiceMicButton(props: {
  class?: string;
  size?: "sm" | "md" | "lg";
  onTranscriptReady?: (transcript: string) => void;
}) {
  const { state, toggleListening, clearTranscript } = useSpeech();

  // Watch for transcript completion and notify parent
  createEffect(() => {
    // When we stop listening and have a transcript, notify parent
    if (!state.isListening && state.transcript.trim() && props.onTranscriptReady) {
      props.onTranscriptReady(state.transcript.trim());
      clearTranscript();
    }
  });

  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const size = props.size || "md";

  return (
    <button
      onClick={toggleListening}
      disabled={!state.isSupported}
      class={`relative flex items-center justify-center ${sizeClasses[size]} rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 ${state.isListening ? "voice-input-pulse" : ""} ${props.class || ""}`}
      style={{
        background: !state.isSupported
          ? "var(--surface-disabled)"
          : state.isListening
            ? "rgba(239, 68, 68, 0.15)"
            : "var(--surface-raised)",
        color: !state.isSupported
          ? "var(--text-disabled)"
          : state.isListening
            ? "var(--cortex-error)"
            : "var(--text-base)",
        cursor: !state.isSupported ? "not-allowed" : "pointer",
        "--tw-ring-color": state.isListening ? "var(--cortex-error)" : "var(--text-weak)",
      }}
      title={
        !state.isSupported
          ? "Speech recognition not supported"
          : state.isListening
            ? "Stop listening (Ctrl+Alt+V)"
            : "Start voice input (Ctrl+Alt+V)"
      }
    >
      <Show when={state.isListening} fallback={<Icon name="microphone" class={iconSizes[size]} />}>
        <Icon name="microphone-slash" class={iconSizes[size]} />
      </Show>
      
      {/* Audio level indicator ring */}
      <Show when={state.isListening && state.audioLevel > 0.05}>
        <div
          class="absolute inset-0 rounded-lg border-2 pointer-events-none"
          style={{
            "border-color": `rgba(239, 68, 68, ${0.3 + state.audioLevel * 0.7})`,
            transform: `scale(${1 + state.audioLevel * 0.2})`,
            transition: "transform 50ms ease-out, border-color 50ms ease-out",
          }}
        />
      </Show>
      
      {/* Inject pulse animation styles */}
      <style>{`
        @keyframes voice-input-pulse-animation {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
          }
        }
        .voice-input-pulse {
          animation: voice-input-pulse-animation 1.5s ease-in-out infinite;
        }
      `}</style>
    </button>
  );
}

/**
 * Audio level visualizer bar component
 * Can be used independently to show current audio input level
 */
export function VoiceAudioLevel(props: { class?: string; height?: number }) {
  const { state } = useSpeech();

  const height = props.height || 4;

  return (
    <div
      class={`rounded-full overflow-hidden ${props.class || ""}`}
      style={{
        height: `${height}px`,
        background: "var(--surface-raised)",
      }}
    >
      <div
        class="h-full transition-all duration-75 rounded-full"
        style={{
          width: `${Math.max(2, state.audioLevel * 100)}%`,
          background: state.isListening
            ? `linear-gradient(90deg, var(--cortex-error) 0%, var(--cortex-warning) ${state.audioLevel * 100}%)`
            : "var(--text-weaker)",
        }}
      />
    </div>
  );
}

