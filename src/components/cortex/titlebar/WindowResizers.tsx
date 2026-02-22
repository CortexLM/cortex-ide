import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";

type ResizeDirection = "North" | "South" | "East" | "West" | "NorthEast" | "NorthWest" | "SouthEast" | "SouthWest";

const RESIZE_HANDLE_SIZE = 5;
const CORNER_SIZE = 10;
const RESIZE_HANDLE_Z_INDEX = 1000;

export function WindowResizers() {
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [isMaximized, setIsMaximized] = createSignal(false);
  let appWindow: Awaited<ReturnType<typeof getCurrentWindow>> | null = null;
  let unlisten: (() => void) | undefined;

  onCleanup(() => unlisten?.());

  onMount(async () => {
    try {
      appWindow = getCurrentWindow();

      const checkWindowState = async () => {
        if (appWindow) {
          setIsFullscreen(await appWindow.isFullscreen());
          setIsMaximized(await appWindow.isMaximized());
        }
      };

      await checkWindowState();

      unlisten = await appWindow.onResized(async () => {
        await checkWindowState();
      });
    } catch {
      // Not in Tauri context
    }
  });

  const startResizing = async (direction: ResizeDirection) => {
    try {
      if (appWindow) {
        await appWindow.startResizeDragging(direction);
      }
    } catch (err) {
      console.error(`Resize ${direction} failed:`, err);
    }
  };

  return (
    <Show when={!isFullscreen() && !isMaximized()}>
      {/* Top edge */}
      <div
        onMouseDown={() => startResizing("North")}
        style={{
          position: "fixed",
          top: "0",
          left: `${CORNER_SIZE}px`,
          right: `${CORNER_SIZE}px`,
          height: `${RESIZE_HANDLE_SIZE}px`,
          cursor: "ns-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />

      {/* Bottom edge */}
      <div
        onMouseDown={() => startResizing("South")}
        style={{
          position: "fixed",
          bottom: "0",
          left: `${CORNER_SIZE}px`,
          right: `${CORNER_SIZE}px`,
          height: `${RESIZE_HANDLE_SIZE}px`,
          cursor: "ns-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />

      {/* Left edge */}
      <div
        onMouseDown={() => startResizing("West")}
        style={{
          position: "fixed",
          top: `${CORNER_SIZE}px`,
          bottom: `${CORNER_SIZE}px`,
          left: "0",
          width: `${RESIZE_HANDLE_SIZE}px`,
          cursor: "ew-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />

      {/* Right edge */}
      <div
        onMouseDown={() => startResizing("East")}
        style={{
          position: "fixed",
          top: `${CORNER_SIZE}px`,
          bottom: `${CORNER_SIZE}px`,
          right: "0",
          width: `${RESIZE_HANDLE_SIZE}px`,
          cursor: "ew-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />

      {/* Top-left corner */}
      <div
        onMouseDown={() => startResizing("NorthWest")}
        style={{
          position: "fixed",
          top: "0",
          left: "0",
          width: `${CORNER_SIZE}px`,
          height: `${CORNER_SIZE}px`,
          cursor: "nwse-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />

      {/* Top-right corner */}
      <div
        onMouseDown={() => startResizing("NorthEast")}
        style={{
          position: "fixed",
          top: "0",
          right: "0",
          width: `${CORNER_SIZE}px`,
          height: `${CORNER_SIZE}px`,
          cursor: "nesw-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />

      {/* Bottom-left corner */}
      <div
        onMouseDown={() => startResizing("SouthWest")}
        style={{
          position: "fixed",
          bottom: "0",
          left: "0",
          width: `${CORNER_SIZE}px`,
          height: `${CORNER_SIZE}px`,
          cursor: "nesw-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />

      {/* Bottom-right corner */}
      <div
        onMouseDown={() => startResizing("SouthEast")}
        style={{
          position: "fixed",
          bottom: "0",
          right: "0",
          width: `${CORNER_SIZE}px`,
          height: `${CORNER_SIZE}px`,
          cursor: "nwse-resize",
          "z-index": RESIZE_HANDLE_Z_INDEX,
        }}
      />
    </Show>
  );
}

export default WindowResizers;
