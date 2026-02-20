import { Component, createSignal, createEffect, JSX, splitProps, onCleanup } from 'solid-js';

// Cache for loaded SVG content
const svgCache = new Map<string, string>();

// Cache for failed icons to avoid retrying
const failedIcons = new Set<string>();

// Pending fetches to deduplicate concurrent requests
const pendingFetches = new Map<string, Promise<string | null>>();

// Request queue to limit concurrent fetches
let activeFetches = 0;
const MAX_CONCURRENT_FETCHES = 4;
const fetchQueue: Array<() => void> = [];

function processQueue() {
  while (fetchQueue.length > 0 && activeFetches < MAX_CONCURRENT_FETCHES) {
    const next = fetchQueue.shift();
    if (next) next();
  }
}

// Icon name mapping from various libraries to Font Awesome
import { getIconName } from '../../utils/iconMap';

export interface IconProps extends JSX.SvgSVGAttributes<SVGSVGElement> {
  name: string;
  size?: number | string;
  color?: string;
  class?: string;
  fallback?: JSX.Element;
}

/**
 * Icon component that loads Font Awesome Pro Light SVGs
 * 
 * Usage:
 * <Icon name="chevron-right" size={16} />
 * <Icon name="FiChevronRight" size={16} /> // Auto-mapped from Feather
 * <Icon name="folder" color="var(--text-secondary)" />
 */
export const Icon: Component<IconProps> = (props) => {
  const [local, svgProps] = splitProps(props, ['name', 'size', 'color', 'class', 'fallback']);
  const [svgContent, setSvgContent] = createSignal<string | null>(null);
  const [viewBox, setViewBox] = createSignal<string>('0 0 512 512');
  const [error, setError] = createSignal(false);

  // Track if component is still mounted
  let mounted = true;
  onCleanup(() => { mounted = false; });

  // Resolve the icon name (handles mapping from Fi/Vs/Tb prefixes)
  const resolvedName = () => getIconName(local.name);

  const loadIcon = async (iconName: string): Promise<string | null> => {
    // Check if already failed
    if (failedIcons.has(iconName)) {
      return null;
    }

    // Check cache
    if (svgCache.has(iconName)) {
      return svgCache.get(iconName)!;
    }

    // Check if already fetching
    if (pendingFetches.has(iconName)) {
      return pendingFetches.get(iconName)!;
    }

    // Create new fetch with queue
    const fetchPromise = new Promise<string | null>((resolve) => {
      const doFetch = async () => {
        activeFetches++;
        try {
          const svgPath = `/kit-a943e80cf4-desktop/svgs-full/light/${iconName}.svg`;
          const response = await fetch(svgPath);
          
          if (!response.ok) {
            failedIcons.add(iconName);
            resolve(null);
            return;
          }

          const svgText = await response.text();
          svgCache.set(iconName, svgText);
          resolve(svgText);
        } catch {
          failedIcons.add(iconName);
          resolve(null);
        } finally {
          activeFetches--;
          pendingFetches.delete(iconName);
          processQueue();
        }
      };

      if (activeFetches < MAX_CONCURRENT_FETCHES) {
        doFetch();
      } else {
        fetchQueue.push(doFetch);
      }
    });

    pendingFetches.set(iconName, fetchPromise);
    return fetchPromise;
  };

  createEffect(() => {
    const iconName = resolvedName();
    if (!iconName) {
      setError(true);
      return;
    }

    // Check cache synchronously first
    if (svgCache.has(iconName)) {
      parseSvgContent(svgCache.get(iconName)!);
      return;
    }

    // Check if already failed
    if (failedIcons.has(iconName)) {
      setError(true);
      return;
    }

    // Load async
    loadIcon(iconName).then((svgText) => {
      if (!mounted) return;
      if (svgText) {
        parseSvgContent(svgText);
      } else {
        setError(true);
      }
    });
  });

  const parseSvgContent = (svgText: string) => {
    // Extract viewBox
    const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/);
    if (viewBoxMatch) {
      setViewBox(viewBoxMatch[1]);
    }

    // Extract path content (everything inside the svg tag)
    const pathMatch = svgText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
    if (pathMatch) {
      setSvgContent(pathMatch[1]);
    }

    setError(false);
  };

  const sizeValue = () => {
    if (local.size === undefined) return '1em';
    if (typeof local.size === 'number') return `${local.size}px`;
    return local.size;
  };

  return (
    <>
      {error() && local.fallback ? (
        local.fallback
      ) : (
        <svg
          {...svgProps}
          class={local.class}
          viewBox={viewBox()}
          width={sizeValue()}
          height={sizeValue()}
          fill={local.color || 'currentColor'}
          style={{
            display: 'inline-block',
            'vertical-align': 'middle',
            ...(typeof svgProps.style === 'object' ? svgProps.style : {})
          }}
          innerHTML={svgContent() || ''}
        />
      )}
    </>
  );
};

/**
 * Preload icons for better performance
 * Call this during app initialization with commonly used icons
 */
export const preloadIcons = async (iconNames: string[]): Promise<void> => {
  const promises = iconNames.map(async (name) => {
    const resolvedName = getIconName(name);
    if (!resolvedName || svgCache.has(resolvedName)) return;

    try {
      const svgPath = `/kit-a943e80cf4-desktop/svgs-full/light/${resolvedName}.svg`;
      const response = await fetch(svgPath);
      if (response.ok) {
        const svgText = await response.text();
        svgCache.set(resolvedName, svgText);
      }
    } catch (err) {
      // Silently fail for preloading
    }
  });

  await Promise.all(promises);
};

/**
 * Clear the icon cache (useful for memory management)
 */
export const clearIconCache = (): void => {
  svgCache.clear();
};

export default Icon;
