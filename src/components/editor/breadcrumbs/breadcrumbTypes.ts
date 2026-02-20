import type { OpenFile } from "@/context/EditorContext";
import type { SymbolKind } from "@/context/OutlineContext";

export interface PathSegment {
  name: string;
  path: string;
  isFile: boolean;
}

export interface SymbolInfo {
  id: string;
  name: string;
  kind: SymbolKind;
  detail?: string;
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  children: SymbolInfo[];
  depth: number;
}

export interface SiblingItem {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface BreadcrumbsProps {
  file: OpenFile | undefined;
  groupId?: string;
  workspaceRoot?: string | null;
}

export interface BreadcrumbsSettings {
  enabled: boolean;
  filePath: "on" | "off" | "last";
  symbolPath: "on" | "off" | "last";
  icons: boolean;
}

export interface BreadcrumbsPickerProps {
  type: "folder" | "symbol";
  items: SiblingItem[] | SymbolInfo[];
  currentPath?: string;
  currentSymbolId?: string;
  position: { x: number; y: number };
  onSelect: (item: SiblingItem | SymbolInfo) => void;
  onClose: () => void;
}

export interface BreadcrumbSymbolPickerProps {
  symbols: SymbolInfo[];
  currentSymbolId?: string;
  position: { x: number; y: number };
  onNavigate: (symbol: SymbolInfo) => void;
  onClose: () => void;
}

export interface BreadcrumbContextMenuProps {
  contextMenuPos: { x: number; y: number } | null;
  setContextMenuRef: (el: HTMLDivElement | undefined) => void;
  onCopyPath: () => void;
  onCopyRelativePath: () => void;
  onRevealInExplorer: () => void;
}
