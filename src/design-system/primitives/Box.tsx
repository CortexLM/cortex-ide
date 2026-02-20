/**
 * =============================================================================
 * BOX - The foundational layout primitive
 * =============================================================================
 * 
 * Box is the most basic layout component. It renders a div with style props
 * that map directly to CSS properties. All other layout primitives are built
 * on top of Box.
 * 
 * Usage:
 *   <Box padding="md" background="surface.panel" borderRadius="md">
 *     Content here
 *   </Box>
 * =============================================================================
 */

import { JSX, splitProps, ParentProps } from "solid-js";
import { tokens } from "../tokens";

// =============================================================================
// TYPES
// =============================================================================

type SpacingValue = keyof typeof tokens.spacing | number | string;
type ColorValue = string;
type RadiusValue = keyof typeof tokens.radius | string;

export interface BoxProps extends ParentProps {
  // Display
  display?: JSX.CSSProperties["display"];
  
  // Spacing
  padding?: SpacingValue;
  paddingX?: SpacingValue;
  paddingY?: SpacingValue;
  paddingTop?: SpacingValue;
  paddingRight?: SpacingValue;
  paddingBottom?: SpacingValue;
  paddingLeft?: SpacingValue;
  margin?: SpacingValue;
  marginX?: SpacingValue;
  marginY?: SpacingValue;
  marginTop?: SpacingValue;
  marginRight?: SpacingValue;
  marginBottom?: SpacingValue;
  marginLeft?: SpacingValue;
  gap?: SpacingValue;
  
  // Sizing
  width?: string | number;
  height?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  minHeight?: string | number;
  maxHeight?: string | number;
  
  // Colors
  background?: ColorValue;
  color?: ColorValue;
  borderColor?: ColorValue;
  
  // Border
  border?: string;
  borderWidth?: string | number;
  borderStyle?: JSX.CSSProperties["border-style"];
  borderRadius?: RadiusValue;
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  
  // Positioning
  position?: JSX.CSSProperties["position"];
  top?: string | number;
  right?: string | number;
  bottom?: string | number;
  left?: string | number;
  zIndex?: number | string;
  
  // Overflow
  overflow?: JSX.CSSProperties["overflow"];
  overflowX?: JSX.CSSProperties["overflow-x"];
  overflowY?: JSX.CSSProperties["overflow-y"];
  
  // Flex item
  flex?: string | number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: string;
  alignSelf?: JSX.CSSProperties["align-self"];
  
  // Other
  opacity?: number;
  cursor?: JSX.CSSProperties["cursor"];
  pointerEvents?: JSX.CSSProperties["pointer-events"];
  userSelect?: JSX.CSSProperties["user-select"];
  transition?: string;
  transform?: string;
  boxShadow?: string;
  
  // HTML attributes
  style?: JSX.CSSProperties;
  class?: string;
  id?: string;
  ref?: HTMLDivElement | ((el: HTMLDivElement) => void);
  
  // Events
  onClick?: JSX.EventHandler<HTMLDivElement, MouseEvent>;
  onMouseEnter?: JSX.EventHandler<HTMLDivElement, MouseEvent>;
  onMouseLeave?: JSX.EventHandler<HTMLDivElement, MouseEvent>;
  onMouseDown?: JSX.EventHandler<HTMLDivElement, MouseEvent>;
  onMouseUp?: JSX.EventHandler<HTMLDivElement, MouseEvent>;
  
  // Data attributes
  "data-testid"?: string;
  [key: `data-${string}`]: string | undefined;
}

// =============================================================================
// UTILITIES
// =============================================================================

function resolveSpacing(value: SpacingValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return `${value}px`;
  if (value in tokens.spacing) return tokens.spacing[value as keyof typeof tokens.spacing];
  return value;
}

function resolveRadius(value: RadiusValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value in tokens.radius) return tokens.radius[value as keyof typeof tokens.radius];
  return value;
}

function resolveSize(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return `${value}px`;
  return value;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function Box(props: BoxProps) {
  const [local, rest] = splitProps(props, [
    "children",
    "display",
    "padding",
    "paddingX",
    "paddingY",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "margin",
    "marginX",
    "marginY",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "gap",
    "width",
    "height",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
    "background",
    "color",
    "borderColor",
    "border",
    "borderWidth",
    "borderStyle",
    "borderRadius",
    "borderTop",
    "borderRight",
    "borderBottom",
    "borderLeft",
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "zIndex",
    "overflow",
    "overflowX",
    "overflowY",
    "flex",
    "flexGrow",
    "flexShrink",
    "flexBasis",
    "alignSelf",
    "opacity",
    "cursor",
    "pointerEvents",
    "userSelect",
    "transition",
    "transform",
    "boxShadow",
    "style",
    "class",
  ]);

  const computedStyle = (): JSX.CSSProperties => {
    const style: JSX.CSSProperties = {};
    
    // Display
    if (local.display) style.display = local.display;
    
    // Padding
    if (local.padding) {
      const p = resolveSpacing(local.padding);
      style.padding = p;
    }
    if (local.paddingX) {
      const px = resolveSpacing(local.paddingX);
      style["padding-left"] = px;
      style["padding-right"] = px;
    }
    if (local.paddingY) {
      const py = resolveSpacing(local.paddingY);
      style["padding-top"] = py;
      style["padding-bottom"] = py;
    }
    if (local.paddingTop) style["padding-top"] = resolveSpacing(local.paddingTop);
    if (local.paddingRight) style["padding-right"] = resolveSpacing(local.paddingRight);
    if (local.paddingBottom) style["padding-bottom"] = resolveSpacing(local.paddingBottom);
    if (local.paddingLeft) style["padding-left"] = resolveSpacing(local.paddingLeft);
    
    // Margin
    if (local.margin) {
      const m = resolveSpacing(local.margin);
      style.margin = m;
    }
    if (local.marginX) {
      const mx = resolveSpacing(local.marginX);
      style["margin-left"] = mx;
      style["margin-right"] = mx;
    }
    if (local.marginY) {
      const my = resolveSpacing(local.marginY);
      style["margin-top"] = my;
      style["margin-bottom"] = my;
    }
    if (local.marginTop) style["margin-top"] = resolveSpacing(local.marginTop);
    if (local.marginRight) style["margin-right"] = resolveSpacing(local.marginRight);
    if (local.marginBottom) style["margin-bottom"] = resolveSpacing(local.marginBottom);
    if (local.marginLeft) style["margin-left"] = resolveSpacing(local.marginLeft);
    
    // Gap
    if (local.gap) style.gap = resolveSpacing(local.gap);
    
    // Sizing
    if (local.width) style.width = resolveSize(local.width);
    if (local.height) style.height = resolveSize(local.height);
    if (local.minWidth) style["min-width"] = resolveSize(local.minWidth);
    if (local.maxWidth) style["max-width"] = resolveSize(local.maxWidth);
    if (local.minHeight) style["min-height"] = resolveSize(local.minHeight);
    if (local.maxHeight) style["max-height"] = resolveSize(local.maxHeight);
    
    // Colors
    if (local.background) style.background = local.background;
    if (local.color) style.color = local.color;
    
    // Border
    if (local.border) style.border = local.border;
    if (local.borderWidth) style["border-width"] = resolveSize(local.borderWidth);
    if (local.borderStyle) style["border-style"] = local.borderStyle;
    if (local.borderColor) style["border-color"] = local.borderColor;
    if (local.borderRadius) style["border-radius"] = resolveRadius(local.borderRadius);
    if (local.borderTop) style["border-top"] = local.borderTop;
    if (local.borderRight) style["border-right"] = local.borderRight;
    if (local.borderBottom) style["border-bottom"] = local.borderBottom;
    if (local.borderLeft) style["border-left"] = local.borderLeft;
    
    // Positioning
    if (local.position) style.position = local.position;
    if (local.top !== undefined) style.top = resolveSize(local.top);
    if (local.right !== undefined) style.right = resolveSize(local.right);
    if (local.bottom !== undefined) style.bottom = resolveSize(local.bottom);
    if (local.left !== undefined) style.left = resolveSize(local.left);
    if (local.zIndex !== undefined) style["z-index"] = local.zIndex;
    
    // Overflow
    if (local.overflow) style.overflow = local.overflow;
    if (local.overflowX) style["overflow-x"] = local.overflowX;
    if (local.overflowY) style["overflow-y"] = local.overflowY;
    
    // Flex item
    if (local.flex !== undefined) style.flex = String(local.flex);
    if (local.flexGrow !== undefined) style["flex-grow"] = String(local.flexGrow);
    if (local.flexShrink !== undefined) style["flex-shrink"] = String(local.flexShrink);
    if (local.flexBasis) style["flex-basis"] = local.flexBasis;
    if (local.alignSelf) style["align-self"] = local.alignSelf;
    
    // Other
    if (local.opacity !== undefined) style.opacity = String(local.opacity);
    if (local.cursor) style.cursor = local.cursor;
    if (local.pointerEvents) style["pointer-events"] = local.pointerEvents;
    if (local.userSelect) style["user-select"] = local.userSelect;
    if (local.transition) style.transition = local.transition;
    if (local.transform) style.transform = local.transform;
    if (local.boxShadow) style["box-shadow"] = local.boxShadow;
    
    // Merge with inline style prop
    return { ...style, ...local.style };
  };

  return (
    <div
      {...rest}
      class={local.class}
      style={computedStyle()}
    >
      {local.children}
    </div>
  );
}

export default Box;
