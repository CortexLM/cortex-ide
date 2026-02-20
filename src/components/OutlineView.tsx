/**
 * OutlineView - Wrapper component for Outline panel in AuxiliaryBar
 * 
 * Provides document outline/symbol navigation for the secondary sidebar.
 * This is a lightweight wrapper around the existing OutlinePanel component.
 */

import { OutlinePanel } from "./editor/OutlinePanel";

export function OutlineView() {
  return <OutlinePanel />;
}

export default OutlineView;
