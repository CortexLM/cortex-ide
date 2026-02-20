import { createSignal, createEffect, onCleanup, Show, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { fsReadFileBinary } from "../../utils/tauri-api";

// Supported image extensions
export const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg", "avif", "tiff", "tif"
]);

export function isImageFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTENSIONS.has(ext);
}

export function getImageMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    ico: "image/x-icon",
    svg: "image/svg+xml",
    avif: "image/avif",
    tiff: "image/tiff",
    tif: "image/tiff"
  };
  return mimeTypes[ext] || "image/png";
}

interface ImageInfo {
  width: number;
  height: number;
  fileSize: number;
  format: string;
}

interface ImageViewerProps {
  path: string;
  name: string;
  compareWith?: { path: string; name: string } | null;
  onClose?: () => void;
  onCompareRequest?: () => void;
}

type ZoomMode = "fit" | "actual" | "custom";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImagePanel(props: {
  path: string;
  name: string;
  showInfo: boolean;
  zoom: number;
  zoomMode: ZoomMode;
  onImageLoad?: (info: ImageInfo) => void;
}) {
  let containerRef: HTMLDivElement | undefined;
  let imageRef: HTMLImageElement | undefined;
  
  const [imageUrl, setImageUrl] = createSignal<string | null>(null);
  const [imageInfo, setImageInfo] = createSignal<ImageInfo | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [panOffset, setPanOffset] = createSignal({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = createSignal(false);
  const [panStart, setPanStart] = createSignal({ x: 0, y: 0 });
  
  // Load image from backend
  createEffect(() => {
    const path = props.path;
    if (!path) return;
    
    setLoading(true);
    setError(null);
    setPanOffset({ x: 0, y: 0 });
    
    const loadImage = async () => {
      try {
        // Read image as base64 using Tauri
        const base64Content = await fsReadFileBinary(path);
        const mimeType = getImageMimeType(props.name);
        const url = `data:${mimeType};base64,${base64Content}`;
        setImageUrl(url);
        
        // Get image dimensions and file size
        const img = new Image();
        img.onload = () => {
          const info: ImageInfo = {
            width: img.naturalWidth,
            height: img.naturalHeight,
            fileSize: Math.round(base64Content.length * 0.75),
            format: props.name.split(".").pop()?.toUpperCase() || "Unknown"
          };
          setImageInfo(info);
          props.onImageLoad?.(info);
          setLoading(false);
        };
        img.onerror = () => {
          setError("Failed to decode image");
          setLoading(false);
        };
        img.src = url;
      } catch (e) {
        console.error("Failed to load image:", e);
        setError(e instanceof Error ? e.message : "Failed to load image");
        setLoading(false);
      }
    };
    
    loadImage();
  });

  // Clean up blob URL when component unmounts or path changes
  onCleanup(() => {
    const url = imageUrl();
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  });

  // Pan handlers
  const handleMouseDown = (e: MouseEvent) => {
    if (props.zoomMode !== "custom" && props.zoom <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset().x, y: e.clientY - panOffset().y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isPanning()) return;
    e.preventDefault();
    setPanOffset({
      x: e.clientX - panStart().x,
      y: e.clientY - panStart().y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Reset pan when zoom mode changes
  createEffect(() => {
    if (props.zoomMode === "fit") {
      setPanOffset({ x: 0, y: 0 });
    }
  });

  // Compute image style based on zoom mode
  const imageStyle = createMemo(() => {
    const zoom = props.zoom;
    const offset = panOffset();
    
    if (props.zoomMode === "fit") {
      return {
        "max-width": "100%",
        "max-height": "100%",
        width: "auto",
        height: "auto",
        transform: "translate(0, 0)"
      };
    }
    
    if (props.zoomMode === "actual") {
      return {
        width: "auto",
        height: "auto",
        transform: `translate(${offset.x}px, ${offset.y}px)`
      };
    }
    
    // Custom zoom
    return {
      width: "auto",
      height: "auto",
      transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`
    };
  });

  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* Image container */}
      <div 
        ref={containerRef}
        class="flex-1 flex items-center justify-center overflow-hidden relative"
        style={{ 
          background: "var(--background-stronger)",
          cursor: (props.zoomMode === "custom" || props.zoom > 1) ? (isPanning() ? "grabbing" : "grab") : "default"
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Checkered background for transparency */}
        <div 
          class="absolute inset-0 pointer-events-none"
          style={{
            "background-image": `
              linear-gradient(45deg, var(--cortex-bg-hover) 25%, transparent 25%),
              linear-gradient(-45deg, var(--cortex-bg-hover) 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, var(--cortex-bg-hover) 75%),
              linear-gradient(-45deg, transparent 75%, var(--cortex-bg-hover) 75%)
            `,
            "background-size": "20px 20px",
            "background-position": "0 0, 0 10px, 10px -10px, -10px 0px",
            opacity: 0.3
          }}
        />

        <Show when={loading()}>
          <div class="absolute inset-0 flex items-center justify-center z-10">
            <div class="flex flex-col items-center gap-3">
              <div 
                class="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ "border-color": "var(--border-weak)", "border-top-color": "transparent" }}
              />
              <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
                Loading image...
              </span>
            </div>
          </div>
        </Show>

        <Show when={error()}>
          <div class="flex flex-col items-center gap-2" style={{ color: "var(--error)" }}>
            <Icon name="image" class="w-10 h-10 opacity-50" />
            <span class="text-sm">{error()}</span>
          </div>
        </Show>

        <Show when={!loading() && !error() && imageUrl()}>
          <img
            ref={imageRef}
            src={imageUrl()!}
            alt={props.name}
            class="select-none"
            style={imageStyle()}
            draggable={false}
          />
        </Show>
      </div>

      {/* Image info bar */}
      <Show when={props.showInfo && imageInfo()}>
        <div 
          class="h-6 flex items-center justify-center gap-4 text-xs border-t shrink-0"
          style={{ 
            background: "var(--surface-base)",
            "border-color": "var(--border-weak)",
            color: "var(--text-weak)"
          }}
        >
          <span>{imageInfo()!.width} × {imageInfo()!.height}</span>
          <span>•</span>
          <span>{formatFileSize(imageInfo()!.fileSize)}</span>
          <span>•</span>
          <span>{imageInfo()!.format}</span>
        </div>
      </Show>
    </div>
  );
}

export function ImageViewer(props: ImageViewerProps) {
  const [zoom, setZoom] = createSignal(1);
  const [zoomMode, setZoomMode] = createSignal<ZoomMode>("fit");
  const [showInfo, setShowInfo] = createSignal(true);
  const [primaryImageInfo, setPrimaryImageInfo] = createSignal<ImageInfo | null>(null);
  const [copyStatus, setCopyStatus] = createSignal<"idle" | "copying" | "success" | "error">("idle");

  // Zoom controls
  const zoomIn = () => {
    setZoomMode("custom");
    setZoom(z => Math.min(z * 1.25, 10));
  };

  const zoomOut = () => {
    setZoomMode("custom");
    setZoom(z => Math.max(z / 1.25, 0.1));
  };

  const fitToWindow = () => {
    setZoomMode("fit");
    setZoom(1);
  };

  const actualSize = () => {
    setZoomMode("actual");
    setZoom(1);
  };

  const resetView = () => {
    fitToWindow();
  };

  // Copy image to clipboard
  const copyImage = async () => {
    setCopyStatus("copying");
    try {
      // Read the image using Tauri
      const base64Content = await fsReadFileBinary(props.path);
      const mimeType = getImageMimeType(props.name);
      
      // Convert base64 to blob
      const binaryString = atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });

      // Try to use clipboard API
      if (navigator.clipboard && "write" in navigator.clipboard) {
        const item = new ClipboardItem({ [mimeType]: blob });
        await navigator.clipboard.write([item]);
        setCopyStatus("success");
      } else {
        // Fallback: Try using Tauri clipboard plugin
        const { writeImage } = await import("@tauri-apps/plugin-clipboard-manager");
        await writeImage(base64Content);
        setCopyStatus("success");
      }
      
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (e) {
      console.error("Failed to copy image:", e);
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  };

  // Open in external app
  const openExternal = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(props.path);
    } catch (e) {
      console.error("Failed to open external app:", e);
      // Fallback: try to open as URL
      window.open(`file://${props.path}`, "_blank");
    }
  };

  // Zoom percentage display
  const zoomPercent = createMemo(() => {
    if (zoomMode() === "fit") return "Fit";
    return `${Math.round(zoom() * 100)}%`;
  });

  const isComparing = () => !!props.compareWith;

  return (
    <div class="flex-1 flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div 
        class="h-9 flex items-center justify-between px-2 border-b shrink-0"
        style={{ 
          background: "var(--surface-base)",
          "border-color": "var(--border-weak)"
        }}
      >
        {/* Left: File info */}
        <div class="flex items-center gap-2">
          <Icon name="image" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          <span class="text-xs" style={{ color: "var(--text-base)" }}>
            {props.name}
          </span>
          <Show when={primaryImageInfo()}>
            <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
              ({primaryImageInfo()!.width} × {primaryImageInfo()!.height})
            </span>
          </Show>
        </div>

        {/* Center: Zoom controls */}
        <div class="flex items-center gap-1">
          <button
            onClick={zoomOut}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Zoom Out (Ctrl+-)"
          >
            <Icon name="magnifying-glass-minus" class="w-4 h-4" />
          </button>

          <span 
            class="w-14 text-center text-xs tabular-nums"
            style={{ color: "var(--text-base)" }}
          >
            {zoomPercent()}
          </span>

          <button
            onClick={zoomIn}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Zoom In (Ctrl++)"
          >
            <Icon name="magnifying-glass-plus" class="w-4 h-4" />
          </button>

          <div class="w-px h-4 mx-1" style={{ background: "var(--border-weak)" }} />

          <button
            onClick={fitToWindow}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ 
              color: zoomMode() === "fit" ? "var(--accent)" : "var(--text-weak)"
            }}
            title="Fit to Window"
          >
            <Icon name="minimize" class="w-4 h-4" />
          </button>

          <button
            onClick={actualSize}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ 
              color: zoomMode() === "actual" ? "var(--accent)" : "var(--text-weak)"
            }}
            title="Actual Size (100%)"
          >
            <Icon name="maximize" class="w-4 h-4" />
          </button>

          <button
            onClick={resetView}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Reset View"
          >
            <Icon name="rotate-right" class="w-4 h-4" />
          </button>
        </div>

        {/* Right: Actions */}
        <div class="flex items-center gap-1">
          <button
            onClick={() => setShowInfo(!showInfo())}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ 
              color: showInfo() ? "var(--accent)" : "var(--text-weak)"
            }}
            title="Toggle Image Info"
          >
            <Icon name="circle-info" class="w-4 h-4" />
          </button>

          <button
            onClick={props.onCompareRequest}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ 
              color: isComparing() ? "var(--accent)" : "var(--text-weak)"
            }}
            title="Compare Images"
          >
            <Icon name="columns" class="w-4 h-4" />
          </button>

          <div class="w-px h-4 mx-1" style={{ background: "var(--border-weak)" }} />

          <button
            onClick={copyImage}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)] relative"
            style={{ 
              color: copyStatus() === "success" ? "var(--cortex-success)" : 
                     copyStatus() === "error" ? "var(--error)" : 
                     "var(--text-weak)"
            }}
            title="Copy Image to Clipboard"
            disabled={copyStatus() === "copying"}
          >
            <Icon name="copy" class={`w-4 h-4 ${copyStatus() === "copying" ? "animate-pulse" : ""}`} />
          </button>

          <button
            onClick={openExternal}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Open in External Application"
          >
            <Icon name="arrow-up-right-from-square" class="w-4 h-4" />
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

      {/* Image display area */}
      <Show 
        when={isComparing() && props.compareWith}
        fallback={
          <ImagePanel
            path={props.path}
            name={props.name}
            showInfo={showInfo()}
            zoom={zoom()}
            zoomMode={zoomMode()}
            onImageLoad={setPrimaryImageInfo}
          />
        }
      >
        <div class="flex-1 flex overflow-hidden">
          {/* Left image */}
          <div class="flex-1 flex flex-col border-r" style={{ "border-color": "var(--border-weak)" }}>
            <div 
              class="h-6 flex items-center justify-center text-xs border-b shrink-0"
              style={{ 
                background: "var(--surface-raised)", 
                "border-color": "var(--border-weak)",
                color: "var(--text-weak)"
              }}
            >
              {props.name}
            </div>
            <ImagePanel
              path={props.path}
              name={props.name}
              showInfo={showInfo()}
              zoom={zoom()}
              zoomMode={zoomMode()}
              onImageLoad={setPrimaryImageInfo}
            />
          </div>

          {/* Right image (comparison) */}
          <div class="flex-1 flex flex-col">
            <div 
              class="h-6 flex items-center justify-center text-xs border-b shrink-0"
              style={{ 
                background: "var(--surface-raised)", 
                "border-color": "var(--border-weak)",
                color: "var(--text-weak)"
              }}
            >
              {props.compareWith!.name}
            </div>
            <ImagePanel
              path={props.compareWith!.path}
              name={props.compareWith!.name}
              showInfo={showInfo()}
              zoom={zoom()}
              zoomMode={zoomMode()}
            />
          </div>
        </div>
      </Show>
    </div>
  );
}

export default ImageViewer;

