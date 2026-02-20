import { createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";

export interface ImageViewerProps {
  src: string;
  filePath?: string;
  onClose?: () => void;
  class?: string;
}

function getFormatFromPath(filePath?: string): string {
  if (!filePath) return "Unknown";
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const formats: Record<string, string> = {
    png: "PNG", jpg: "JPEG", jpeg: "JPEG", gif: "GIF", webp: "WebP",
    bmp: "BMP", ico: "ICO", svg: "SVG", avif: "AVIF", tiff: "TIFF", tif: "TIFF",
  };
  return formats[ext] || ext.toUpperCase() || "Unknown";
}

function estimateFileSize(src: string): number {
  if (src.startsWith("data:")) {
    const base64Part = src.split(",")[1];
    if (base64Part) return Math.round(base64Part.length * 0.75);
  }
  return 0;
}

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const ZOOM_STEP = 1.25;

export function ImageViewer(props: ImageViewerProps) {
  const [zoom, setZoom] = createSignal(1);
  const [panX, setPanX] = createSignal(0);
  const [panY, setPanY] = createSignal(0);
  const [imageWidth, setImageWidth] = createSignal(0);
  const [imageHeight, setImageHeight] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  let canvasRef: HTMLCanvasElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  let img: HTMLImageElement | null = null;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startPanX = 0;
  let startPanY = 0;

  function drawImage() {
    if (!canvasRef || !img || !containerRef) return;
    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;
    const rect = containerRef.getBoundingClientRect();
    canvasRef.width = rect.width;
    canvasRef.height = rect.height;
    ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
    const z = zoom();
    const drawW = img.naturalWidth * z;
    const drawH = img.naturalHeight * z;
    ctx.drawImage(img, (canvasRef.width - drawW) / 2 + panX(), (canvasRef.height - drawH) / 2 + panY(), drawW, drawH);
  }

  function fitToView() {
    if (!img || !containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    const fitZoom = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight, 1);
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom)));
    setPanX(0);
    setPanY(0);
  }

  function zoomTo100() { setZoom(1); setPanX(0); setPanY(0); }
  function zoomIn() { setZoom((z) => Math.min(z * ZOOM_STEP, MAX_ZOOM)); }
  function zoomOut() { setZoom((z) => Math.max(z / ZOOM_STEP, MIN_ZOOM)); }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn(); else zoomOut();
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startPanX = panX();
    startPanY = panY();
    if (canvasRef) canvasRef.style.cursor = "grabbing";
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    e.preventDefault();
    setPanX(startPanX + (e.clientX - dragStartX));
    setPanY(startPanY + (e.clientY - dragStartY));
  }

  function handleMouseUp() {
    isDragging = false;
    if (canvasRef) canvasRef.style.cursor = "grab";
  }

  createEffect(() => {
    const src = props.src;
    if (!src) return;

    const isAllowedSrc =
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("data:image/") ||
      src.startsWith("blob:") ||
      src.startsWith("asset://") ||
      src.startsWith("tauri://");

    if (!isAllowedSrc) {
      setError("Unsupported image source");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const newImg = new Image();
    newImg.onload = () => {
      img = newImg;
      setImageWidth(newImg.naturalWidth);
      setImageHeight(newImg.naturalHeight);
      setLoading(false);
      fitToView();
    };
    newImg.onerror = () => { setError("Failed to load image"); setLoading(false); };
    newImg.src = src;
  });

  createEffect(() => {
    zoom(); panX(); panY();
    if (!loading() && !error()) drawImage();
  });

  onMount(() => {
    const observer = new ResizeObserver(() => drawImage());
    if (containerRef) observer.observe(containerRef);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    onCleanup(() => {
      observer.disconnect();
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    });
  });

  const zoomPercent = () => `${Math.round(zoom() * 100)}%`;
  const format = () => getFormatFromPath(props.filePath);
  const fileSize = () => formatFileSize(estimateFileSize(props.src));

  return (
    <div class={`flex flex-col h-full overflow-hidden ${props.class || ""}`}>
      <div
        class="h-9 flex items-center justify-between px-2 border-b shrink-0"
        style={{ background: "var(--surface-base)", "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-center gap-2">
          <Icon name="image" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          <Show when={props.filePath}>
            <span class="text-xs truncate max-w-[200px]" style={{ color: "var(--text-base)" }}>
              {props.filePath!.split(/[/\\]/).pop()}
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-1">
          <button
            onClick={zoomOut}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Zoom Out"
          >
            <Icon name="magnifying-glass-minus" class="w-4 h-4" />
          </button>
          <span class="w-14 text-center text-xs tabular-nums" style={{ color: "var(--text-base)" }}>
            {zoomPercent()}
          </span>
          <button
            onClick={zoomIn}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Zoom In"
          >
            <Icon name="magnifying-glass-plus" class="w-4 h-4" />
          </button>
          <div class="w-px h-4 mx-1" style={{ background: "var(--border-weak)" }} />
          <button
            onClick={fitToView}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Fit to View"
          >
            <Icon name="minimize" class="w-4 h-4" />
          </button>
          <button
            onClick={zoomTo100}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Zoom to 100%"
          >
            <Icon name="maximize" class="w-4 h-4" />
          </button>
          <Show when={props.onClose}>
            <div class="w-px h-4 mx-1" style={{ background: "var(--border-weak)" }} />
            <button
              onClick={props.onClose}
              class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title="Close"
            >
              <Icon name="xmark" class="w-4 h-4" />
            </button>
          </Show>
        </div>
      </div>

      <div ref={containerRef} class="flex-1 relative overflow-hidden" style={{ background: "var(--background-stronger)" }}>
        <Show when={loading()}>
          <div class="absolute inset-0 flex items-center justify-center z-10">
            <div class="flex flex-col items-center gap-3">
              <div
                class="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ "border-color": "var(--border-weak)", "border-top-color": "transparent" }}
              />
              <span class="text-xs" style={{ color: "var(--text-weaker)" }}>Loading image...</span>
            </div>
          </div>
        </Show>
        <Show when={error()}>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="flex flex-col items-center gap-2" style={{ color: "var(--error)" }}>
              <Icon name="image" class="w-10 h-10 opacity-50" />
              <span class="text-sm">{error()}</span>
            </div>
          </div>
        </Show>
        <canvas
          ref={canvasRef}
          class="absolute inset-0 w-full h-full"
          style={{ cursor: "grab" }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
        />
      </div>

      <Show when={!loading() && !error() && imageWidth() > 0}>
        <div
          class="h-6 flex items-center justify-center gap-4 text-xs border-t shrink-0"
          style={{ background: "var(--surface-base)", "border-color": "var(--border-weak)", color: "var(--text-weak)" }}
        >
          <span>{imageWidth()} × {imageHeight()}</span>
          <span>•</span>
          <span>{fileSize()}</span>
          <span>•</span>
          <span>{format()}</span>
        </div>
      </Show>
    </div>
  );
}

export default ImageViewer;
