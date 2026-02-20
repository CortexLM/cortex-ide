import { Show, For, createSignal, createEffect, onCleanup } from "solid-js";
import { useDebug, Breakpoint } from "@/context/DebugContext";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../ui/Icon";

// ============== Types ==============

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

interface DisassembleResponse {
  instructions: DisassembledInstruction[];
}

// ============== Utility Functions ==============

function formatAddress(address: string, useHex: boolean): string {
  if (useHex) {
    if (address.startsWith("0x") || address.startsWith("0X")) {
      return address.toLowerCase();
    }
    return `0x${BigInt(address).toString(16).padStart(16, "0")}`;
  }
  const numeric = address.startsWith("0x") || address.startsWith("0X")
    ? BigInt(address)
    : BigInt(address);
  return numeric.toString();
}

function formatBytes(bytes: string | undefined, useHex: boolean): string {
  if (!bytes) return "";
  if (useHex) {
    return bytes.toUpperCase();
  }
  const byteArray = bytes.match(/.{1,2}/g) || [];
  return byteArray.map((b) => parseInt(b, 16).toString().padStart(3, " ")).join(" ");
}

// ============== Instruction Row Component ==============

interface InstructionRowProps {
  instruction: DisassembledInstruction;
  isCurrentInstruction: boolean;
  hasBreakpoint: boolean;
  isBreakpointVerified: boolean;
  useHex: boolean;
  showSource: boolean;
  onSetBreakpoint: (address: string) => void;
  onCopy: (text: string) => void;
  onGoToAddress: (address: string) => void;
}

function InstructionRow(props: InstructionRowProps) {
  const [hovered, setHovered] = createSignal(false);

  const getMnemonicColor = () => {
    const inst = props.instruction.instruction.toLowerCase();
    const mnemonic = inst.split(/\s+/)[0];

    // Jump/branch instructions - blue
    if (/^(jmp|je|jne|jz|jnz|jg|jge|jl|jle|ja|jae|jb|jbe|jc|jnc|jo|jno|js|jns|jp|jnp|call|ret|retn|loop|loope|loopne|loopz|loopnz)$/i.test(mnemonic)) {
      return "var(--cortex-syntax-keyword)";
    }
    // Move/load/store instructions - cyan
    if (/^(mov|movzx|movsx|lea|push|pop|xchg|ldr|str|ldp|stp|adr|adrp)$/i.test(mnemonic)) {
      return "var(--cortex-syntax-function)";
    }
    // Arithmetic instructions - green
    if (/^(add|sub|mul|div|inc|dec|neg|imul|idiv|adc|sbb|cmp|test)$/i.test(mnemonic)) {
      return "var(--cortex-syntax-number)";
    }
    // Logic/bit instructions - orange
    if (/^(and|or|xor|not|shl|shr|sal|sar|rol|ror|rcl|rcr|bt|bts|btr|btc|bsf|bsr)$/i.test(mnemonic)) {
      return "var(--cortex-syntax-string)";
    }
    // Nop/padding - gray
    if (/^(nop|int3|hlt|ud2)$/i.test(mnemonic)) {
      return "var(--cortex-text-inactive)";
    }
    // System/privileged instructions - red
    if (/^(syscall|sysret|int|iret|cli|sti|in|out)$/i.test(mnemonic)) {
      return "var(--cortex-error)";
    }
    // Default - yellow
    return "var(--cortex-syntax-function)";
  };

  const handleDoubleClick = () => {
    props.onGoToAddress(props.instruction.address);
  };

  return (
    <div
      class="group flex items-center text-xs font-mono transition-colors"
      style={{
        background: props.isCurrentInstruction
          ? "rgba(249, 158, 11, 0.15)"
          : hovered()
          ? "var(--surface-raised)"
          : "transparent",
        "border-left": props.isCurrentInstruction
          ? "2px solid var(--cortex-warning)"
          : "2px solid transparent",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDblClick={handleDoubleClick}
    >
      {/* Breakpoint indicator / gutter */}
      <div
        class="w-6 h-6 flex items-center justify-center shrink-0 cursor-pointer"
        onClick={() => props.onSetBreakpoint(props.instruction.address)}
        title={props.hasBreakpoint ? "Remove breakpoint" : "Set breakpoint"}
      >
        <Show
          when={props.hasBreakpoint}
          fallback={
            <div
              class="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: "var(--text-weak)" }}
            >
              <Icon name="circle" size="xs" />
            </div>
          }
        >
          <div
            class="w-3 h-3 rounded-full"
            style={{
              background: props.isBreakpointVerified ? "var(--cortex-error)" : "var(--cortex-text-inactive)",
            }}
          />
        </Show>
      </div>

      {/* Current instruction pointer indicator */}
      <div
        class="w-5 flex items-center justify-center shrink-0"
        style={{ color: props.isCurrentInstruction ? "var(--cortex-warning)" : "transparent" }}
      >
        <Show when={props.isCurrentInstruction}>
          <Icon name="arrow-right" size="sm" />
        </Show>
      </div>

      {/* Address column */}
      <div
        class="w-32 shrink-0 pr-2 text-right select-text"
        style={{ color: "var(--cortex-text-inactive)" }}
        title={props.instruction.address}
      >
        {formatAddress(props.instruction.address, props.useHex)}
      </div>

      {/* Bytes column (opcodes) */}
      <Show when={props.instruction.instructionBytes}>
        <div
          class="w-28 shrink-0 pr-2 select-text overflow-hidden"
          style={{ color: "var(--cortex-syntax-comment)" }}
          title={props.instruction.instructionBytes}
        >
          {formatBytes(props.instruction.instructionBytes, props.useHex)}
        </div>
      </Show>

      {/* Symbol (if available) */}
      <Show when={props.instruction.symbol}>
        <div
          class="shrink-0 pr-2"
          style={{ color: "var(--cortex-syntax-keyword)" }}
        >
          &lt;{props.instruction.symbol}&gt;
        </div>
      </Show>

      {/* Instruction (mnemonic + operands) */}
      <div class="flex-1 min-w-0 select-text">
        <span style={{ color: getMnemonicColor() }}>
          {props.instruction.instruction}
        </span>
      </div>

      {/* Source mapping (if enabled and available) */}
      <Show when={props.showSource && props.instruction.location}>
        <div
          class="shrink-0 ml-4 pr-2 text-right truncate max-w-48"
          style={{ color: "var(--text-weak)" }}
          title={`${props.instruction.location?.path || props.instruction.location?.name}:${props.instruction.line}`}
        >
          <span class="opacity-60">
            {props.instruction.location?.name || props.instruction.location?.path?.split(/[/\\]/).pop() || ""}
            <Show when={props.instruction.line}>
              :{props.instruction.line}
            </Show>
          </span>
        </div>
      </Show>

      {/* Copy button (visible on hover) */}
      <div class="w-8 flex items-center justify-center shrink-0">
        <button
          class="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity hover:bg-[var(--surface-sunken)]"
          style={{ color: "var(--text-weak)" }}
          onClick={() => props.onCopy(`${props.instruction.address}: ${props.instruction.instruction}`)}
          title="Copy instruction"
        >
          <Icon name="copy" size="xs" />
        </button>
      </div>
    </div>
  );
}

// ============== Main DisassemblyView Component ==============

export function DisassemblyView() {
  const debug = useDebug();
  
  // State
  const [instructions, setInstructions] = createSignal<DisassembledInstruction[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [useHex, setUseHex] = createSignal(true);
  const [showSource, setShowSource] = createSignal(true);
  const [goToAddressInput, setGoToAddressInput] = createSignal("");
  const [showGoToInput, setShowGoToInput] = createSignal(false);
  const [currentInstructionAddress, setCurrentInstructionAddress] = createSignal<string | null>(null);
  const [instructionBreakpoints, setInstructionBreakpoints] = createSignal<Map<string, Breakpoint>>(new Map());
  const [copyFeedback, setCopyFeedback] = createSignal<string | null>(null);
  
  let containerRef: HTMLDivElement | undefined;
  let currentInstructionRef: HTMLDivElement | undefined;

  // Fetch disassembly when paused and frame changes
  createEffect(() => {
    if (debug.state.isPaused && debug.state.activeFrameId !== null) {
      fetchDisassembly();
    } else if (!debug.state.isPaused) {
      setInstructions([]);
      setCurrentInstructionAddress(null);
    }
  });

  // Scroll to current instruction when it changes
  createEffect(() => {
    const currentAddr = currentInstructionAddress();
    if (currentAddr && currentInstructionRef) {
      currentInstructionRef.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  // Clear copy feedback after delay
  createEffect(() => {
    const feedback = copyFeedback();
    if (feedback) {
      const timer = setTimeout(() => setCopyFeedback(null), 2000);
      onCleanup(() => clearTimeout(timer));
    }
  });

  const fetchDisassembly = async (memoryReference?: string, instructionOffset?: number, instructionCount?: number) => {
    if (!debug.state.activeSessionId) return;

    setLoading(true);
    setError(null);

    try {
      // Get current instruction pointer from top frame
      const topFrame = debug.state.stackFrames[0];
      const reference = memoryReference || (topFrame ? `${topFrame.id}` : undefined);
      
      if (!reference) {
        setError("No memory reference available");
        setLoading(false);
        return;
      }

      const response = await invoke<DisassembleResponse>("debug_disassemble", {
        sessionId: debug.state.activeSessionId,
        memoryReference: reference,
        instructionOffset: instructionOffset ?? -50,
        instructionCount: instructionCount ?? 200,
        resolveSymbols: true,
      });

      setInstructions(response.instructions);
      
      // Determine current instruction address from stack frame info
      if (topFrame && !memoryReference) {
        // Use the address from the first instruction as the current one if we're at the start
        const firstInst = response.instructions[0];
        if (firstInst && instructionOffset === undefined) {
          // Find the instruction at offset 0 (middle of our range)
          const middleIndex = Math.min(50, response.instructions.length - 1);
          setCurrentInstructionAddress(response.instructions[middleIndex]?.address || null);
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      console.error("Failed to fetch disassembly:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleStepInstruction = async () => {
    if (!debug.state.activeSessionId || !debug.state.isPaused) return;

    try {
      await invoke("debug_step_instruction", {
        sessionId: debug.state.activeSessionId,
        threadId: debug.state.activeThreadId,
        granularity: "instruction",
      });
    } catch (e) {
      console.error("Step instruction failed:", e);
    }
  };

  const handleGoToAddress = async () => {
    const input = goToAddressInput().trim();
    if (!input) return;

    try {
      let address = input;
      // Handle different input formats
      if (!input.startsWith("0x") && !input.startsWith("0X")) {
        // If it looks like a decimal number, convert to hex
        if (/^\d+$/.test(input)) {
          address = `0x${BigInt(input).toString(16)}`;
        } else {
          // Assume it's hex without prefix
          address = `0x${input}`;
        }
      }

      await fetchDisassembly(address, -50, 200);
      setShowGoToInput(false);
      setGoToAddressInput("");
    } catch (e) {
      console.error("Failed to go to address:", e);
    }
  };

  const handleGoToAddressFromInstruction = async (address: string) => {
    await fetchDisassembly(address, -50, 200);
  };

  const handleRefresh = () => {
    fetchDisassembly();
  };

  const handleSetBreakpoint = async (address: string) => {
    if (!debug.state.activeSessionId) return;

    const existing = instructionBreakpoints().get(address);
    
    try {
      if (existing) {
        // Remove breakpoint - pass all remaining addresses to keep
        const remainingAddresses = Array.from(instructionBreakpoints().keys()).filter(
          (addr) => addr !== address
        );
        await invoke("debug_remove_instruction_breakpoint", {
          sessionId: debug.state.activeSessionId,
          instructionReferences: remainingAddresses,
        });
        const updated = new Map(instructionBreakpoints());
        updated.delete(address);
        setInstructionBreakpoints(updated);
      } else {
        // Set breakpoint - pass all breakpoints including the new one
        const allAddresses = [...Array.from(instructionBreakpoints().keys()), address];
        const result = await invoke<{ breakpoints: Breakpoint[] }>("debug_set_instruction_breakpoint", {
          sessionId: debug.state.activeSessionId,
          breakpoints: allAddresses.map((addr) => ({ instructionReference: addr })),
        });
        // Find the breakpoint for the new address in the result
        const newBp = result.breakpoints.find(
          (bp) => bp.path === address || bp.id !== undefined
        );
        const updated = new Map(instructionBreakpoints());
        if (newBp) {
          updated.set(address, newBp);
        } else if (result.breakpoints.length > 0) {
          // Use the last breakpoint as a fallback
          updated.set(address, result.breakpoints[result.breakpoints.length - 1]);
        }
        setInstructionBreakpoints(updated);
      }
    } catch (e) {
      console.error("Failed to toggle instruction breakpoint:", e);
    }
  };

  const handleCopyInstruction = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback("Copied!");
    } catch (e) {
      console.error("Failed to copy:", e);
      setCopyFeedback("Failed to copy");
    }
  };

  const handleCopyAllInstructions = async () => {
    const text = instructions()
      .map((inst) => {
        const addr = formatAddress(inst.address, useHex());
        const bytes = inst.instructionBytes ? formatBytes(inst.instructionBytes, useHex()) : "";
        return `${addr}  ${bytes.padEnd(24)}  ${inst.instruction}`;
      })
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback("All instructions copied!");
    } catch (e) {
      console.error("Failed to copy all:", e);
      setCopyFeedback("Failed to copy");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleGoToAddress();
    } else if (e.key === "Escape") {
      setShowGoToInput(false);
      setGoToAddressInput("");
    }
  };

  const iconButtonClass =
    "p-1.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--surface-raised)]";

  return (
    <div class="h-full flex flex-col" style={{ background: "var(--background-base)" }}>
      {/* Toolbar */}
      <div
        class="shrink-0 flex items-center gap-1 px-2 py-1.5 border-b"
        style={{ "border-color": "var(--border-weak)" }}
      >
        {/* Step instruction */}
        <button
          onClick={handleStepInstruction}
          disabled={!debug.state.isPaused}
          class={iconButtonClass}
          style={{ color: debug.state.isPaused ? "var(--cortex-success)" : "var(--text-weak)" }}
          title="Step Instruction (single assembly instruction)"
        >
          <Icon name="angles-right" size="md" />
        </button>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          disabled={!debug.state.isPaused}
          class={iconButtonClass}
          style={{ color: "var(--text-weak)" }}
          title="Refresh disassembly"
        >
          <Icon name="rotate" size="md" />
        </button>

        <div class="w-px h-4 mx-1" style={{ background: "var(--border-weak)" }} />

        {/* Go to address */}
        <Show
          when={showGoToInput()}
          fallback={
            <button
              onClick={() => setShowGoToInput(true)}
              disabled={!debug.state.isPaused}
              class={iconButtonClass}
              style={{ color: "var(--text-weak)" }}
              title="Go to address"
            >
              <Icon name="location-arrow" size="md" />
            </button>
          }
        >
          <div class="flex items-center gap-1">
            <input
              type="text"
              value={goToAddressInput()}
              onInput={(e) => setGoToAddressInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder="Address (hex or decimal)"
              class="w-40 px-2 py-1 text-xs font-mono rounded outline-none"
              style={{
                background: "var(--surface-sunken)",
                color: "var(--text-base)",
                border: "1px solid var(--border-weak)",
              }}
              autofocus
            />
            <button
              onClick={handleGoToAddress}
              class="px-2 py-1 text-xs rounded"
              style={{ background: "var(--accent)", color: "white" }}
            >
              Go
            </button>
            <button
              onClick={() => {
                setShowGoToInput(false);
                setGoToAddressInput("");
              }}
              class="px-2 py-1 text-xs rounded"
              style={{ color: "var(--text-weak)" }}
            >
              Cancel
            </button>
          </div>
        </Show>

        <div class="flex-1" />

        {/* Toggle hex/decimal */}
        <button
          onClick={() => setUseHex(!useHex())}
          class={iconButtonClass}
          style={{ color: useHex() ? "var(--accent)" : "var(--text-weak)" }}
          title={useHex() ? "Switch to decimal" : "Switch to hexadecimal"}
        >
          <Icon name="hashtag" size="md" />
        </button>

        {/* Toggle source mapping */}
        <button
          onClick={() => setShowSource(!showSource())}
          class={iconButtonClass}
          style={{ color: showSource() ? "var(--accent)" : "var(--text-weak)" }}
          title={showSource() ? "Hide source mapping" : "Show source mapping"}
        >
          <Show when={showSource()} fallback={<Icon name="eye-slash" size="md" />}>
            <Icon name="eye" size="md" />
          </Show>
        </button>

        {/* Copy all */}
        <button
          onClick={handleCopyAllInstructions}
          disabled={instructions().length === 0}
          class={iconButtonClass}
          style={{ color: "var(--text-weak)" }}
          title="Copy all instructions"
        >
          <Icon name="copy" size="md" />
        </button>
      </div>

      {/* Copy feedback toast */}
      <Show when={copyFeedback()}>
        <div
          class="absolute top-12 right-4 px-3 py-1.5 rounded text-xs z-50"
          style={{
            background: "var(--surface-raised)",
            color: "var(--text-base)",
            border: "1px solid var(--border-weak)",
          }}
        >
          {copyFeedback()}
        </div>
      </Show>

      {/* Main content */}
      <div class="flex-1 overflow-auto" ref={containerRef}>
        <Show
          when={!loading()}
          fallback={
            <div class="flex items-center justify-center py-8">
              <div
                class="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                style={{
                  "border-color": "var(--text-weak)",
                  "border-top-color": "transparent",
                }}
              />
              <span class="ml-2 text-sm" style={{ color: "var(--text-weak)" }}>
                Loading disassembly...
              </span>
            </div>
          }
        >
          <Show
            when={!error()}
            fallback={
              <div class="p-4">
                <div
                  class="flex items-center gap-2 p-3 rounded text-sm"
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    color: "var(--cortex-error)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                  }}
                >
                  <Icon name="code" size="md" style={{ "flex-shrink": "0" }} />
                  <div>
                    <div class="font-medium">Disassembly unavailable</div>
                    <div class="text-xs opacity-80 mt-0.5">{error()}</div>
                  </div>
                </div>
                <div
                  class="mt-3 text-xs"
                  style={{ color: "var(--text-weak)" }}
                >
                  Possible reasons:
                  <ul class="list-disc ml-4 mt-1 space-y-0.5">
                    <li>Debug adapter doesn't support disassembly</li>
                    <li>No debug symbols available</li>
                    <li>Target binary is not native code</li>
                  </ul>
                </div>
              </div>
            }
          >
            <Show
              when={instructions().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center py-8">
                  <Icon name="code" style={{ width: "32px", height: "32px", "margin-bottom": "8px", color: "var(--text-weak)" }} />
                  <div class="text-sm text-center" style={{ color: "var(--text-weak)" }}>
                    <Show
                      when={debug.state.isPaused}
                      fallback="Pause execution to view disassembly"
                    >
                      No disassembly available
                    </Show>
                  </div>
                </div>
              }
            >
              {/* Column headers */}
              <div
                class="sticky top-0 flex items-center px-2 py-1 text-xs font-mono border-b"
                style={{
                  background: "var(--background-base)",
                  color: "var(--text-weak)",
                  "border-color": "var(--border-weak)",
                }}
              >
                <div class="w-6 shrink-0" />
                <div class="w-5 shrink-0" />
                <div class="w-32 shrink-0 pr-2 text-right">Address</div>
                <div class="w-28 shrink-0 pr-2">Bytes</div>
                <div class="flex-1">Instruction</div>
                <Show when={showSource()}>
                  <div class="shrink-0 ml-4 pr-2 text-right w-48">Source</div>
                </Show>
                <div class="w-8 shrink-0" />
              </div>

              {/* Instructions list */}
              <div class="py-1">
                <For each={instructions()}>
                  {(instruction) => {
                    const isCurrentInstruction = () =>
                      currentInstructionAddress() === instruction.address;
                    const breakpoint = () => instructionBreakpoints().get(instruction.address);

                    return (
                      <div
                        ref={(el) => {
                          if (isCurrentInstruction()) {
                            currentInstructionRef = el;
                          }
                        }}
                      >
                        <InstructionRow
                          instruction={instruction}
                          isCurrentInstruction={isCurrentInstruction()}
                          hasBreakpoint={!!breakpoint()}
                          isBreakpointVerified={breakpoint()?.verified ?? false}
                          useHex={useHex()}
                          showSource={showSource()}
                          onSetBreakpoint={handleSetBreakpoint}
                          onCopy={handleCopyInstruction}
                          onGoToAddress={handleGoToAddressFromInstruction}
                        />
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </Show>
        </Show>
      </div>

      {/* Status bar */}
      <div
        class="shrink-0 flex items-center justify-between px-3 py-1 text-xs border-t"
        style={{
          background: "var(--surface-sunken)",
          color: "var(--text-weak)",
          "border-color": "var(--border-weak)",
        }}
      >
        <div class="flex items-center gap-4">
          <span>
            {instructions().length} instructions
          </span>
          <Show when={currentInstructionAddress()}>
            <span>
              IP: {formatAddress(currentInstructionAddress()!, useHex())}
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <span>{useHex() ? "Hex" : "Dec"}</span>
          <Show when={instructionBreakpoints().size > 0}>
            <span class="text-red-400">
              {instructionBreakpoints().size} breakpoint{instructionBreakpoints().size !== 1 ? "s" : ""}
            </span>
          </Show>
        </div>
      </div>
    </div>
  );
}

