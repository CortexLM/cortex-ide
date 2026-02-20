import { Show, For, createSignal } from "solid-js";
import { useDebug } from "@/context/DebugContext";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui";

const BYTES_PER_ROW = 16;
const DEFAULT_READ_SIZE = 256;
const MAX_READ_SIZE = 1_048_576;

function parseAddress(input: string): bigint | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.length > 64) return null;
  try {
    if (trimmed.startsWith("0x")) return BigInt(trimmed);
    if (/^[0-9a-f]+$/i.test(trimmed)) return BigInt("0x" + trimmed);
    if (/^\d+$/.test(trimmed)) return BigInt(trimmed);
    return null;
  } catch {
    return null;
  }
}

function formatAddr(address: bigint): string {
  return "0x" + address.toString(16).toUpperCase().padStart(16, "0");
}

function byteToHex(byte: number): string {
  return byte.toString(16).toUpperCase().padStart(2, "0");
}

function byteToAscii(byte: number): string {
  return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".";
}

function base64ToBytes(base64: string): number[] {
  const binaryString = atob(base64);
  const bytes: number[] = [];
  for (let i = 0; i < binaryString.length; i++) {
    bytes.push(binaryString.charCodeAt(i));
  }
  return bytes;
}

interface MemoryRow {
  address: bigint;
  bytes: number[];
}

function buildRows(baseAddress: bigint, data: number[]): MemoryRow[] {
  const rows: MemoryRow[] = [];
  for (let i = 0; i < data.length; i += BYTES_PER_ROW) {
    rows.push({
      address: baseAddress + BigInt(i),
      bytes: data.slice(i, i + BYTES_PER_ROW),
    });
  }
  return rows;
}

function HexRow(props: { row: MemoryRow }) {
  return (
    <div
      class="flex items-center"
      style={{
        height: "20px",
        "font-size": "12px",
        "font-family": "var(--monaco-monospace-font, monospace)",
        "white-space": "pre",
      }}
    >
      <span
        class="shrink-0"
        style={{ width: "140px", color: "var(--cortex-syntax-number, #b5cea8)", "padding-left": "8px" }}
      >
        {formatAddr(props.row.address)}
      </span>
      <span class="shrink-0" style={{ width: `${BYTES_PER_ROW * 3}ch`, color: "var(--text-base)" }}>
        {props.row.bytes.map((b) => byteToHex(b)).join(" ")}
        {props.row.bytes.length < BYTES_PER_ROW ? "   ".repeat(BYTES_PER_ROW - props.row.bytes.length) : ""}
      </span>
      <span style={{ width: "16px" }} />
      <span style={{ color: "var(--cortex-syntax-string, #ce9178)" }}>
        {props.row.bytes.map((b) => byteToAscii(b)).join("")}
      </span>
    </div>
  );
}

export function MemoryInspector() {
  const debug = useDebug();
  const [addressInput, setAddressInput] = createSignal("");
  const [data, setData] = createSignal<number[]>([]);
  const [baseAddress, setBaseAddress] = createSignal<bigint>(BigInt(0));
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const rows = () => buildRows(baseAddress(), data());

  const readMemory = async (address: string, size: number = DEFAULT_READ_SIZE) => {
    if (!debug.state.activeSessionId) {
      setError("No active debug session");
      return;
    }
    const trimmedAddr = address.trim();
    if (!trimmedAddr || trimmedAddr.length > 256) {
      setError("Invalid memory address");
      return;
    }
    const clampedSize = Math.max(1, Math.min(size, MAX_READ_SIZE));
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<{ address: string; data?: string }>("debug_read_memory", {
        sessionId: debug.state.activeSessionId,
        memoryReference: trimmedAddr,
        offset: 0,
        count: clampedSize,
      });
      const addr = parseAddress(result.address);
      if (addr !== null) {
        setBaseAddress(addr);
      }
      setData(result.data ? base64ToBytes(result.data) : []);
    } catch (err) {
      setError(String(err));
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    const addr = addressInput().trim();
    if (!addr) return;
    if (parseAddress(addr) === null) {
      setError("Invalid address format. Use hex (0x...) or decimal.");
      return;
    }
    readMemory(addr);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  const handlePrev = () => {
    const newAddr = baseAddress() - BigInt(DEFAULT_READ_SIZE);
    if (newAddr >= BigInt(0)) {
      setBaseAddress(newAddr);
      readMemory(formatAddr(newAddr));
    }
  };

  const handleNext = () => {
    const newAddr = baseAddress() + BigInt(DEFAULT_READ_SIZE);
    setBaseAddress(newAddr);
    readMemory(formatAddr(newAddr));
  };

  return (
    <div class="flex flex-col h-full" style={{ background: "var(--cortex-bg-primary)", color: "var(--text-base)" }}>
      <div class="flex items-center gap-1 px-2 shrink-0" style={{ height: "32px", "border-bottom": "1px solid var(--surface-border)" }}>
        <Icon name="memory" size={14} color="var(--text-weak)" />
        <span style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase" }}>Memory</span>
      </div>
      <div class="flex items-center gap-1 px-2 py-1 shrink-0" style={{ "border-bottom": "1px solid var(--surface-border)" }}>
        <input
          type="text"
          value={addressInput()}
          onInput={(e) => setAddressInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder="Address (0x...)"
          maxLength={64}
          style={{
            flex: "1",
            background: "var(--cortex-bg-primary)",
            color: "var(--text-base)",
            border: "1px solid var(--surface-border)",
            "border-radius": "3px",
            padding: "2px 6px",
            "font-size": "12px",
            "font-family": "var(--monaco-monospace-font, monospace)",
            height: "24px",
            outline: "none",
          }}
        />
        <IconButton size="sm" variant="ghost" onClick={handleSubmit} title="Read Memory">
          <Icon name="magnifying-glass" size={12} />
        </IconButton>
        <Show when={data().length > 0}>
          <IconButton size="sm" variant="ghost" onClick={handlePrev} title="Previous Page">
            <Icon name="chevron-up" size={12} />
          </IconButton>
          <IconButton size="sm" variant="ghost" onClick={handleNext} title="Next Page">
            <Icon name="chevron-down" size={12} />
          </IconButton>
        </Show>
      </div>
      <div class="flex-1 overflow-y-auto overflow-x-auto">
        <Show when={loading()}>
          <div class="flex items-center justify-center p-4" style={{ color: "var(--text-weak)", "font-size": "12px" }}>
            Reading memory...
          </div>
        </Show>
        <Show when={error()}>
          <div class="p-2" style={{ color: "var(--cortex-error)", "font-size": "12px" }}>
            {error()}
          </div>
        </Show>
        <Show when={!loading() && !error() && rows().length > 0}>
          <div class="py-1" style={{ "min-width": "fit-content" }}>
            <div
              class="flex items-center"
              style={{
                height: "20px",
                "font-size": "11px",
                "font-family": "var(--monaco-monospace-font, monospace)",
                color: "var(--text-weak)",
                "border-bottom": "1px solid var(--surface-border)",
                "white-space": "pre",
              }}
            >
              <span class="shrink-0" style={{ width: "140px", "padding-left": "8px" }}>Address</span>
              <span class="shrink-0" style={{ width: `${BYTES_PER_ROW * 3}ch` }}>
                {Array.from({ length: BYTES_PER_ROW }, (_, i) => i.toString(16).toUpperCase().padStart(2, "0")).join(" ")}
              </span>
              <span style={{ width: "16px" }} />
              <span>ASCII</span>
            </div>
            <For each={rows()}>
              {(row) => <HexRow row={row} />}
            </For>
          </div>
        </Show>
        <Show when={!loading() && !error() && data().length === 0}>
          <div class="flex items-center justify-center p-4" style={{ color: "var(--text-weak)", "font-size": "12px" }}>
            Enter a memory address to inspect
          </div>
        </Show>
      </div>
    </div>
  );
}