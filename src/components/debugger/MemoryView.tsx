import { Show, For, createSignal, createEffect, createMemo, JSX } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useDebug } from "@/context/DebugContext";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../ui/Icon";

// ============== Types ==============

interface MemoryRegion {
  address: string;
  data: number[];
  unreadableBytes?: number;
}

interface WatchedRegion {
  id: string;
  address: string;
  size: number;
  name?: string;
}

interface MemoryState {
  baseAddress: string;
  data: number[];
  previousData: number[];
  loading: boolean;
  error: string | null;
  watchedRegions: WatchedRegion[];
  supportsWrite: boolean;
}

type BytesPerRow = 8 | 16 | 32;
type ByteGrouping = 1 | 2 | 4 | 8;
type AddressFormat = "hex" | "decimal";

// ============== Utility Functions ==============

function parseAddress(input: string): bigint | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith("0x")) {
      return BigInt(trimmed);
    }
    if (/^[0-9a-f]+$/i.test(trimmed)) {
      return BigInt("0x" + trimmed);
    }
    if (/^\d+$/.test(trimmed)) {
      return BigInt(trimmed);
    }
    return null;
  } catch {
    return null;
  }
}

function formatAddress(address: bigint, format: AddressFormat, width: number = 16): string {
  if (format === "hex") {
    return "0x" + address.toString(16).toUpperCase().padStart(width, "0");
  }
  return address.toString().padStart(width, " ");
}

function byteToHex(byte: number): string {
  return byte.toString(16).toUpperCase().padStart(2, "0");
}

function byteToAscii(byte: number): string {
  if (byte >= 0x20 && byte <= 0x7e) {
    return String.fromCharCode(byte);
  }
  return ".";
}

function hexToByte(hex: string): number | null {
  if (!/^[0-9a-fA-F]{1,2}$/.test(hex)) return null;
  const value = parseInt(hex, 16);
  return value >= 0 && value <= 255 ? value : null;
}

function downloadBlob(data: Uint8Array, filename: string): void {
  // Create a new ArrayBuffer copy to ensure it's not a SharedArrayBuffer
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============== Memory View Component ==============

export function MemoryView() {
  const debug = useDebug();

  // State
  const [state, setState] = createStore<MemoryState>({
    baseAddress: "0x0000000000000000",
    data: [],
    previousData: [],
    loading: false,
    error: null,
    watchedRegions: [],
    supportsWrite: false,
  });

  // Display settings
  const [addressInput, setAddressInput] = createSignal("");
  const [addressFormat, setAddressFormat] = createSignal<AddressFormat>("hex");
  const [bytesPerRow, setBytesPerRow] = createSignal<BytesPerRow>(16);
  const [byteGrouping, setByteGrouping] = createSignal<ByteGrouping>(2);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = createSignal(0);
  const [showSearch, setShowSearch] = createSignal(false);

  // Edit state
  const [editingCell, setEditingCell] = createSignal<number | null>(null);
  const [editValue, setEditValue] = createSignal("");

  // Memory size to fetch
  const MEMORY_PAGE_SIZE = 256;

  // Watch for debug session changes
  createEffect(() => {
    if (debug.state.isDebugging && debug.state.isPaused) {
      checkWriteSupport();
    }
  });

  // Auto-refresh watched regions when paused
  createEffect(() => {
    if (debug.state.isPaused && state.watchedRegions.length > 0) {
      refreshMemory();
    }
  });

  // Computed: rows of memory data
  const memoryRows = createMemo(() => {
    const rows: {
      address: bigint;
      bytes: (number | null)[];
      offsets: number[];
    }[] = [];

    const perRow = bytesPerRow();
    const baseAddr = parseAddress(state.baseAddress);
    if (baseAddr === null) return rows;

    for (let i = 0; i < state.data.length; i += perRow) {
      const rowBytes: (number | null)[] = [];
      const offsets: number[] = [];

      for (let j = 0; j < perRow; j++) {
        const idx = i + j;
        if (idx < state.data.length) {
          rowBytes.push(state.data[idx]);
          offsets.push(idx);
        } else {
          rowBytes.push(null);
          offsets.push(-1);
        }
      }

      rows.push({
        address: baseAddr + BigInt(i),
        bytes: rowBytes,
        offsets,
      });
    }

    return rows;
  });

  // Check if the adapter supports memory write
  async function checkWriteSupport(): Promise<void> {
    if (!debug.state.activeSessionId) return;

    try {
      const capabilities = await invoke<{ supportsWriteMemory?: boolean }>(
        "debug_get_capabilities",
        { sessionId: debug.state.activeSessionId }
      );
      setState("supportsWrite", capabilities.supportsWriteMemory ?? false);
    } catch {
      setState("supportsWrite", false);
    }
  }

  // Read memory from the debug adapter
  async function readMemory(address: string, count: number): Promise<number[]> {
    if (!debug.state.activeSessionId) {
      throw new Error("No active debug session");
    }

    const result = await invoke<MemoryRegion>("debug_read_memory", {
      sessionId: debug.state.activeSessionId,
      memoryReference: address,
      count,
    });

    return result.data;
  }

  // Write memory to the debug adapter
  async function writeMemory(address: string, data: number[]): Promise<void> {
    if (!debug.state.activeSessionId) {
      throw new Error("No active debug session");
    }

    await invoke("debug_write_memory", {
      sessionId: debug.state.activeSessionId,
      memoryReference: address,
      data,
    });
  }

  // Go to address
  async function goToAddress(): Promise<void> {
    const addr = parseAddress(addressInput());
    if (addr === null) {
      setState("error", "Invalid address format");
      return;
    }

    setState("loading", true);
    setState("error", null);

    try {
      const hexAddr = "0x" + addr.toString(16);
      const data = await readMemory(hexAddr, MEMORY_PAGE_SIZE);

      setState(
        produce((s) => {
          s.previousData = [...s.data];
          s.data = data;
          s.baseAddress = hexAddr;
          s.loading = false;
        })
      );

      setAddressInput(formatAddress(addr, addressFormat(), 16));
    } catch (e) {
      setState("error", String(e));
      setState("loading", false);
    }
  }

  // Refresh current memory view
  async function refreshMemory(): Promise<void> {
    if (!state.baseAddress || state.data.length === 0) return;

    setState("loading", true);
    setState("error", null);

    try {
      const data = await readMemory(state.baseAddress, state.data.length || MEMORY_PAGE_SIZE);

      setState(
        produce((s) => {
          s.previousData = [...s.data];
          s.data = data;
          s.loading = false;
        })
      );
    } catch (e) {
      setState("error", String(e));
      setState("loading", false);
    }
  }

  // Navigate pages
  function navigatePage(direction: "prev" | "next"): void {
    const baseAddr = parseAddress(state.baseAddress);
    if (baseAddr === null) return;

    const offset = BigInt(MEMORY_PAGE_SIZE);
    const newAddr = direction === "next" ? baseAddr + offset : baseAddr - offset;

    if (newAddr < 0n) return;

    setAddressInput("0x" + newAddr.toString(16));
    goToAddress();
  }

  // Search in memory
  function searchMemory(): void {
    const query = searchQuery().trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    const results: number[] = [];

    // Search for hex bytes
    if (/^([0-9a-fA-F]{2}\s*)+$/.test(query)) {
      const searchBytes = query
        .replace(/\s+/g, "")
        .match(/.{2}/g)
        ?.map((h) => parseInt(h, 16));

      if (searchBytes) {
        for (let i = 0; i <= state.data.length - searchBytes.length; i++) {
          let match = true;
          for (let j = 0; j < searchBytes.length; j++) {
            if (state.data[i + j] !== searchBytes[j]) {
              match = false;
              break;
            }
          }
          if (match) results.push(i);
        }
      }
    } else {
      // Search for ASCII string
      const searchBytes = Array.from(new TextEncoder().encode(query));
      for (let i = 0; i <= state.data.length - searchBytes.length; i++) {
        let match = true;
        for (let j = 0; j < searchBytes.length; j++) {
          if (state.data[i + j] !== searchBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) results.push(i);
      }
    }

    setSearchResults(results);
    setCurrentSearchIndex(0);
  }

  // Navigate search results
  function navigateSearch(direction: "prev" | "next"): void {
    const results = searchResults();
    if (results.length === 0) return;

    let newIndex = currentSearchIndex();
    if (direction === "next") {
      newIndex = (newIndex + 1) % results.length;
    } else {
      newIndex = (newIndex - 1 + results.length) % results.length;
    }
    setCurrentSearchIndex(newIndex);
  }

  // Edit cell
  function startEdit(offset: number, currentValue: number): void {
    if (!state.supportsWrite) return;
    setEditingCell(offset);
    setEditValue(byteToHex(currentValue));
  }

  async function commitEdit(): Promise<void> {
    const offset = editingCell();
    if (offset === null) return;

    const newValue = hexToByte(editValue());
    if (newValue === null) {
      setEditingCell(null);
      return;
    }

    const baseAddr = parseAddress(state.baseAddress);
    if (baseAddr === null) {
      setEditingCell(null);
      return;
    }

    const targetAddr = "0x" + (baseAddr + BigInt(offset)).toString(16);

    try {
      await writeMemory(targetAddr, [newValue]);

      setState(
        produce((s) => {
          s.previousData[offset] = s.data[offset];
          s.data[offset] = newValue;
        })
      );
    } catch (e) {
      setState("error", `Write failed: ${e}`);
    }

    setEditingCell(null);
  }

  function cancelEdit(): void {
    setEditingCell(null);
    setEditValue("");
  }

  // Watch region management
  function addWatchedRegion(): void {
    const addr = parseAddress(addressInput());
    if (addr === null) return;

    const id = `watch-${Date.now()}`;
    const region: WatchedRegion = {
      id,
      address: "0x" + addr.toString(16),
      size: MEMORY_PAGE_SIZE,
      name: `Region ${state.watchedRegions.length + 1}`,
    };

    setState(
      produce((s) => {
        s.watchedRegions.push(region);
      })
    );
  }

  function removeWatchedRegion(id: string): void {
    setState(
      produce((s) => {
        s.watchedRegions = s.watchedRegions.filter((r) => r.id !== id);
      })
    );
  }

  async function loadWatchedRegion(region: WatchedRegion): Promise<void> {
    setAddressInput(region.address);
    await goToAddress();
  }

  // Export memory dump
  function exportMemory(): void {
    if (state.data.length === 0) return;

    const baseAddr = parseAddress(state.baseAddress);
    const addrStr = baseAddr !== null ? baseAddr.toString(16).padStart(16, "0") : "unknown";
    const filename = `memory_${addrStr}_${state.data.length}bytes.bin`;

    downloadBlob(new Uint8Array(state.data), filename);
  }

  // Check if byte has changed
  function byteChanged(offset: number): boolean {
    return (
      state.previousData.length > offset &&
      state.data[offset] !== state.previousData[offset]
    );
  }

  // Check if byte is in search results
  function isSearchMatch(offset: number): boolean {
    const query = searchQuery().trim();
    if (!query || searchResults().length === 0) return false;

    const currentResult = searchResults()[currentSearchIndex()];
    const matchLength = /^([0-9a-fA-F]{2}\s*)+$/.test(query)
      ? query.replace(/\s+/g, "").length / 2
      : query.length;

    return offset >= currentResult && offset < currentResult + matchLength;
  }

  // Keyboard handling
  function handleAddressKeyDown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      goToAddress();
    }
  }

  function handleSearchKeyDown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        navigateSearch("prev");
      } else {
        searchMemory();
      }
    } else if (e.key === "Escape") {
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
    }
  }

  function handleEditKeyDown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      commitEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  }

  // Render grouped hex bytes
  function renderGroupedHex(row: { bytes: (number | null)[]; offsets: number[] }) {
    const groupSize = byteGrouping();
    const groups: JSX.Element[] = [];

    for (let i = 0; i < row.bytes.length; i += groupSize) {
      const groupBytes: JSX.Element[] = [];

      for (let j = 0; j < groupSize && i + j < row.bytes.length; j++) {
        const idx = i + j;
        const byte = row.bytes[idx];
        const offset = row.offsets[idx];

        if (byte === null) {
          groupBytes.push(<span class="text-gray-500">{"  "}</span>);
        } else if (editingCell() === offset) {
          groupBytes.push(
            <input
              type="text"
              value={editValue()}
              onInput={(e) => setEditValue(e.currentTarget.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={cancelEdit}
              class="w-5 text-center bg-transparent outline-none border-b"
              style={{
                "font-family": "monospace",
                color: "var(--accent)",
                "border-color": "var(--accent)",
              }}
              maxLength={2}
              autofocus
            />
          );
        } else {
          const changed = byteChanged(offset);
          const isMatch = isSearchMatch(offset);

          groupBytes.push(
            <span
              class={`cursor-pointer transition-colors ${
                state.supportsWrite ? "hover:bg-[var(--surface-raised)]" : ""
              }`}
              style={{
                color: changed
                  ? "var(--cortex-warning)"
                  : isMatch
                  ? "var(--cortex-success)"
                  : "var(--text-base)",
                background: isMatch ? "rgba(34, 197, 94, 0.2)" : "transparent",
                "border-radius": "var(--cortex-radius-sm)",
              }}
              onClick={() => state.supportsWrite && startEdit(offset, byte)}
              title={state.supportsWrite ? "Click to edit" : ""}
            >
              {byteToHex(byte)}
            </span>
          );
        }
      }

      groups.push(
        <span class="inline-flex" style={{ "margin-right": "4px" }}>
          {groupBytes}
        </span>
      );
    }

    return groups;
  }

  return (
    <div class="h-full flex flex-col" style={{ background: "var(--background-base)" }}>
      {/* Toolbar */}
      <div
        class="shrink-0 flex flex-wrap items-center gap-2 px-2 py-1.5 border-b"
        style={{ "border-color": "var(--border-weak)" }}
      >
        {/* Address input */}
        <div class="flex items-center gap-1">
          <input
            type="text"
            value={addressInput()}
            onInput={(e) => setAddressInput(e.currentTarget.value)}
            onKeyDown={handleAddressKeyDown}
            placeholder="Enter address (0x...)"
            class="w-40 px-2 py-1 text-xs rounded outline-none"
            style={{
              "font-family": "monospace",
              background: "var(--surface-sunken)",
              color: "var(--text-base)",
              border: "1px solid var(--border-weak)",
            }}
          />
          <button
            onClick={goToAddress}
            class="px-2 py-1 text-xs rounded transition-colors hover:opacity-80"
            style={{ background: "var(--accent)", color: "white" }}
            title="Go to address"
          >
            Go
          </button>
        </div>

        {/* Navigation */}
        <div class="flex items-center gap-0.5">
          <button
            onClick={() => navigatePage("prev")}
            class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Previous page"
            disabled={state.loading}
          >
            <Icon name="chevron-left" size="md" />
          </button>
          <button
            onClick={() => navigatePage("next")}
            class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Next page"
            disabled={state.loading}
          >
            <Icon name="chevron-right" size="md" />
          </button>
        </div>

        {/* Address format toggle */}
        <button
          onClick={() =>
            setAddressFormat((f) => (f === "hex" ? "decimal" : "hex"))
          }
          class="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--surface-raised)]"
          style={{ color: "var(--text-weak)" }}
          title={`Address format: ${addressFormat()}`}
        >
          <Icon name="hashtag" size="xs" />
          {addressFormat() === "hex" ? "Hex" : "Dec"}
        </button>

        {/* Bytes per row selector */}
        <select
          value={bytesPerRow()}
          onChange={(e) => setBytesPerRow(parseInt(e.currentTarget.value) as BytesPerRow)}
          class="px-2 py-1 text-xs rounded outline-none cursor-pointer"
          style={{
            background: "var(--surface-sunken)",
            color: "var(--text-base)",
            border: "1px solid var(--border-weak)",
          }}
          title="Bytes per row"
        >
          <option value={8}>8 bytes/row</option>
          <option value={16}>16 bytes/row</option>
          <option value={32}>32 bytes/row</option>
        </select>

        {/* Byte grouping selector */}
        <select
          value={byteGrouping()}
          onChange={(e) => setByteGrouping(parseInt(e.currentTarget.value) as ByteGrouping)}
          class="px-2 py-1 text-xs rounded outline-none cursor-pointer"
          style={{
            background: "var(--surface-sunken)",
            color: "var(--text-base)",
            border: "1px solid var(--border-weak)",
          }}
          title="Byte grouping"
        >
          <option value={1}>Group by 1</option>
          <option value={2}>Group by 2</option>
          <option value={4}>Group by 4</option>
          <option value={8}>Group by 8</option>
        </select>

        {/* Spacer */}
        <div class="flex-1" />

        {/* Action buttons */}
        <button
          onClick={() => setShowSearch((s) => !s)}
          class={`p-1 rounded transition-colors ${
            showSearch() ? "bg-[var(--accent)]" : "hover:bg-[var(--surface-raised)]"
          }`}
          style={{ color: showSearch() ? "white" : "var(--text-weak)" }}
          title="Search memory"
        >
          <Icon name="magnifying-glass" size="md" />
        </button>

        <button
          onClick={refreshMemory}
          class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
          style={{ color: "var(--text-weak)" }}
          title="Refresh"
          disabled={state.loading || state.data.length === 0}
        >
          <Icon name="rotate" size="md" class={state.loading ? "animate-spin" : ""} />
        </button>

        <button
          onClick={addWatchedRegion}
          class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
          style={{ color: "var(--text-weak)" }}
          title="Watch this region"
          disabled={!addressInput().trim()}
        >
          <Icon name="eye" size="md" />
        </button>

        <button
          onClick={exportMemory}
          class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
          style={{ color: "var(--text-weak)" }}
          title="Export memory dump"
          disabled={state.data.length === 0}
        >
          <Icon name="download" size="md" />
        </button>
      </div>

      {/* Search bar */}
      <Show when={showSearch()}>
        <div
          class="shrink-0 flex items-center gap-2 px-2 py-1.5 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <Icon name="magnifying-glass" size="xs" style={{ color: "var(--text-weak)" }} />
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search hex (e.g., FF 00) or ASCII text"
            class="flex-1 px-2 py-1 text-xs rounded outline-none"
            style={{
              "font-family": "monospace",
              background: "var(--surface-sunken)",
              color: "var(--text-base)",
              border: "1px solid var(--border-weak)",
            }}
            autofocus
          />
          <Show when={searchResults().length > 0}>
            <span class="text-xs" style={{ color: "var(--text-weak)" }}>
              {currentSearchIndex() + 1} / {searchResults().length}
            </span>
            <button
              onClick={() => navigateSearch("prev")}
              class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title="Previous match"
            >
              <Icon name="chevron-left" size="xs" />
            </button>
            <button
              onClick={() => navigateSearch("next")}
              class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title="Next match"
            >
              <Icon name="chevron-right" size="xs" />
            </button>
          </Show>
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery("");
              setSearchResults([]);
            }}
            class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Close search"
          >
            <Icon name="xmark" size="xs" />
          </button>
        </div>
      </Show>

      {/* Watched regions */}
      <Show when={state.watchedRegions.length > 0}>
        <div
          class="shrink-0 flex flex-wrap items-center gap-1 px-2 py-1 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <span class="text-xs" style={{ color: "var(--text-weak)" }}>
            Watched:
          </span>
          <For each={state.watchedRegions}>
            {(region) => (
              <div
                class="group flex items-center gap-1 px-2 py-0.5 text-xs rounded cursor-pointer transition-colors hover:bg-[var(--surface-raised)]"
                style={{
                  background: "var(--surface-sunken)",
                  color: "var(--text-base)",
                }}
              >
                <span
                  onClick={() => loadWatchedRegion(region)}
                  style={{ "font-family": "monospace" }}
                >
                  {region.name || region.address}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeWatchedRegion(region.id);
                  }}
                  class="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity hover:bg-[var(--surface-raised)]"
                  style={{ color: "var(--text-weak)" }}
                  title="Remove watch"
                >
                  <Icon name="xmark" size="xs" />
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Error message */}
      <Show when={state.error}>
        <div
          class="shrink-0 flex items-center gap-2 px-2 py-1.5 text-xs"
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            color: "var(--cortex-error)",
          }}
        >
          <Icon name="circle-exclamation" size="md" />
          {state.error}
          <button
            onClick={() => setState("error", null)}
            class="ml-auto p-0.5 rounded hover:bg-[rgba(239,68,68,0.2)]"
          >
            <Icon name="xmark" size="xs" />
          </button>
        </div>
      </Show>

      {/* Column headers */}
      <Show when={state.data.length > 0}>
        <div
          class="shrink-0 flex px-2 py-1 text-xs border-b"
          style={{
            "font-family": "monospace",
            "border-color": "var(--border-weak)",
            color: "var(--text-weak)",
            background: "var(--surface-sunken)",
          }}
        >
          <div
            class="shrink-0"
            style={{
              width: addressFormat() === "hex" ? "160px" : "180px",
            }}
          >
            Address
          </div>
          <div class="flex-1">Hex</div>
          <div
            class="shrink-0 text-right"
            style={{ width: `${bytesPerRow() * 8 + 8}px` }}
          >
            ASCII
          </div>
        </div>
      </Show>

      {/* Memory content */}
      <div class="flex-1 overflow-auto">
        <Show
          when={debug.state.isDebugging}
          fallback={
            <div class="flex items-center justify-center h-full text-xs" style={{ color: "var(--text-weak)" }}>
              Start a debug session to view memory
            </div>
          }
        >
          <Show
            when={state.data.length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center h-full gap-2 text-xs" style={{ color: "var(--text-weak)" }}>
                <Show when={!state.loading} fallback={
                  <div class="flex items-center gap-2">
                    <div
                      class="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                      style={{ "border-color": "var(--text-weak)", "border-top-color": "transparent" }}
                    />
                    Loading memory...
                  </div>
                }>
                  <div>Enter an address to view memory</div>
                  <div style={{ color: "var(--text-weaker)" }}>
                    Example: 0x7fff5fbff8c0 or 140734799804608
                  </div>
                </Show>
              </div>
            }
          >
            <div class="min-w-fit">
              <For each={memoryRows()}>
                {(row, rowIndex) => (
                  <div
                    class="flex px-2 py-0.5 text-xs transition-colors hover:bg-[var(--surface-raised)]"
                    style={{
                      "font-family": "monospace",
                      background:
                        rowIndex() % 2 === 0
                          ? "transparent"
                          : "var(--surface-sunken)",
                    }}
                  >
                    {/* Address */}
                    <div
                      class="shrink-0"
                      style={{
                        width: addressFormat() === "hex" ? "160px" : "180px",
                        color: "var(--cortex-text-inactive)",
                      }}
                    >
                      {formatAddress(row.address, addressFormat())}
                    </div>

                    {/* Hex bytes */}
                    <div class="flex-1 flex flex-wrap gap-0">{renderGroupedHex(row)}</div>

                    {/* ASCII representation */}
                    <div
                      class="shrink-0 text-right tracking-wider"
                      style={{
                        width: `${bytesPerRow() * 8 + 8}px`,
                        color: "var(--cortex-text-inactive)",
                      }}
                    >
                      {row.bytes.map((byte, idx) => {
                        if (byte === null) return " ";
                        const offset = row.offsets[idx];
                        const changed = byteChanged(offset);
                        const isMatch = isSearchMatch(offset);

                        return (
                          <span
                            style={{
                              color: changed
                                ? "var(--cortex-warning)"
                                : isMatch
                                ? "var(--cortex-success)"
                                : "var(--cortex-text-inactive)",
                              background: isMatch
                                ? "rgba(34, 197, 94, 0.2)"
                                : "transparent",
                            }}
                          >
                            {byteToAscii(byte)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>

      {/* Status bar */}
      <Show when={state.data.length > 0}>
        <div
          class="shrink-0 flex items-center justify-between px-2 py-1 text-xs border-t"
          style={{
            "border-color": "var(--border-weak)",
            color: "var(--text-weak)",
            background: "var(--surface-sunken)",
          }}
        >
          <span>
            {state.data.length} bytes at {state.baseAddress}
          </span>
          <div class="flex items-center gap-2">
            <Show when={state.supportsWrite}>
              <span
                class="flex items-center gap-1"
                style={{ color: "var(--cortex-success)" }}
              >
                <Icon name="pen" size="xs" />
                Writable
              </span>
            </Show>
            <Show when={state.previousData.length > 0}>
              <span
                class="flex items-center gap-1"
                style={{ color: "var(--cortex-warning)" }}
              >
                Changed bytes highlighted
              </span>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ============== Helper Component for Variable Context Menu ==============

export interface MemoryViewContextProps {
  variableAddress?: string;
  variableName?: string;
  onViewMemory?: (address: string) => void;
}

export function useMemoryViewFromVariable() {
  const [targetAddress, setTargetAddress] = createSignal<string | null>(null);

  function viewMemoryAtAddress(address: string): void {
    setTargetAddress(address);
  }

  function clearTarget(): void {
    setTargetAddress(null);
  }

  return {
    targetAddress,
    viewMemoryAtAddress,
    clearTarget,
  };
}

