import {
  type Component,
  createSignal,
  createMemo,
  For,
  Show,
  onMount,
  onCleanup,
} from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { IconButton, Text } from "@/components/ui";
import { tokens } from "@/design-system/tokens";
import { formatBytes } from "@/utils/format";

const BYTES_PER_ROW = 16;
const ROW_HEIGHT = 20;
const OVERSCAN = 5;

export interface HexEditorProps {
  data: Uint8Array;
  filePath?: string;
  onClose?: () => void;
  class?: string;
}

function formatOffset(offset: number): string {
  return offset.toString(16).toUpperCase().padStart(8, "0");
}

function formatHexByte(byte: number): string {
  return byte.toString(16).toUpperCase().padStart(2, "0");
}

function formatAscii(byte: number): string {
  return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".";
}

function extractFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

const HEX_COLUMN_HEADERS = Array.from({ length: BYTES_PER_ROW }, (_, i) =>
  formatHexByte(i)
);

export const HexEditor: Component<HexEditorProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const [scrollTop, setScrollTop] = createSignal(0);
  const [containerHeight, setContainerHeight] = createSignal(400);
  const [hoveredRow, setHoveredRow] = createSignal(-1);

  const totalRows = createMemo(() =>
    Math.ceil(props.data.length / BYTES_PER_ROW)
  );

  const totalHeight = createMemo(() => totalRows() * ROW_HEIGHT);

  const visibleRowCount = createMemo(() =>
    Math.ceil(containerHeight() / ROW_HEIGHT)
  );

  const startRow = createMemo(() =>
    Math.max(0, Math.floor(scrollTop() / ROW_HEIGHT) - OVERSCAN)
  );

  const endRow = createMemo(() =>
    Math.min(totalRows(), Math.floor(scrollTop() / ROW_HEIGHT) + visibleRowCount() + OVERSCAN)
  );

  const visibleRows = createMemo(() => {
    const rows: number[] = [];
    const start = startRow();
    const end = endRow();
    for (let i = start; i < end; i++) {
      rows.push(i);
    }
    return rows;
  });

  const getRowBytes = (rowIndex: number): Uint8Array => {
    const offset = rowIndex * BYTES_PER_ROW;
    const end = Math.min(offset + BYTES_PER_ROW, props.data.length);
    return props.data.slice(offset, end);
  };

  const formatRowHex = (bytes: Uint8Array): string => {
    const parts: string[] = [];
    for (let i = 0; i < BYTES_PER_ROW; i++) {
      if (i === 8) parts.push("");
      if (i < bytes.length) {
        parts.push(formatHexByte(bytes[i]));
      } else {
        parts.push("  ");
      }
    }
    return parts.join(" ");
  };

  const formatRowAscii = (bytes: Uint8Array): string => {
    let result = "";
    for (let i = 0; i < bytes.length; i++) {
      result += formatAscii(bytes[i]);
    }
    return result;
  };

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  };

  const updateContainerHeight = () => {
    if (containerRef) {
      setContainerHeight(containerRef.clientHeight);
    }
  };

  let resizeObserver: ResizeObserver | undefined;

  onMount(() => {
    updateContainerHeight();
    resizeObserver = new ResizeObserver(() => updateContainerHeight());
    if (containerRef) {
      resizeObserver.observe(containerRef);
    }
  });

  onCleanup(() => {
    resizeObserver?.disconnect();
  });

  const monoFont = tokens.typography.fontFamily.mono;

  return (
    <div
      class={`flex flex-col h-full overflow-hidden ${props.class ?? ""}`}
      style={{ background: tokens.colors.surface.card }}
    >
      <div
        class="flex items-center gap-2 px-3 shrink-0"
        style={{
          height: "32px",
          background: tokens.colors.surface.panel,
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
        }}
      >
        <Icon name="binary" size={14} />
        <Text variant="body" weight="medium" size="sm">
          Hex Editor
        </Text>
        <Show when={props.filePath}>
          <span
            class="truncate"
            style={{
              color: tokens.colors.text.secondary,
              "font-size": tokens.typography.fontSize.xs,
              "max-width": "300px",
            }}
          >
            {extractFileName(props.filePath!)}
          </span>
        </Show>
        <div class="flex-1" />
        <Text variant="body" size="xs" color="muted">
          {formatBytes(props.data.length)}
        </Text>
        <Show when={props.onClose}>
          <IconButton
            size="sm"
            onClick={props.onClose}
            title="Close"
            icon={<Icon name="xmark" size={14} />}
          />
        </Show>
      </div>

      <div
        class="flex px-3 shrink-0 select-none"
        style={{
          height: `${ROW_HEIGHT}px`,
          "font-family": monoFont,
          "font-size": tokens.typography.fontSize.xs,
          color: tokens.colors.text.muted,
          background: tokens.colors.surface.panel,
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
          "line-height": `${ROW_HEIGHT}px`,
        }}
      >
        <span class="shrink-0" style={{ width: "80px" }}>Offset</span>
        <span class="shrink-0" style={{ width: "430px" }}>
          {HEX_COLUMN_HEADERS.slice(0, 8).join(" ")}
          {"  "}
          {HEX_COLUMN_HEADERS.slice(8).join(" ")}
        </span>
        <span>ASCII</span>
      </div>

      <div
        ref={containerRef}
        class="flex-1 overflow-y-auto overflow-x-hidden"
        style={{
          "scrollbar-color": `${tokens.components.scrollbar.thumb} ${tokens.components.scrollbar.track}`,
        }}
        onScroll={handleScroll}
      >
        <div style={{ height: `${totalHeight()}px`, position: "relative" }}>
          <For each={visibleRows()}>
            {(rowIndex) => {
              const bytes = createMemo(() => getRowBytes(rowIndex));
              const isHovered = () => hoveredRow() === rowIndex;

              return (
                <div
                  class="flex px-3"
                  style={{
                    position: "absolute",
                    top: `${rowIndex * ROW_HEIGHT}px`,
                    left: 0,
                    right: 0,
                    height: `${ROW_HEIGHT}px`,
                    "line-height": `${ROW_HEIGHT}px`,
                    "font-family": monoFont,
                    "font-size": tokens.typography.fontSize.xs,
                    background: isHovered() ? tokens.colors.surface.hover : "transparent",
                    transition: tokens.transitions.fast,
                    cursor: "default",
                  }}
                  onMouseEnter={() => setHoveredRow(rowIndex)}
                  onMouseLeave={() => setHoveredRow(-1)}
                >
                  <span
                    class="shrink-0"
                    style={{
                      width: "80px",
                      color: tokens.colors.text.muted,
                    }}
                  >
                    {formatOffset(rowIndex * BYTES_PER_ROW)}
                  </span>
                  <span
                    class="shrink-0"
                    style={{
                      width: "430px",
                      color: tokens.colors.text.primary,
                    }}
                  >
                    {formatRowHex(bytes())}
                  </span>
                  <span
                    style={{ color: tokens.colors.text.secondary }}
                  >
                    {formatRowAscii(bytes())}
                  </span>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      <div
        class="flex items-center gap-3 px-3 shrink-0"
        style={{
          height: "24px",
          background: tokens.colors.surface.panel,
          "border-top": `1px solid ${tokens.colors.border.default}`,
        }}
      >
        <Text variant="body" size="xs" color="muted">
          {props.data.length.toLocaleString()} bytes
        </Text>
        <Text variant="body" size="xs" color="muted">
          {totalRows().toLocaleString()} rows
        </Text>
        <Show when={props.filePath}>
          <div class="flex-1" />
          <Text variant="body" size="xs" color="muted">
            {props.filePath}
          </Text>
        </Show>
      </div>
    </div>
  );
};

export default HexEditor;
