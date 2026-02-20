/**
 * =============================================================================
 * USE TERMINAL IMAGES - Hook for managing terminal inline images
 * =============================================================================
 *
 * Manages terminal image state including:
 * - Image storage with LRU eviction
 * - Memory management and size limits
 * - Position tracking for scroll synchronization
 * - Image lifecycle (add, remove, clear)
 *
 * Usage:
 *   const images = useTerminalImages({
 *     terminalId: "term_1",
 *     enabled: true,
 *     maxImages: 50,
 *     maxImageSize: 10 * 1024 * 1024, // 10MB
 *   });
 * =============================================================================
 */

import { onCleanup, Accessor, createMemo } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { InlineImage } from "@/utils/terminalImageProtocols";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Image with additional rendering metadata
 */
export interface TerminalImage extends InlineImage {
  /** Rendered width in pixels */
  renderedWidth: number;
  /** Rendered height in pixels */
  renderedHeight: number;
  /** Whether this image is visible in viewport */
  visible: boolean;
  /** Last access time for LRU eviction */
  lastAccessed: number;
  /** Estimated memory size in bytes */
  memorySize: number;
  /** Whether the image data has been loaded */
  loaded: boolean;
  /** Error message if loading failed */
  error?: string;
}

/**
 * Configuration options for the hook
 */
export interface UseTerminalImagesOptions {
  /** Terminal ID this hook is managing images for */
  terminalId: string;
  /** Whether image support is enabled */
  enabled: boolean;
  /** Maximum number of images to keep in memory */
  maxImages: number;
  /** Maximum total memory size in bytes */
  maxTotalMemory: number;
  /** Maximum size for a single image in bytes */
  maxImageSize: number;
  /** Callback when image is clicked */
  onImageClick?: (image: TerminalImage) => void;
  /** Callback when image fails to load */
  onImageError?: (image: TerminalImage, error: Error) => void;
}

/**
 * Return value from the hook
 */
export interface UseTerminalImagesReturn {
  /** All images for this terminal */
  images: Accessor<TerminalImage[]>;
  /** Visible images only */
  visibleImages: Accessor<TerminalImage[]>;
  /** Total memory usage */
  totalMemory: Accessor<number>;
  /** Image count */
  imageCount: Accessor<number>;
  /** Add a new image */
  addImage: (image: InlineImage) => TerminalImage | null;
  /** Remove an image by ID */
  removeImage: (id: string) => void;
  /** Clear all images */
  clearImages: () => void;
  /** Update image position */
  updatePosition: (id: string, row: number, col: number) => void;
  /** Update visibility based on scroll position */
  updateVisibility: (visibleRowRange: { start: number; end: number }) => void;
  /** Mark image as accessed (for LRU) */
  markAccessed: (id: string) => void;
  /** Get image by ID */
  getImage: (id: string) => TerminalImage | undefined;
  /** Check if terminal has any images */
  hasImages: Accessor<boolean>;
  /** Download an image */
  downloadImage: (id: string) => void;
  /** Copy image to clipboard */
  copyImageToClipboard: (id: string) => Promise<boolean>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MAX_IMAGES = 50;
const DEFAULT_MAX_TOTAL_MEMORY = 100 * 1024 * 1024; // 100MB
const DEFAULT_MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Estimate memory size from base64 data
 */
function estimateMemorySize(base64Data: string): number {
  // Base64 is ~33% larger than binary, so approximate binary size
  // Then account for decoded image in memory (roughly 4 bytes per pixel for RGBA)
  const binarySize = Math.ceil((base64Data.length * 3) / 4);
  // Assume average compression ratio of 10:1 for PNG/JPEG
  return binarySize * 10;
}

/**
 * Calculate rendered dimensions based on size units and cell dimensions
 */
function calculateRenderedDimensions(
  image: InlineImage,
  cellWidth: number,
  cellHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = image.width;
  let height = image.height;

  // Convert to pixels based on unit
  if (image.widthUnit === "cells") {
    width = image.width * cellWidth;
  } else if (image.widthUnit === "percent") {
    width = (image.width / 100) * maxWidth;
  }

  if (image.heightUnit === "cells") {
    height = image.height * cellHeight;
  } else if (image.heightUnit === "percent") {
    height = (image.height / 100) * maxHeight;
  }

  // Apply aspect ratio preservation
  if (image.preserveAspectRatio && image.width > 0 && image.height > 0) {
    const aspectRatio = image.width / image.height;
    
    // Fit within max dimensions
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
  }

  // Ensure minimum size
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));

  return { width, height };
}

/**
 * Create data URL from base64 and mime type
 */
function createDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

// =============================================================================
// HOOK
// =============================================================================

export function useTerminalImages(options: UseTerminalImagesOptions): UseTerminalImagesReturn {
  const {
    terminalId: _terminalId, // Reserved for future per-terminal tracking
    enabled,
    maxImages = DEFAULT_MAX_IMAGES,
    maxTotalMemory = DEFAULT_MAX_TOTAL_MEMORY,
    maxImageSize = DEFAULT_MAX_IMAGE_SIZE,
    onImageClick: _onImageClick, // Reserved for future click handling
    onImageError: _onImageError, // Reserved for future error handling
  } = options;

  // Image store
  const [store, setStore] = createStore<{
    images: Map<string, TerminalImage>;
    order: string[]; // For LRU ordering
  }>({
    images: new Map(),
    order: [],
  });

  // Derived signals
  const images = createMemo(() => {
    const imageArray: TerminalImage[] = [];
    store.order.forEach((id) => {
      const img = store.images.get(id);
      if (img) {
        imageArray.push(img);
      }
    });
    return imageArray;
  });

  const visibleImages = createMemo(() => {
    return images().filter((img) => img.visible);
  });

  const totalMemory = createMemo(() => {
    let total = 0;
    store.images.forEach((img) => {
      total += img.memorySize;
    });
    return total;
  });

  const imageCount = createMemo(() => store.images.size);
  const hasImages = createMemo(() => store.images.size > 0);

  /**
   * Evict images to stay within limits
   */
  const evictIfNeeded = (newImageSize: number = 0): void => {
    // Check image count limit
    while (store.order.length >= maxImages) {
      const oldestId = store.order[0];
      if (oldestId) {
        removeImage(oldestId);
      }
    }

    // Check memory limit
    let currentMemory = totalMemory();
    while (currentMemory + newImageSize > maxTotalMemory && store.order.length > 0) {
      const oldestId = store.order[0];
      if (oldestId) {
        const img = store.images.get(oldestId);
        if (img) {
          currentMemory -= img.memorySize;
        }
        removeImage(oldestId);
      }
    }
  };

  /**
   * Add a new image
   */
  const addImage = (image: InlineImage): TerminalImage | null => {
    if (!enabled) {
      return null;
    }

    // Check if image already exists
    if (store.images.has(image.id)) {
      markAccessed(image.id);
      return store.images.get(image.id)!;
    }

    // Estimate memory size
    const memorySize = estimateMemorySize(image.data);

    // Check single image size limit
    if (memorySize > maxImageSize) {
      console.warn(
        `[TerminalImages] Image ${image.id} exceeds max size (${memorySize} > ${maxImageSize})`
      );
      return null;
    }

    // Evict old images if needed
    evictIfNeeded(memorySize);

    // Calculate rendered dimensions (using defaults - will be updated when rendered)
    const dims = calculateRenderedDimensions(image, 9, 17, 800, 600);

    const terminalImage: TerminalImage = {
      ...image,
      renderedWidth: dims.width,
      renderedHeight: dims.height,
      visible: true,
      lastAccessed: Date.now(),
      memorySize,
      loaded: false,
    };

    setStore(
      produce((s) => {
        s.images.set(image.id, terminalImage);
        s.order.push(image.id);
      })
    );

    return terminalImage;
  };

  /**
   * Remove an image by ID
   */
  const removeImage = (id: string): void => {
    setStore(
      produce((s) => {
        s.images.delete(id);
        const idx = s.order.indexOf(id);
        if (idx !== -1) {
          s.order.splice(idx, 1);
        }
      })
    );
  };

  /**
   * Clear all images
   */
  const clearImages = (): void => {
    setStore({
      images: new Map(),
      order: [],
    });
  };

  /**
   * Update image position
   */
  const updatePosition = (id: string, row: number, col: number): void => {
    setStore(
      produce((s) => {
        const img = s.images.get(id);
        if (img) {
          img.position = { row, col };
        }
      })
    );
  };

  /**
   * Update visibility based on scroll position
   */
  const updateVisibility = (visibleRowRange: { start: number; end: number }): void => {
    setStore(
      produce((s) => {
        s.images.forEach((img) => {
          const imageEndRow = img.position.row + Math.ceil(img.renderedHeight / 17); // Approximate rows
          img.visible =
            img.position.row <= visibleRowRange.end && imageEndRow >= visibleRowRange.start;
        });
      })
    );
  };

  /**
   * Mark image as accessed (moves to end of LRU queue)
   */
  const markAccessed = (id: string): void => {
    setStore(
      produce((s) => {
        const img = s.images.get(id);
        if (img) {
          img.lastAccessed = Date.now();

          // Move to end of order
          const idx = s.order.indexOf(id);
          if (idx !== -1 && idx !== s.order.length - 1) {
            s.order.splice(idx, 1);
            s.order.push(id);
          }
        }
      })
    );
  };

  /**
   * Get image by ID
   */
  const getImage = (id: string): TerminalImage | undefined => {
    return store.images.get(id);
  };

  /**
   * Download an image
   */
  const downloadImage = (id: string): void => {
    const img = store.images.get(id);
    if (!img) return;

    const dataUrl = createDataUrl(img.data, img.mimeType || "image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = img.filename || `terminal-image-${img.id}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Copy image to clipboard
   */
  const copyImageToClipboard = async (id: string): Promise<boolean> => {
    const img = store.images.get(id);
    if (!img) return false;

    try {
      // Create blob from base64
      const binary = atob(img.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: img.mimeType || "image/png" });

      // Use clipboard API
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);

      return true;
    } catch (e) {
      console.error("[TerminalImages] Failed to copy image to clipboard:", e);
      return false;
    }
  };

  // Clean up on unmount
  onCleanup(() => {
    clearImages();
  });

  return {
    images,
    visibleImages,
    totalMemory,
    imageCount,
    addImage,
    removeImage,
    clearImages,
    updatePosition,
    updateVisibility,
    markAccessed,
    getImage,
    hasImages,
    downloadImage,
    copyImageToClipboard,
  };
}

// =============================================================================
// ADDITIONAL UTILITIES
// =============================================================================

/**
 * Create a preloader for terminal images
 */
export function createImagePreloader() {
  const cache = new Map<string, HTMLImageElement>();

  return {
    /**
     * Preload an image
     */
    preload: (image: TerminalImage): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        if (cache.has(image.id)) {
          resolve(cache.get(image.id)!);
          return;
        }

        const img = new Image();
        img.onload = () => {
          cache.set(image.id, img);
          resolve(img);
        };
        img.onerror = (e) => {
          reject(new Error(`Failed to load image: ${e}`));
        };
        img.src = createDataUrl(image.data, image.mimeType || "image/png");
      });
    },

    /**
     * Get cached image
     */
    get: (id: string): HTMLImageElement | undefined => {
      return cache.get(id);
    },

    /**
     * Clear cache
     */
    clear: (): void => {
      cache.clear();
    },

    /**
     * Remove from cache
     */
    remove: (id: string): void => {
      cache.delete(id);
    },
  };
}

export default useTerminalImages;
