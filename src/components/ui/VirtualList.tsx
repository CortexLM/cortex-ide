/**
 * VirtualList - Efficient virtualized list component for SolidJS
 * 
 * Only renders items that are visible in the viewport, dramatically improving
 * performance for large lists (100+ items).
 * 
 * Features:
 * - Fixed or variable item heights
 * - Smooth scrolling
 * - Overscan for smoother scroll experience
 * - Minimal re-renders using SolidJS fine-grained reactivity
 */

import { createSignal, createMemo, For, onMount, onCleanup, JSX, Accessor } from "solid-js";

export interface VirtualListProps<T> {
  /** Array of items to render */
  items: T[] | Accessor<T[]>;
  /** Fixed height for each item in pixels */
  itemHeight: number;
  /** Height of the container (can be "100%" or pixel value) */
  height: string | number;
  /** Number of items to render above/below visible area for smoother scrolling */
  overscan?: number;
  /** Render function for each item */
  children: (item: T, index: Accessor<number>) => JSX.Element;
  /** Optional class for the container */
  class?: string;
  /** Optional style for the container */
  style?: JSX.CSSProperties;
  /** Called when scrolled near the end (for infinite loading) */
  onEndReached?: () => void;
  /** Threshold in pixels for onEndReached */
  endReachedThreshold?: number;
}

export function VirtualList<T>(props: VirtualListProps<T>) {
  let containerRef: HTMLDivElement | undefined;
  const [scrollTop, setScrollTop] = createSignal(0);
  const overscan = props.overscan ?? 3;
  const endThreshold = props.endReachedThreshold ?? 200;
  
  // Get items as array (handle both static and reactive)
  const getItems = () => {
    const items = props.items;
    return typeof items === 'function' ? items() : items;
  };
  
  // Calculate total height of all items
  const totalHeight = createMemo(() => getItems().length * props.itemHeight);
  
  // Get container height in pixels
  const containerHeight = createMemo(() => {
    if (typeof props.height === 'number') return props.height;
    if (containerRef) return containerRef.clientHeight;
    return 400; // Default fallback
  });
  
  // Calculate visible range with overscan
  const visibleRange = createMemo(() => {
    const items = getItems();
    const scroll = scrollTop();
    const height = containerHeight();
    
    const startIndex = Math.max(0, Math.floor(scroll / props.itemHeight) - overscan);
    const endIndex = Math.min(
      items.length,
      Math.ceil((scroll + height) / props.itemHeight) + overscan
    );
    
    return { startIndex, endIndex };
  });
  
  // Get visible items with their indices
  const visibleItems = createMemo(() => {
    const items = getItems();
    const { startIndex, endIndex } = visibleRange();
    
    return items.slice(startIndex, endIndex).map((item, i) => ({
      item,
      index: startIndex + i,
    }));
  });
  
  // Handle scroll events
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
    
    // Check if near end for infinite loading
    if (props.onEndReached) {
      const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (scrollBottom < endThreshold) {
        props.onEndReached();
      }
    }
  };
  
  // Set up resize observer to handle container resize
  onMount(() => {
    if (!containerRef) return;
    
    const resizeObserver = new ResizeObserver(() => {
      // Force recalculation by reading scrollTop
      setScrollTop(containerRef?.scrollTop ?? 0);
    });
    
    resizeObserver.observe(containerRef);
    
    onCleanup(() => resizeObserver.disconnect());
  });
  
  return (
    <div
      ref={containerRef}
      class={props.class}
      style={{
        height: typeof props.height === 'number' ? `${props.height}px` : props.height,
        overflow: "auto",
        position: "relative",
        ...props.style,
      }}
      onScroll={handleScroll}
    >
      {/* Spacer to create scrollable area */}
      <div style={{ height: `${totalHeight()}px`, position: "relative" }}>
        {/* Visible items positioned absolutely */}
        <div
          style={{
            position: "absolute",
            top: `${visibleRange().startIndex * props.itemHeight}px`,
            left: 0,
            right: 0,
          }}
        >
          <For each={visibleItems()}>
            {({ item, index }) => (
              <div style={{ height: `${props.itemHeight}px` }}>
                {props.children(item, () => index)}
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

/**
 * VirtualListVariable - For lists with variable item heights
 * Uses estimation and measurement for accurate positioning
 */
export interface VirtualListVariableProps<T> {
  items: T[] | Accessor<T[]>;
  /** Estimated average item height for initial render */
  estimatedItemHeight: number;
  height: string | number;
  overscan?: number;
  children: (item: T, index: Accessor<number>) => JSX.Element;
  class?: string;
  style?: JSX.CSSProperties;
  /** Get unique key for item (for height caching) */
  getKey?: (item: T, index: number) => string | number;
}

export function VirtualListVariable<T>(props: VirtualListVariableProps<T>) {
  let containerRef: HTMLDivElement | undefined;
  const [scrollTop, setScrollTop] = createSignal(0);
  const [measuredHeights, setMeasuredHeights] = createSignal<Map<string | number, number>>(new Map());
  const overscan = props.overscan ?? 3;
  
  const getItems = () => {
    const items = props.items;
    return typeof items === 'function' ? items() : items;
  };
  
  const getKey = (item: T, index: number) => {
    if (props.getKey) return props.getKey(item, index);
    return index;
  };
  
  // Get height for an item (measured or estimated)
  const getItemHeight = (item: T, index: number) => {
    const key = getKey(item, index);
    return measuredHeights().get(key) ?? props.estimatedItemHeight;
  };
  
  // Calculate cumulative heights for positioning
  const itemPositions = createMemo(() => {
    const items = getItems();
    const positions: number[] = [];
    let offset = 0;
    
    for (let i = 0; i < items.length; i++) {
      positions.push(offset);
      offset += getItemHeight(items[i], i);
    }
    
    return { positions, totalHeight: offset };
  });
  
  // Binary search to find start index
  const findStartIndex = (scrollTop: number) => {
    const { positions } = itemPositions();
    let low = 0;
    let high = positions.length - 1;
    
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (positions[mid] < scrollTop) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    
    return Math.max(0, low - 1);
  };
  
  // Calculate visible range
  const visibleRange = createMemo(() => {
    const items = getItems();
    const scroll = scrollTop();
    const height = typeof props.height === 'number' ? props.height : containerRef?.clientHeight ?? 400;
    const { positions, totalHeight } = itemPositions();
    
    const startIndex = Math.max(0, findStartIndex(scroll) - overscan);
    
    // Find end index
    let endIndex = startIndex;
    const endScroll = scroll + height;
    while (endIndex < items.length && positions[endIndex] < endScroll) {
      endIndex++;
    }
    endIndex = Math.min(items.length, endIndex + overscan);
    
    return { startIndex, endIndex, totalHeight };
  });
  
  // Get visible items
  const visibleItems = createMemo(() => {
    const items = getItems();
    const { startIndex, endIndex } = visibleRange();
    const { positions } = itemPositions();
    
    return items.slice(startIndex, endIndex).map((item, i) => ({
      item,
      index: startIndex + i,
      top: positions[startIndex + i] ?? 0,
    }));
  });
  
  // Measure rendered items
  const measureItem = (key: string | number, element: HTMLDivElement) => {
    const height = element.offsetHeight;
    const current = measuredHeights();
    if (current.get(key) !== height) {
      setMeasuredHeights(new Map(current).set(key, height));
    }
  };
  
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  };
  
  return (
    <div
      ref={containerRef}
      class={props.class}
      style={{
        height: typeof props.height === 'number' ? `${props.height}px` : props.height,
        overflow: "auto",
        position: "relative",
        ...props.style,
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: `${visibleRange().totalHeight}px`, position: "relative" }}>
        <For each={visibleItems()}>
          {({ item, index, top }) => {
            const key = getKey(item, index);
            return (
              <div
                ref={(el) => measureItem(key, el)}
                style={{
                  position: "absolute",
                  top: `${top}px`,
                  left: 0,
                  right: 0,
                }}
              >
                {props.children(item, () => index)}
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

export default VirtualList;
