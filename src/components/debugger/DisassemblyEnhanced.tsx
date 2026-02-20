import { Show, For, createSignal } from "solid-js";
import { useDebug } from "@/context/DebugContext";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../ui/Icon";

interface DisassembledInstruction {
  address: string;
  instructionBytes?: string;
  instruction: string;
  symbol?: string;
  location?: SourceLocation;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

interface SourceLocation {
  name?: string;
  path?: string;
  sourceReference?: number;
}

interface MixedSourceLine {
  kind: "source" | "instruction";
  sourceLine?: string;
  sourceLineNumber?: number;
  sourceFile?: string;
  instruction?: DisassembledInstruction;
}

export interface MixedSourceDisplayProps {
  instructions: DisassembledInstruction[];
  useHex: boolean;
  currentAddress: string | null;
  onSetBreakpoint: (address: string) => void;
  onGoToAddress: (address: string) => void;
}

export function MixedSourceDisplay(props: MixedSourceDisplayProps) {
  const [sourceCache] = createSignal<Map<string, string[]>>(new Map());

  const mixedLines = (): MixedSourceLine[] => {
    const result: MixedSourceLine[] = [];
    let lastSourceKey = "";

    for (const inst of props.instructions) {
      const loc = inst.location;
      const lineNum = inst.line;
      if (loc?.path && lineNum !== undefined) {
        const key = `${loc.path}:${lineNum}`;
        if (key !== lastSourceKey) {
          lastSourceKey = key;
          const cached = sourceCache().get(loc.path);
          const lineText = cached && lineNum > 0 && lineNum <= cached.length
            ? cached[lineNum - 1]
            : undefined;
          result.push({
            kind: "source",
            sourceLine: lineText,
            sourceLineNumber: lineNum,
            sourceFile: loc.name || loc.path,
          });
        }
      }
      result.push({ kind: "instruction", instruction: inst });
    }
    return result;
  };

  const formatAddr = (address: string): string => {
    if (props.useHex) {
      if (address.startsWith("0x") || address.startsWith("0X")) return address.toLowerCase();
      return `0x${BigInt(address).toString(16).padStart(16, "0")}`;
    }
    return BigInt(address).toString();
  };

  return (
    <div class="font-mono text-xs">
      <For each={mixedLines()}>
        {(line) => (
          <Show
            when={line.kind === "source"}
            fallback={
              <div
                class="flex items-center gap-2 px-2 transition-colors hover:bg-[var(--surface-raised)]"
                style={{
                  height: "22px",
                  background: line.instruction?.address === props.currentAddress
                    ? "var(--cortex-highlight-active)"
                    : "transparent",
                }}
              >
                <span class="w-4 shrink-0" />
                <span class="w-36 shrink-0 text-right tabular-nums" style={{ color: "var(--text-weak)" }}>
                  {line.instruction ? formatAddr(line.instruction.address) : ""}
                </span>
                <Show when={line.instruction?.instructionBytes}>
                  <span class="w-24 shrink-0 tabular-nums" style={{ color: "var(--text-weak)", opacity: 0.6 }}>
                    {line.instruction!.instructionBytes}
                  </span>
                </Show>
                <span class="flex-1 truncate" style={{ color: "var(--text-base)" }}>
                  {line.instruction?.instruction}
                </span>
                <Show when={line.instruction?.symbol}>
                  <span class="shrink-0 text-[10px] px-1 rounded" style={{ color: "var(--cortex-info)", background: "rgba(59, 130, 246, 0.1)" }}>
                    {line.instruction!.symbol}
                  </span>
                </Show>
              </div>
            }
          >
            <div
              class="flex items-center gap-2 px-2"
              style={{
                height: "22px",
                background: "var(--surface-sunken)",
                "border-top": "1px solid var(--border-weak)",
                "border-bottom": "1px solid var(--border-weak)",
              }}
            >
              <Icon name="file-code" size="xs" />
              <span class="shrink-0 text-[10px]" style={{ color: "var(--cortex-info)" }}>
                {line.sourceFile}:{line.sourceLineNumber}
              </span>
              <Show when={line.sourceLine !== undefined}>
                <span class="flex-1 truncate" style={{ color: "var(--cortex-syntax-string)" }}>
                  {line.sourceLine}
                </span>
              </Show>
              <Show when={line.sourceLine === undefined}>
                <span class="flex-1 truncate italic" style={{ color: "var(--text-weak)" }}>
                  (source not available)
                </span>
              </Show>
            </div>
          </Show>
        )}
      </For>
    </div>
  );
}

export interface InstructionStepButtonProps {
  disabled?: boolean;
}

export function InstructionStepButton(props: InstructionStepButtonProps) {
  const debug = useDebug();
  const [stepping, setStepping] = createSignal(false);

  const handleStep = async () => {
    if (!debug.state.activeSessionId || !debug.state.isPaused || stepping()) return;
    setStepping(true);
    try {
      await invoke("debug_step_instruction", {
        sessionId: debug.state.activeSessionId,
        threadId: debug.state.activeThreadId,
        granularity: "instruction",
      });
    } catch (e) {
      console.error("Instruction step failed:", e);
    } finally {
      setStepping(false);
    }
  };

  return (
    <button
      onClick={handleStep}
      disabled={props.disabled || !debug.state.isPaused || stepping()}
      class="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors disabled:opacity-40 hover:bg-[var(--surface-raised)]"
      style={{ color: "var(--text-base)" }}
      title="Step one instruction (instruction-level stepping)"
    >
      <Icon name="arrow-right-to-bracket" size="xs" />
      <span>Step Instruction</span>
    </button>
  );
}

export interface InstructionBreakpointToggleProps {
  address: string;
  hasBreakpoint: boolean;
  verified: boolean;
  onToggle: (address: string) => void;
}

export function InstructionBreakpointToggle(props: InstructionBreakpointToggleProps) {
  const color = () => {
    if (!props.hasBreakpoint) return "transparent";
    if (!props.verified) return "var(--debug-icon-breakpoint-unverified-foreground)";
    return "var(--debug-icon-breakpoint-foreground)";
  };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); props.onToggle(props.address); }}
      class="w-4 h-4 flex items-center justify-center rounded-full transition-colors group"
      style={{ color: color() }}
      title={props.hasBreakpoint ? `Remove breakpoint at ${props.address}` : `Set breakpoint at ${props.address}`}
    >
      <Show
        when={props.hasBreakpoint}
        fallback={
          <svg width="10" height="10" viewBox="0 0 16 16" class="opacity-0 group-hover:opacity-40" fill="currentColor" style={{ color: "var(--debug-icon-breakpoint-foreground)" }}>
            <circle cx="8" cy="8" r="6" />
          </svg>
        }
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="6" />
        </svg>
      </Show>
    </button>
  );
}

export interface AddressNavigatorProps {
  onNavigate: (address: string) => void;
}

export function AddressNavigator(props: AddressNavigatorProps) {
  const [input, setInput] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);

  const parseAddress = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
        BigInt(trimmed);
        return trimmed;
      }
      if (/^\d+$/.test(trimmed)) {
        return `0x${BigInt(trimmed).toString(16)}`;
      }
      if (/^[0-9a-fA-F]+$/.test(trimmed)) {
        BigInt(`0x${trimmed}`);
        return `0x${trimmed}`;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleNavigate = () => {
    const address = parseAddress(input());
    if (address) { setError(null); props.onNavigate(address); setInput(""); }
    else { setError("Invalid address format"); }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleNavigate(); }
    else if (e.key === "Escape") { setInput(""); setError(null); }
  };

  return (
    <div class="flex items-center gap-1">
      <div class="relative flex-1">
        <input
          type="text"
          value={input()}
          onInput={(e) => { setInput(e.currentTarget.value); setError(null); }}
          onKeyDown={handleKeyDown}
          placeholder="Go to address (hex/dec)"
          class="w-full px-2 py-0.5 text-xs font-mono rounded outline-none"
          style={{
            background: "var(--surface-sunken)",
            color: "var(--text-base)",
            border: `1px solid ${error() ? "var(--cortex-error)" : "var(--border-weak)"}`,
            height: "22px",
            "line-height": "22px",
          }}
        />
        <Show when={error()}>
          <div class="absolute top-full left-0 mt-0.5 px-2 py-0.5 text-[10px] rounded z-10" style={{ background: "var(--cortex-error)", color: "white" }}>
            {error()}
          </div>
        </Show>
      </div>
      <button
        onClick={handleNavigate}
        disabled={!input().trim()}
        class="px-2 py-0.5 text-xs rounded transition-colors disabled:opacity-40 hover:bg-[var(--surface-raised)]"
        style={{ color: "var(--text-base)", height: "22px" }}
        title="Go to address"
      >
        <Icon name="arrow-right" size="xs" />
      </button>
    </div>
  );
}
