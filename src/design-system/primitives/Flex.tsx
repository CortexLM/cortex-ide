/**
 * =============================================================================
 * FLEX - Flexbox layout primitive
 * =============================================================================
 * 
 * Flex extends Box with flexbox-specific properties. Use this for one-dimensional
 * layouts (rows or columns).
 * 
 * Usage:
 *   <Flex direction="row" align="center" justify="space-between" gap="md">
 *     <Button>Cancel</Button>
 *     <Button variant="primary">Save</Button>
 *   </Flex>
 * =============================================================================
 */

import { splitProps, JSX } from "solid-js";
import { Box, BoxProps } from "./Box";

// Re-export Box from this module for convenience
export { Box } from "./Box";
export type { BoxProps } from "./Box";

// =============================================================================
// TYPES
// =============================================================================

export interface FlexProps extends BoxProps {
  // Flex container properties
  direction?: "row" | "row-reverse" | "column" | "column-reverse";
  wrap?: "nowrap" | "wrap" | "wrap-reverse";
  align?: "flex-start" | "flex-end" | "center" | "baseline" | "stretch";
  justify?: "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly";
  alignContent?: "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "stretch";
  
  // Shorthand
  inline?: boolean;
  center?: boolean; // Centers both horizontally and vertically
}

// =============================================================================
// COMPONENT
// =============================================================================

export function Flex(props: FlexProps) {
  const [local, rest] = splitProps(props, [
    "direction",
    "wrap",
    "align",
    "justify",
    "alignContent",
    "inline",
    "center",
    "style",
  ]);

  const computedStyle = (): JSX.CSSProperties => {
    const style: JSX.CSSProperties = {
      display: local.inline ? "inline-flex" : "flex",
    };
    
    if (local.direction) style["flex-direction"] = local.direction;
    if (local.wrap) style["flex-wrap"] = local.wrap;
    if (local.align) style["align-items"] = local.align;
    if (local.justify) style["justify-content"] = local.justify;
    if (local.alignContent) style["align-content"] = local.alignContent;
    
    // Center shorthand
    if (local.center) {
      style["align-items"] = "center";
      style["justify-content"] = "center";
    }
    
    return { ...style, ...local.style };
  };

  return (
    <Box
      {...rest}
      style={computedStyle()}
    />
  );
}

// =============================================================================
// STACK VARIANTS
// =============================================================================

export interface StackProps extends Omit<FlexProps, "direction"> {
  spacing?: BoxProps["gap"];
}

/**
 * VStack - Vertical stack (column direction)
 */
export function VStack(props: StackProps) {
  const [local, rest] = splitProps(props, ["spacing"]);
  
  return (
    <Flex
      direction="column"
      gap={local.spacing}
      {...rest}
    />
  );
}

/**
 * HStack - Horizontal stack (row direction)
 */
export function HStack(props: StackProps) {
  const [local, rest] = splitProps(props, ["spacing"]);
  
  return (
    <Flex
      direction="row"
      align="center"
      gap={local.spacing}
      {...rest}
    />
  );
}

/**
 * Center - Centers content both horizontally and vertically
 */
export function Center(props: BoxProps) {
  return (
    <Flex
      center
      {...props}
    />
  );
}

/**
 * Spacer - Flexible spacer that fills available space
 */
export function Spacer() {
  return <Box flex={1} />;
}

export default Flex;
