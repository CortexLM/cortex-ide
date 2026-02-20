/**
 * =============================================================================
 * TERMINAL IMAGE RENDERER - Inline image support for terminal
 * =============================================================================
 *
 * Renders inline images within the terminal as canvas overlays.
 * Supports:
 * - iTerm2 inline images protocol
 * - Sixel graphics (common in Linux)
 * - Kitty graphics protocol
 *
 * Features:
 * - Position synchronization with terminal scroll
 * - Lazy loading for performance
 * - Click to enlarge/download
 * - Context menu for image actions
 *
 * Usage:
 *   <TerminalImageRenderer
 *     terminalId="term_1"
 *     images={imageAccessor}
 *     cellWidth={9}
 *     cellHeight={17}
 *     scrollOffset={scrollTop}
 *     containerRef={containerElement}
 *   />
 * =============================================================================
 */

import {
  createSignal,
  createEffect,
  createMemo,
  For,
  Show,
  onCleanup,
  JSX,
  Accessor,
} from "solid-js";
import { tokens } from "@/design-system/tokens";
import type { TerminalImage } from "@/hooks/useTerminalImages";

// =============================================================================
// TYPES
// =============================================================================

export interface TerminalImageRendererProps {
  /** Terminal ID this renderer belongs to */
  terminalId: string;
  /** Images to render */
  images: Accessor<TerminalImage[]>;
  /** Width of a terminal cell in pixels */
  cellWidth: number;
  /** Height of a terminal cell in pixels */
  cellHeight: number;
  /** Current scroll offset in pixels */
  scrollOffset?: Accessor<number>;
  /** Reference to the terminal container */
  containerRef?: HTMLElement;
  /** Maximum width for images */
  maxImageWidth?: number;
  /** Maximum height for images */
  maxImageHeight?: number;
  /** Callback when image is clicked */
  onImageClick?: (image: TerminalImage) => void;
  /** Callback when image is double-clicked */
  onImageDoubleClick?: (image: TerminalImage) => void;
  /** Callback to download image */
  onDownload?: (image: TerminalImage) => void;
  /** Callback to copy image to clipboard */
  onCopy?: (image: TerminalImage) => void;
}

interface ImageRenderState {
  loaded: boolean;
  error: string | null;
  naturalWidth: number;
  naturalHeight: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MAX_IMAGE_WIDTH = 800;
const DEFAULT_MAX_IMAGE_HEIGHT = 600;
const CONTEXT_MENU_WIDTH = 160;

// =============================================================================
// IMAGE ITEM COMPONENT
// =============================================================================

interface ImageItemProps {
  image: TerminalImage;
  cellWidth: number;
  cellHeight: number;
  scrollOffset: number;
  maxWidth: number;
  maxHeight: number;
  onClick?: (image: TerminalImage) => void;
  onDoubleClick?: (image: TerminalImage) => void;
  onDownload?: (image: TerminalImage) => void;
  onCopy?: (image: TerminalImage) => void;
}

function ImageItem(props: ImageItemProps) {
  const [state, setState] = createSignal<ImageRenderState>({
    loaded: false,
    error: null,
    naturalWidth: 0,
    naturalHeight: 0,
  });
  const [showContextMenu, setShowContextMenu] = createSignal(false);
  const [contextMenuPos, setContextMenuPos] = createSignal({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = createSignal(false);

  let imageRef: HTMLImageElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  // Calculate position based on cell coordinates and scroll
  const position = createMemo(() => {
    const x = props.image.position.col * props.cellWidth;
    const y = props.image.position.row * props.cellHeight - props.scrollOffset;
    return { x, y };
  });

  // Calculate rendered dimensions
  const dimensions = createMemo(() => {
    const imgState = state();
    if (!imgState.loaded) {
      return {
        width: props.image.renderedWidth || 100,
        height: props.image.renderedHeight || 100,
      };
    }

    let width = imgState.naturalWidth;
    let height = imgState.naturalHeight;

    // Apply size from image spec
    if (props.image.widthUnit === "cells") {
      width = props.image.width * props.cellWidth;
    } else if (props.image.widthUnit === "percent") {
      width = (props.image.width / 100) * props.maxWidth;
    } else if (props.image.width > 0) {
      width = props.image.width;
    }

    if (props.image.heightUnit === "cells") {
      height = props.image.height * props.cellHeight;
    } else if (props.image.heightUnit === "percent") {
      height = (props.image.height / 100) * props.maxHeight;
    } else if (props.image.height > 0) {
      height = props.image.height;
    }

    // Preserve aspect ratio if requested
    if (props.image.preserveAspectRatio && imgState.naturalWidth > 0 && imgState.naturalHeight > 0) {
      const aspectRatio = imgState.naturalWidth / imgState.naturalHeight;

      if (width / height > aspectRatio) {
        width = height * aspectRatio;
      } else {
        height = width / aspectRatio;
      }
    }

    // Apply max constraints
    if (width > props.maxWidth) {
      const scale = props.maxWidth / width;
      width = props.maxWidth;
      height *= scale;
    }
    if (height > props.maxHeight) {
      const scale = props.maxHeight / height;
      height = props.maxHeight;
      width *= scale;
    }

    return { width: Math.round(width), height: Math.round(height) };
  });

  // Create data URL for image
  const dataUrl = createMemo(() => {
    const mimeType = props.image.mimeType || "image/png";
    return `data:${mimeType};base64,${props.image.data}`;
  });

  // Handle image load
  const handleLoad = () => {
    if (imageRef) {
      setState({
        loaded: true,
        error: null,
        naturalWidth: imageRef.naturalWidth,
        naturalHeight: imageRef.naturalHeight,
      });
    }
  };

  // Handle image error
  const handleError = () => {
    setState({
      loaded: false,
      error: "Failed to load image",
      naturalWidth: 0,
      naturalHeight: 0,
    });
  };

  // Handle context menu
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  // Close context menu on click outside
  createEffect(() => {
    if (!showContextMenu()) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef && !containerRef.contains(e.target as Node)) {
        setShowContextMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
  });

  // Styles
  const containerStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: `${position().x}px`,
    top: `${position().y}px`,
    width: `${dimensions().width}px`,
    height: `${dimensions().height}px`,
    "z-index": "50",
    cursor: "pointer",
    transition: "transform 150ms ease, box-shadow 150ms ease",
    transform: isHovered() ? "scale(1.02)" : "scale(1)",
    "box-shadow": isHovered() ? tokens.shadows.popup : "none",
    "border-radius": tokens.radius.sm,
    overflow: "hidden",
  });

  const imageStyle = (): JSX.CSSProperties => ({
    width: "100%",
    height: "100%",
    "object-fit": props.image.preserveAspectRatio ? "contain" : "fill",
    display: "block",
  });

  const loadingStyle: JSX.CSSProperties = {
    position: "absolute",
    inset: "0",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: tokens.colors.surface.panel,
    color: tokens.colors.text.muted,
    "font-size": "11px",
  };

  const errorStyle: JSX.CSSProperties = {
    position: "absolute",
    inset: "0",
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    background: `color-mix(in srgb, ${tokens.colors.semantic.error} 10%, ${tokens.colors.surface.panel})`,
    color: tokens.colors.semantic.error,
    "font-size": "11px",
    padding: tokens.spacing.sm,
    "text-align": "center",
  };

  const contextMenuStyle = (): JSX.CSSProperties => ({
    position: "fixed",
    left: `${contextMenuPos().x}px`,
    top: `${contextMenuPos().y}px`,
    width: `${CONTEXT_MENU_WIDTH}px`,
    background: tokens.colors.surface.popup,
    border: `1px solid ${tokens.colors.border.default}`,
    "border-radius": tokens.radius.md,
    "box-shadow": tokens.shadows.popup,
    "z-index": "1000",
    overflow: "hidden",
  });

  const menuItemStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    background: "transparent",
    border: "none",
    width: "100%",
    "text-align": "left",
    color: tokens.colors.text.primary,
    "font-size": "12px",
    cursor: "pointer",
    transition: "background 150ms ease",
  };

  return (
    <div
      ref={containerRef}
      style={containerStyle()}
      onClick={() => props.onClick?.(props.image)}
      onDblClick={() => props.onDoubleClick?.(props.image)}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-image-id={props.image.id}
    >
      {/* Loading state */}
      <Show when={!state().loaded && !state().error}>
        <div style={loadingStyle}>Loading image...</div>
      </Show>

      {/* Error state */}
      <Show when={state().error}>
        <div style={errorStyle}>
          <span>{state().error}</span>
          <button
            style={{
              "margin-top": tokens.spacing.sm,
              padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
              background: tokens.colors.surface.popup,
              border: `1px solid ${tokens.colors.border.default}`,
              "border-radius": tokens.radius.sm,
              color: tokens.colors.text.primary,
              cursor: "pointer",
              "font-size": "10px",
            }}
            onClick={(e) => {
              e.stopPropagation();
              props.onDownload?.(props.image);
            }}
          >
            Download Raw
          </button>
        </div>
      </Show>

      {/* Image */}
      <img
        ref={imageRef}
        src={dataUrl()}
        alt={props.image.filename || "Terminal image"}
        style={imageStyle()}
        onLoad={handleLoad}
        onError={handleError}
        draggable={false}
      />

      {/* Context menu */}
      <Show when={showContextMenu()}>
        <div style={contextMenuStyle()}>
          <button
            style={menuItemStyle}
            onClick={(e) => {
              e.stopPropagation();
              props.onCopy?.(props.image);
              setShowContextMenu(false);
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = tokens.colors.interactive.hover;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = "transparent";
            }}
          >
            Copy Image
          </button>
          <button
            style={menuItemStyle}
            onClick={(e) => {
              e.stopPropagation();
              props.onDownload?.(props.image);
              setShowContextMenu(false);
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = tokens.colors.interactive.hover;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = "transparent";
            }}
          >
            Download
          </button>
          <button
            style={menuItemStyle}
            onClick={(e) => {
              e.stopPropagation();
              window.open(dataUrl(), "_blank");
              setShowContextMenu(false);
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = tokens.colors.interactive.hover;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = "transparent";
            }}
          >
            Open in New Tab
          </button>
          <div
            style={{
              height: "1px",
              background: tokens.colors.border.divider,
              margin: `${tokens.spacing.xs} 0`,
            }}
          />
          <button
            style={{
              ...menuItemStyle,
              color: tokens.colors.text.muted,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setShowContextMenu(false);
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = tokens.colors.interactive.hover;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = "transparent";
            }}
          >
            {`${dimensions().width} x ${dimensions().height}`}
          </button>
        </div>
      </Show>
    </div>
  );
}

// =============================================================================
// IMAGE LIGHTBOX COMPONENT
// =============================================================================

interface ImageLightboxProps {
  image: TerminalImage | null;
  onClose: () => void;
  onDownload?: (image: TerminalImage) => void;
  onCopy?: (image: TerminalImage) => void;
}

function ImageLightbox(props: ImageLightboxProps) {
  // Handle escape key
  createEffect(() => {
    if (!props.image) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        props.onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const overlayStyle: JSX.CSSProperties = {
    position: "fixed",
    inset: "0",
    background: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "z-index": "10000",
    cursor: "zoom-out",
  };

  const contentStyle: JSX.CSSProperties = {
    position: "relative",
    "max-width": "90vw",
    "max-height": "90vh",
    cursor: "auto",
  };

  const imageStyle: JSX.CSSProperties = {
    "max-width": "100%",
    "max-height": "90vh",
    "object-fit": "contain",
    "border-radius": tokens.radius.md,
    "box-shadow": tokens.shadows.modal,
  };

  const toolbarStyle: JSX.CSSProperties = {
    position: "absolute",
    bottom: "-40px",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: tokens.spacing.md,
    padding: tokens.spacing.sm,
    background: tokens.colors.surface.popup,
    "border-radius": tokens.radius.md,
    "box-shadow": tokens.shadows.popup,
  };

  const buttonStyle: JSX.CSSProperties = {
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    background: tokens.colors.interactive.hover,
    border: "none",
    "border-radius": tokens.radius.sm,
    color: tokens.colors.text.primary,
    "font-size": "12px",
    cursor: "pointer",
  };

  return (
    <Show when={props.image}>
      <div style={overlayStyle} onClick={props.onClose}>
        <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
          <img
            src={`data:${props.image!.mimeType || "image/png"};base64,${props.image!.data}`}
            alt={props.image!.filename || "Terminal image"}
            style={imageStyle}
          />
          <div style={toolbarStyle}>
            <button
              style={buttonStyle}
              onClick={() => props.onCopy?.(props.image!)}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = tokens.colors.interactive.active;
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = tokens.colors.interactive.hover;
              }}
            >
              Copy
            </button>
            <button
              style={buttonStyle}
              onClick={() => props.onDownload?.(props.image!)}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = tokens.colors.interactive.active;
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = tokens.colors.interactive.hover;
              }}
            >
              Download
            </button>
            <button
              style={buttonStyle}
              onClick={props.onClose}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = tokens.colors.interactive.active;
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = tokens.colors.interactive.hover;
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

// =============================================================================
// MAIN RENDERER COMPONENT
// =============================================================================

export function TerminalImageRenderer(props: TerminalImageRendererProps) {
  const [lightboxImage, setLightboxImage] = createSignal<TerminalImage | null>(null);

  const scrollOffset = createMemo(() => props.scrollOffset?.() ?? 0);
  const maxWidth = () => props.maxImageWidth ?? DEFAULT_MAX_IMAGE_WIDTH;
  const maxHeight = () => props.maxImageHeight ?? DEFAULT_MAX_IMAGE_HEIGHT;

  // Filter visible images
  const visibleImages = createMemo(() => {
    return props.images().filter((img) => img.visible !== false);
  });

  // Handle image click - show lightbox
  const handleImageClick = (image: TerminalImage) => {
    props.onImageClick?.(image);
  };

  const handleImageDoubleClick = (image: TerminalImage) => {
    if (props.onImageDoubleClick) {
      props.onImageDoubleClick(image);
    } else {
      setLightboxImage(image);
    }
  };

  // Container style
  const containerStyle: JSX.CSSProperties = {
    position: "absolute",
    inset: "0",
    "pointer-events": "none",
    overflow: "hidden",
  };

  const imagesContainerStyle: JSX.CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    "pointer-events": "auto",
  };

  return (
    <>
      <div style={containerStyle} data-terminal-images={props.terminalId}>
        <div style={imagesContainerStyle}>
          <For each={visibleImages()}>
            {(image) => (
              <ImageItem
                image={image}
                cellWidth={props.cellWidth}
                cellHeight={props.cellHeight}
                scrollOffset={scrollOffset()}
                maxWidth={maxWidth()}
                maxHeight={maxHeight()}
                onClick={handleImageClick}
                onDoubleClick={handleImageDoubleClick}
                onDownload={props.onDownload}
                onCopy={props.onCopy}
              />
            )}
          </For>
        </div>
      </div>

      {/* Lightbox for enlarged view */}
      <ImageLightbox
        image={lightboxImage()}
        onClose={() => setLightboxImage(null)}
        onDownload={props.onDownload}
        onCopy={props.onCopy}
      />
    </>
  );
}

export default TerminalImageRenderer;
