/**
 * Grid utilities - barrel export for all grid modules.
 */

export type { SerializedGridState, GridCell, EditorGridState } from "./types";
export { generateCellId } from "./types";

export {
  serializeGrid,
  deserializeGrid,
  getLeafCellIds,
  saveGridState,
  loadGridState,
  clearGridState,
} from "./serialization";

export {
  createSingleEditorLayout,
  createSplitLayout,
  create2x2Layout,
  create3ColumnLayout,
  createMainWithSideLayout,
} from "./layoutFactories";

export {
  splitCell,
  closeCell,
  moveEditorToCell,
} from "./manipulation";
