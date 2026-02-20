import { 
  Show, 
  For, 
  createSignal, 
  createEffect, 
  createMemo, 
  onMount, 
  onCleanup,
  JSX 
} from "solid-js";
import { createStore } from "solid-js/store";
import { Icon } from "../ui/Icon";
import { MonacoManager } from "@/utils/monacoManager";
import type * as Monaco from "monaco-editor";

export type SVGBackground = "transparent" | "white" | "dark" | "checkerboard";
export type ViewMode = "preview" | "code" | "split";

interface SVGElement {
  tag: string;
  id: string;
  attributes: Record<string, string>;
  path: number[];
}

interface SVGDimensions {
  width: number;
  height: number;
  viewBox: string | null;
}

interface SVGPreviewState {
  zoom: number;
  background: SVGBackground;
  viewMode: ViewMode;
  selectedElement: SVGElement | null;
  showInspector: boolean;
  dimensions: SVGDimensions | null;
  error: string | null;
}

interface SVGPreviewProps {
  content: string;
  filePath: string;
  fileName: string;
  onContentChange?: (content: string) => void;
  onClose?: () => void;
}

const ZOOM_LEVELS = [25, 50, 75, 100, 125, 150, 200, 300, 400];
const MIN_ZOOM = 10;
const MAX_ZOOM = 500;

function parseSVGElements(svgContent: string): SVGElement[] {
  const elements: SVGElement[] = [];
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");
    const parserError = doc.querySelector("parsererror");
    
    if (parserError) {
      return elements;
    }
    
    const traverse = (node: Element, path: number[]) => {
      const id = node.getAttribute("id") || `${node.tagName}-${path.join("-")}`;
      const attributes: Record<string, string> = {};
      
      for (const attr of Array.from(node.attributes)) {
        attributes[attr.name] = attr.value;
      }
      
      elements.push({
        tag: node.tagName.toLowerCase(),
        id,
        attributes,
        path: [...path],
      });
      
      const children = Array.from(node.children);
      children.forEach((child, index) => {
        traverse(child, [...path, index]);
      });
    };
    
    const svgRoot = doc.querySelector("svg");
    if (svgRoot) {
      traverse(svgRoot, [0]);
    }
  } catch {
    // Return empty array on parse error
  }
  
  return elements;
}

function parseSVGDimensions(svgContent: string): SVGDimensions | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");
    const svg = doc.querySelector("svg");
    
    if (!svg) return null;
    
    const widthAttr = svg.getAttribute("width");
    const heightAttr = svg.getAttribute("height");
    const viewBox = svg.getAttribute("viewBox");
    
    let width = 0;
    let height = 0;
    
    if (widthAttr) {
      width = parseFloat(widthAttr.replace(/[^0-9.]/g, "")) || 0;
    }
    if (heightAttr) {
      height = parseFloat(heightAttr.replace(/[^0-9.]/g, "")) || 0;
    }
    
    if ((!width || !height) && viewBox) {
      const parts = viewBox.split(/\s+|,/).map(parseFloat);
      if (parts.length >= 4) {
        width = width || parts[2];
        height = height || parts[3];
      }
    }
    
    return { width, height, viewBox };
  } catch {
    return null;
  }
}

function validateSVG(content: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "image/svg+xml");
    const parserError = doc.querySelector("parsererror");
    
    if (parserError) {
      return parserError.textContent || "Invalid SVG";
    }
    
    const svg = doc.querySelector("svg");
    if (!svg) {
      return "No SVG element found";
    }
    
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Failed to parse SVG";
  }
}

export function SVGPreview(props: SVGPreviewProps) {
  let previewContainerRef: HTMLDivElement | undefined;
  let editorContainerRef: HTMLDivElement | undefined;
  let editorInstance: Monaco.editor.IStandaloneCodeEditor | null = null;
  
  const [state, setState] = createStore<SVGPreviewState>({
    zoom: 100,
    background: "checkerboard",
    viewMode: "split",
    selectedElement: null,
    showInspector: false,
    dimensions: null,
    error: null,
  });
  
  const [localContent, setLocalContent] = createSignal(props.content);
  const [_isEditorReady, setIsEditorReady] = createSignal(false);
  const [splitRatio, setSplitRatio] = createSignal(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = createSignal(false);
  
  const elements = createMemo(() => parseSVGElements(localContent()));
  
  // Update dimensions and validate SVG when content changes
  createEffect(() => {
    const content = localContent();
    const dimensions = parseSVGDimensions(content);
    const error = validateSVG(content);
    
    setState({ dimensions, error });
  });
  
  // Sync with external content changes
  createEffect(() => {
    if (props.content !== localContent()) {
      setLocalContent(props.content);
      if (editorInstance) {
        const currentValue = editorInstance.getValue();
        if (currentValue !== props.content) {
          editorInstance.setValue(props.content);
        }
      }
    }
  });
  
  // Initialize Monaco editor
  onMount(async () => {
    if (state.viewMode === "preview") return;
    
    const monaco = await MonacoManager.getInstance().ensureLoaded();
    
    if (!editorContainerRef) return;
    
    monaco.editor.defineTheme("svg-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "tag", foreground: "569cd6" },
        { token: "attribute.name", foreground: "9cdcfe" },
        { token: "attribute.value", foreground: "ce9178" },
        { token: "delimiter", foreground: "808080" },
        { token: "comment", foreground: "6a9955", fontStyle: "italic" },
      ],
      colors: {
        "editor.background": "var(--ui-panel-bg)",
        "editor.foreground": "var(--cortex-text-primary)",
        "editor.lineHighlightBackground": "var(--cortex-bg-hover)",
        "editor.selectionBackground": "var(--cortex-info-bg)",
        "editorLineNumber.foreground": "var(--cortex-bg-active)",
      },
    });
    
    editorInstance = monaco.editor.create(editorContainerRef, {
      value: localContent(),
      language: "xml",
      theme: "svg-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      lineHeight: 20,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      tabSize: 2,
      wordWrap: "on",
      scrollBeyondLastLine: false,
      renderLineHighlight: "line",
      padding: { top: 8, bottom: 8 },
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
    });
    
    // Register content change handler (editorInstance is guaranteed to be non-null here)
    const editor = editorInstance;
    editor.onDidChangeModelContent(() => {
      const newContent = editor.getValue();
      setLocalContent(newContent);
      props.onContentChange?.(newContent);
    });
    
    setIsEditorReady(true);
  });
  
  onCleanup(() => {
    editorInstance?.dispose?.();
    editorInstance = null;
  });
  
  // Zoom controls
  const handleZoomIn = () => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= state.zoom);
    const nextIndex = Math.min(currentIndex + 1, ZOOM_LEVELS.length - 1);
    setState("zoom", ZOOM_LEVELS[nextIndex] || MAX_ZOOM);
  };
  
  const handleZoomOut = () => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= state.zoom);
    const prevIndex = Math.max(currentIndex - 1, 0);
    setState("zoom", ZOOM_LEVELS[prevIndex] || MIN_ZOOM);
  };
  
  const handleZoomReset = () => {
    setState("zoom", 100);
  };
  
  const handleZoomToFit = () => {
    if (!previewContainerRef || !state.dimensions) return;
    
    const containerRect = previewContainerRef.getBoundingClientRect();
    const padding = 40;
    const availableWidth = containerRect.width - padding * 2;
    const availableHeight = containerRect.height - padding * 2;
    
    const scaleX = availableWidth / state.dimensions.width;
    const scaleY = availableHeight / state.dimensions.height;
    const scale = Math.min(scaleX, scaleY);
    
    const newZoom = Math.round(scale * 100);
    setState("zoom", Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom)));
  };
  
  // Wheel zoom handler
  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoom + delta));
      setState("zoom", newZoom);
    }
  };
  
  // Background toggle
  const cycleBackground = () => {
    const backgrounds: SVGBackground[] = ["checkerboard", "transparent", "white", "dark"];
    const currentIndex = backgrounds.indexOf(state.background);
    const nextIndex = (currentIndex + 1) % backgrounds.length;
    setState("background", backgrounds[nextIndex]);
  };
  
  // View mode toggle
  const setViewMode = (mode: ViewMode) => {
    setState("viewMode", mode);
  };
  
  // Export as PNG
  const exportAsPNG = async () => {
    const svgContent = localContent();
    if (state.error) return;
    
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      
      const img = new Image();
      const svgBlob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });
      
      const scale = 2;
      canvas.width = (state.dimensions?.width || img.width) * scale;
      canvas.height = (state.dimensions?.height || img.height) * scale;
      
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      
      URL.revokeObjectURL(url);
      
      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = props.fileName.replace(/\.svg$/i, ".png");
      link.href = pngUrl;
      link.click();
    } catch (e) {
      console.error("Failed to export PNG:", e);
    }
  };
  
  // Element selection
  const handleElementClick = (element: SVGElement) => {
    setState("selectedElement", element);
  };
  
  // Split drag handling
  const handleSplitMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplit(true);
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDraggingSplit()) return;
    
    const container = previewContainerRef?.parentElement;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const newRatio = (e.clientX - rect.left) / rect.width;
    setSplitRatio(Math.max(0.2, Math.min(0.8, newRatio)));
  };
  
  const handleMouseUp = () => {
    setIsDraggingSplit(false);
  };
  
  onMount(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  });
  
  onCleanup(() => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  });
  
  // Background style
  const getBackgroundStyle = (): JSX.CSSProperties => {
    switch (state.background) {
      case "white":
        return { background: "var(--cortex-text-primary)" };
      case "dark":
        return { background: "var(--ui-panel-bg)" };
      case "transparent":
        return { background: "transparent" };
      case "checkerboard":
      default:
        return {
          background: `
            linear-gradient(45deg, var(--cortex-bg-hover) 25%, transparent 25%),
            linear-gradient(-45deg, var(--cortex-bg-hover) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, var(--cortex-bg-hover) 75%),
            linear-gradient(-45deg, transparent 75%, var(--cortex-bg-hover) 75%)
          `,
          "background-size": "20px 20px",
          "background-position": "0 0, 0 10px, 10px -10px, -10px 0px",
          "background-color": "var(--cortex-bg-primary)",
        };
    }
  };
  
  // Create SVG data URL for preview
  const svgDataUrl = createMemo(() => {
    const content = localContent();
    if (state.error) return "";
    
    try {
      const encoded = encodeURIComponent(content);
      return `data:image/svg+xml,${encoded}`;
    } catch {
      return "";
    }
  });

  return (
    <div 
      class="h-full flex flex-col overflow-hidden"
      style={{ background: "var(--background-base)" }}
    >
      {/* Toolbar */}
      <div 
        class="shrink-0 h-10 flex items-center justify-between px-3 border-b"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-center gap-1">
          {/* View mode buttons */}
          <div 
            class="flex items-center rounded overflow-hidden border"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <button
              onClick={() => setViewMode("code")}
              class="p-1.5 transition-colors"
              style={{ 
                background: state.viewMode === "code" ? "var(--surface-raised)" : "transparent",
                color: state.viewMode === "code" ? "var(--text-base)" : "var(--text-weak)",
              }}
              title="Code view"
            >
              <Icon name="code" class="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("split")}
              class="p-1.5 transition-colors"
              style={{ 
                background: state.viewMode === "split" ? "var(--surface-raised)" : "transparent",
                color: state.viewMode === "split" ? "var(--text-base)" : "var(--text-weak)",
              }}
              title="Split view"
            >
              <Icon name="columns" class="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("preview")}
              class="p-1.5 transition-colors"
              style={{ 
                background: state.viewMode === "preview" ? "var(--surface-raised)" : "transparent",
                color: state.viewMode === "preview" ? "var(--text-base)" : "var(--text-weak)",
              }}
              title="Preview view"
            >
              <Icon name="eye" class="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div class="w-px h-5 mx-1" style={{ background: "var(--border-weak)" }} />
          
          {/* Zoom controls */}
          <button
            onClick={handleZoomOut}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Zoom out"
          >
            <Icon name="magnifying-glass-minus" class="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={handleZoomReset}
            class="px-2 py-1 rounded text-xs font-mono transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)", "min-width": "50px" }}
            title="Reset zoom"
          >
            {state.zoom}%
          </button>
          
          <button
            onClick={handleZoomIn}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Zoom in"
          >
            <Icon name="magnifying-glass-plus" class="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={handleZoomToFit}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ color: "var(--text-weak)" }}
            title="Fit to view"
          >
            <Icon name="maximize" class="w-3.5 h-3.5" />
          </button>
          
          <div class="w-px h-5 mx-1" style={{ background: "var(--border-weak)" }} />
          
          {/* Background toggle */}
          <button
            onClick={cycleBackground}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)] flex items-center gap-1"
            style={{ color: "var(--text-weak)" }}
            title={`Background: ${state.background}`}
          >
            <Icon name="layer-group" class="w-3.5 h-3.5" />
            <span class="text-xs">{state.background}</span>
          </button>
        </div>
        
        <div class="flex items-center gap-1">
          {/* Dimensions display */}
          <Show when={state.dimensions}>
            <div 
              class="px-2 py-1 text-xs font-mono rounded"
              style={{ 
                background: "var(--surface-raised)",
                color: "var(--text-weak)",
              }}
            >
              {state.dimensions!.width} × {state.dimensions!.height}
              <Show when={state.dimensions!.viewBox}>
                <span style={{ color: "var(--text-weaker)" }}> ({state.dimensions!.viewBox})</span>
              </Show>
            </div>
          </Show>
          
          {/* Element inspector toggle */}
          <button
            onClick={() => setState("showInspector", !state.showInspector)}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
            style={{ 
              color: state.showInspector ? "var(--accent)" : "var(--text-weak)",
            }}
            title="Element inspector"
          >
            <Icon name="circle-info" class="w-3.5 h-3.5" />
          </button>
          
          {/* Export as PNG */}
          <button
            onClick={exportAsPNG}
            disabled={!!state.error}
            class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-50"
            style={{ color: "var(--text-weak)" }}
            title="Export as PNG"
          >
            <Icon name="download" class="w-3.5 h-3.5" />
          </button>
          
          {/* Close button */}
          <Show when={props.onClose}>
            <button
              onClick={props.onClose}
              class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title="Close preview"
            >
              <Icon name="xmark" class="w-3.5 h-3.5" />
            </button>
          </Show>
        </div>
      </div>
      
      {/* Main content area */}
      <div class="flex-1 flex overflow-hidden min-h-0">
        {/* Code editor panel */}
        <Show when={state.viewMode === "code" || state.viewMode === "split"}>
          <div 
            class="flex flex-col overflow-hidden"
            style={{ 
              width: state.viewMode === "split" ? `${splitRatio() * 100}%` : "100%",
              "min-width": state.viewMode === "split" ? "200px" : undefined,
            }}
          >
            <div 
              ref={editorContainerRef}
              class="flex-1"
              style={{ background: "var(--ui-panel-bg)" }}
            />
          </div>
        </Show>
        
        {/* Split divider */}
        <Show when={state.viewMode === "split"}>
          <div
            class="shrink-0 w-1 cursor-col-resize transition-colors"
            style={{ 
              background: isDraggingSplit() ? "var(--accent)" : "var(--border-weak)",
            }}
            onMouseDown={handleSplitMouseDown}
          />
        </Show>
        
        {/* Preview panel */}
        <Show when={state.viewMode === "preview" || state.viewMode === "split"}>
          <div 
            class="flex-1 flex flex-col overflow-hidden min-w-0"
            style={{ "min-width": state.viewMode === "split" ? "200px" : undefined }}
          >
            {/* Error display */}
            <Show when={state.error}>
              <div 
                class="p-4 text-center"
                style={{ 
                  background: "rgba(220, 38, 38, 0.1)",
                  color: "var(--cortex-error)",
                }}
              >
                <p class="text-sm font-medium">Invalid SVG</p>
                <p class="text-xs mt-1 opacity-80">{state.error}</p>
              </div>
            </Show>
            
            {/* SVG preview */}
            <Show when={!state.error}>
              <div 
                ref={previewContainerRef}
                class="flex-1 overflow-auto flex items-center justify-center"
                style={getBackgroundStyle()}
                onWheel={handleWheel}
              >
                <div
                  style={{
                    transform: `scale(${state.zoom / 100})`,
                    "transform-origin": "center center",
                    transition: "transform 0.1s ease",
                  }}
                >
                  <img 
                    src={svgDataUrl()}
                    alt="SVG Preview"
                    style={{
                      "max-width": "none",
                      display: "block",
                    }}
                    draggable={false}
                  />
                </div>
              </div>
            </Show>
          </div>
        </Show>
        
        {/* Element inspector panel */}
        <Show when={state.showInspector}>
          <div 
            class="w-64 shrink-0 flex flex-col border-l overflow-hidden"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <div 
              class="h-8 flex items-center justify-between px-3 border-b shrink-0"
              style={{ 
                background: "var(--surface-base)",
                "border-color": "var(--border-weak)",
              }}
            >
              <span class="text-xs font-medium" style={{ color: "var(--text-base)" }}>
                Elements
              </span>
              <span 
                class="text-xs px-1.5 py-0.5 rounded"
                style={{ 
                  background: "var(--surface-raised)",
                  color: "var(--text-weak)",
                }}
              >
                {elements().length}
              </span>
            </div>
            
            <div class="flex-1 overflow-y-auto">
              <ElementTree 
                elements={elements()} 
                selectedId={state.selectedElement?.id || null}
                onSelect={handleElementClick}
              />
            </div>
            
            {/* Selected element details */}
            <Show when={state.selectedElement}>
              <div 
                class="shrink-0 border-t p-3 max-h-[200px] overflow-y-auto"
                style={{ "border-color": "var(--border-weak)" }}
              >
                <div class="text-xs font-medium mb-2" style={{ color: "var(--text-base)" }}>
                  &lt;{state.selectedElement!.tag}&gt;
                </div>
                <div class="space-y-1">
                  <For each={Object.entries(state.selectedElement!.attributes)}>
                    {([key, value]) => (
                      <div class="text-xs">
                        <span style={{ color: "var(--text-weak)" }}>{key}=</span>
                        <span 
                          class="font-mono break-all"
                          style={{ color: "var(--cortex-syntax-string)" }}
                        >
                          "{value}"
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}

interface ElementTreeProps {
  elements: SVGElement[];
  selectedId: string | null;
  onSelect: (element: SVGElement) => void;
}

function ElementTree(props: ElementTreeProps) {
  return (
    <div class="p-2">
      <For each={props.elements}>
        {(element) => (
          <button
            onClick={() => props.onSelect(element)}
            class="w-full text-left px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--surface-raised)]"
            style={{
              "padding-left": `${8 + element.path.length * 12}px`,
              background: props.selectedId === element.id ? "var(--surface-raised)" : "transparent",
              color: props.selectedId === element.id ? "var(--text-base)" : "var(--text-weak)",
            }}
          >
            <span style={{ color: "var(--cortex-syntax-keyword)" }}>&lt;{element.tag}</span>
            <Show when={element.attributes.id}>
              <span style={{ color: "var(--text-weaker)" }}> id=</span>
              <span style={{ color: "var(--cortex-syntax-string)" }}>"{element.attributes.id}"</span>
            </Show>
            <span style={{ color: "var(--cortex-syntax-keyword)" }}>&gt;</span>
          </button>
        )}
      </For>
    </div>
  );
}

/**
 * Checks if a file path is an SVG file
 */
export function isSVGFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".svg");
}

/**
 * Hook to detect if current file should show SVG preview
 */
export function shouldShowSVGPreview(filePath: string | null | undefined): boolean {
  if (!filePath) return false;
  return isSVGFile(filePath);
}

export default SVGPreview;

