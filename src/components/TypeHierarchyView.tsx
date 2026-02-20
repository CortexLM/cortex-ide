import {
  createSignal,
  createEffect,
  For,
  Show,
  onMount,
  onCleanup,
  batch,
  JSX,
} from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { useEditor } from "@/context/EditorContext";
import {
  useLSP,
  type Position,
  type SymbolKind as LspSymbolKind,
} from "@/context/LSPContext";
import { Icon } from "./ui/Icon";
import {
  fsReadFile,
  fsGetFileTree,
  lspTypeHierarchy,
  lspWorkspaceSymbols,
  type FileTreeNode,
  type LspTypeHierarchyItem,
} from "../utils/tauri-api";
import { getProjectPath } from "../utils/workspace";

/**
 * Type kinds supported in the hierarchy view
 */
export type TypeKind =
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "struct"
  | "trait"
  | "protocol"
  | "abstract";

/**
 * Represents a type in the hierarchy
 */
export interface TypeHierarchyItem {
  name: string;
  kind: TypeKind;
  filePath: string;
  range: {
    start: Position;
    end: Position;
  };
  detail?: string;
  genericParameters?: string[];
  children?: TypeHierarchyItem[];
  uri?: string;
}

/**
 * View mode for the type hierarchy panel
 */
type ViewMode = "supertypes" | "subtypes" | "both";

/**
 * Language detection for file paths
 */
function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    java: "java",
    kt: "kotlin",
    py: "python",
    rs: "rust",
    go: "go",
    cs: "csharp",
    swift: "swift",
    scala: "scala",
  };
  return langMap[ext] || "unknown";
}

/**
 * Map LSP TypeHierarchy kind to our TypeKind
 */
function mapSymbolKindToTypeKind(kind: number): TypeKind {
  const kindMap: Record<number, TypeKind> = {
    5: "class",
    11: "interface",
    10: "enum",
    23: "struct",
    26: "type",
  };
  return kindMap[kind] || "class";
}

/**
 * Map LSP SymbolKind string to our TypeKind
 */
function mapLspSymbolKindToTypeKind(kind: LspSymbolKind): TypeKind {
  const kindMap: Record<string, TypeKind> = {
    class: "class",
    interface: "interface",
    enum: "enum",
    struct: "struct",
    typeParameter: "type",
  };
  return kindMap[kind] || "class";
}

/**
 * Get icon for type kind with appropriate color
 */
function getTypeIcon(kind: TypeKind): JSX.Element {
  const iconProps = { class: "w-4 h-4 flex-shrink-0" };

  switch (kind) {
    case "class":
      return <Icon name="box" {...iconProps} style={{ color: "var(--cortex-warning)" }} />;
    case "abstract":
      return <Icon name="box" {...iconProps} style={{ color: "var(--cortex-warning)", opacity: 0.7 }} />;
    case "interface":
      return <Icon name="font" {...iconProps} style={{ color: "var(--cortex-success)" }} />;
    case "type":
      return <Icon name="font" {...iconProps} style={{ color: "var(--cortex-info)" }} />;
    case "enum":
      return <Icon name="hashtag" {...iconProps} style={{ color: "var(--cortex-error)" }} />;
    case "struct":
      return <Icon name="box" {...iconProps} style={{ color: "var(--cortex-info)" }} />;
    case "trait":
      return <Icon name="font" {...iconProps} style={{ color: "var(--cortex-info)" }} />;
    case "protocol":
      return <Icon name="font" {...iconProps} style={{ color: "var(--cortex-info)" }} />;
    default:
      return <Icon name="code" {...iconProps} style={{ color: "var(--text-weak)" }} />;
  }
}

/**
 * Get human-readable label for type kind
 */
function getTypeKindLabel(kind: TypeKind): string {
  const labels: Record<TypeKind, string> = {
    class: "Class",
    interface: "Interface",
    type: "Type",
    enum: "Enum",
    struct: "Struct",
    trait: "Trait",
    protocol: "Protocol",
    abstract: "Abstract Class",
  };
  return labels[kind] || kind;
}

/**
 * Extract the filename from a path
 */
function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

/**
 * Format generic parameters for display
 */
function formatGenericParams(params?: string[]): string {
  if (!params || params.length === 0) return "";
  return `<${params.join(", ")}>`;
}

/**
 * Fetch type hierarchy from the backend/LSP
 */
async function fetchTypeHierarchy(
  filePath: string,
  position: Position,
  direction: "supertypes" | "subtypes"
): Promise<TypeHierarchyItem[]> {
  try {
    // Try LSP type hierarchy via Tauri invoke
    const items = await lspTypeHierarchy(filePath, position.line, position.character, direction);

    if (items && items.length > 0) {
      return items.map((item: LspTypeHierarchyItem) => ({
        name: item.name,
        kind: mapSymbolKindToTypeKind(item.kind),
        filePath: item.uri?.replace("file://", "") || "",
        range: item.range,
        detail: item.detail,
        uri: item.uri,
      }));
    }
  } catch (err) {
    console.debug(
      "LSP type hierarchy not available, falling back to parsing",
      err
    );
  }

  // Fallback: Parse file to extract type relationships
  return await parseTypeHierarchy(filePath, position, direction);
}

/**
 * Parse file content to extract type hierarchy information
 * This is a fallback when LSP is not available
 */
async function parseTypeHierarchy(
  filePath: string,
  position: Position,
  direction: "supertypes" | "subtypes"
): Promise<TypeHierarchyItem[]> {
  const projectPath = getProjectPath();
  const results: TypeHierarchyItem[] = [];

  try {
    // First, read the current file to find the type at the position
    const content = await fsReadFile(filePath);
    const lines = content.split("\n");
    const language = detectLanguage(filePath);

    // Find the type definition at the cursor position
    const currentTypeInfo = findTypeAtPosition(lines, position, language);
    if (!currentTypeInfo) return results;

    if (direction === "supertypes") {
      // Extract supertypes from the current type definition
      const supertypes = extractSupertypes(
        currentTypeInfo.declarationLine,
        language
      );
      for (const supertype of supertypes) {
        // Try to find the supertype definition in the project
        const supertypeInfo = await findTypeDefinition(
          projectPath,
          supertype.name
        );
        if (supertypeInfo) {
          results.push({
            name: supertype.name,
            kind: supertype.kind || supertypeInfo.kind,
            filePath: supertypeInfo.filePath,
            range: supertypeInfo.range,
            genericParameters: supertype.genericParams,
          });
        } else {
          // External/unknown type
          results.push({
            name: supertype.name,
            kind: supertype.kind || "class",
            filePath: "(external)",
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
            genericParameters: supertype.genericParams,
          });
        }
      }
    } else {
      // Find all types that extend/implement the current type
      const subtypes = await findSubtypes(projectPath, currentTypeInfo.name, language);
      results.push(...subtypes);
    }
  } catch (err) {
    console.error("Error parsing type hierarchy:", err);
  }

  return results;
}

/**
 * Find the type definition at a given position
 */
function findTypeAtPosition(
  lines: string[],
  position: Position,
  language: string
): { name: string; kind: TypeKind; declarationLine: string } | null {
  // Look for type definition around the cursor position
  const searchStart = Math.max(0, position.line - 5);
  const searchEnd = Math.min(lines.length, position.line + 2);

  for (let i = searchEnd; i >= searchStart; i--) {
    const line = lines[i];
    const typeInfo = parseTypeDeclaration(line, language);
    if (typeInfo) {
      return {
        ...typeInfo,
        declarationLine: line,
      };
    }
  }

  return null;
}

/**
 * Parse a line to extract type declaration info
 */
function parseTypeDeclaration(
  line: string,
  language: string
): { name: string; kind: TypeKind } | null {
  const patterns = getTypeDeclarationPatterns(language);

  for (const pattern of patterns) {
    const match = line.match(pattern.regex);
    if (match) {
      return {
        name: match[pattern.nameGroup || 1],
        kind: pattern.kind,
      };
    }
  }

  return null;
}

interface TypePattern {
  regex: RegExp;
  kind: TypeKind;
  nameGroup?: number;
}

/**
 * Get type declaration patterns for different languages
 */
function getTypeDeclarationPatterns(language: string): TypePattern[] {
  switch (language) {
    case "typescript":
    case "javascript":
      return [
        { regex: /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/, kind: "class" },
        { regex: /(?:export\s+)?interface\s+(\w+)/, kind: "interface" },
        { regex: /(?:export\s+)?type\s+(\w+)/, kind: "type" },
        { regex: /(?:export\s+)?enum\s+(\w+)/, kind: "enum" },
      ];
    case "java":
    case "kotlin":
      return [
        { regex: /(?:public\s+)?(?:abstract\s+)?class\s+(\w+)/, kind: "class" },
        { regex: /(?:public\s+)?interface\s+(\w+)/, kind: "interface" },
        { regex: /(?:public\s+)?enum\s+(\w+)/, kind: "enum" },
      ];
    case "python":
      return [{ regex: /class\s+(\w+)/, kind: "class" }];
    case "rust":
      return [
        { regex: /(?:pub\s+)?struct\s+(\w+)/, kind: "struct" },
        { regex: /(?:pub\s+)?enum\s+(\w+)/, kind: "enum" },
        { regex: /(?:pub\s+)?trait\s+(\w+)/, kind: "trait" },
      ];
    case "go":
      return [
        { regex: /type\s+(\w+)\s+struct/, kind: "struct" },
        { regex: /type\s+(\w+)\s+interface/, kind: "interface" },
      ];
    case "csharp":
      return [
        { regex: /(?:public\s+)?(?:abstract\s+)?class\s+(\w+)/, kind: "class" },
        { regex: /(?:public\s+)?interface\s+(\w+)/, kind: "interface" },
        { regex: /(?:public\s+)?struct\s+(\w+)/, kind: "struct" },
        { regex: /(?:public\s+)?enum\s+(\w+)/, kind: "enum" },
      ];
    case "swift":
      return [
        { regex: /(?:public\s+)?(?:final\s+)?class\s+(\w+)/, kind: "class" },
        { regex: /(?:public\s+)?protocol\s+(\w+)/, kind: "protocol" },
        { regex: /(?:public\s+)?struct\s+(\w+)/, kind: "struct" },
        { regex: /(?:public\s+)?enum\s+(\w+)/, kind: "enum" },
      ];
    default:
      return [
        { regex: /class\s+(\w+)/, kind: "class" },
        { regex: /interface\s+(\w+)/, kind: "interface" },
      ];
  }
}

interface SupertypeInfo {
  name: string;
  kind?: TypeKind;
  genericParams?: string[];
}

/**
 * Extract supertypes from a type declaration line
 */
function extractSupertypes(line: string, language: string): SupertypeInfo[] {
  const supertypes: SupertypeInfo[] = [];

  switch (language) {
    case "typescript":
    case "javascript": {
      // Match: extends BaseClass or extends BaseClass<T>
      const extendsMatch = line.match(/extends\s+([\w<>,\s]+?)(?:\s+implements|\s*\{|$)/);
      if (extendsMatch) {
        const parsed = parseTypeList(extendsMatch[1]);
        supertypes.push(...parsed.map((t) => ({ ...t, kind: "class" as TypeKind })));
      }
      // Match: implements Interface1, Interface2
      const implementsMatch = line.match(/implements\s+([\w<>,\s]+?)(?:\s*\{|$)/);
      if (implementsMatch) {
        const parsed = parseTypeList(implementsMatch[1]);
        supertypes.push(
          ...parsed.map((t) => ({ ...t, kind: "interface" as TypeKind }))
        );
      }
      break;
    }
    case "java":
    case "kotlin": {
      const extendsMatch = line.match(/extends\s+(\w+)(?:<[^>]+>)?/);
      if (extendsMatch) {
        supertypes.push({ name: extendsMatch[1], kind: "class" });
      }
      const implementsMatch = line.match(/implements\s+([\w,\s<>]+?)(?:\s*\{|$)/);
      if (implementsMatch) {
        const parsed = parseTypeList(implementsMatch[1]);
        supertypes.push(
          ...parsed.map((t) => ({ ...t, kind: "interface" as TypeKind }))
        );
      }
      break;
    }
    case "python": {
      // Match: class Foo(Bar, Baz)
      const parentMatch = line.match(/class\s+\w+\s*\(([^)]+)\)/);
      if (parentMatch) {
        const parents = parentMatch[1].split(",").map((p) => p.trim());
        for (const parent of parents) {
          if (parent && parent !== "object" && parent !== "ABC") {
            supertypes.push({ name: parent, kind: "class" });
          }
        }
      }
      break;
    }
    case "rust": {
      // Match: impl Trait for Struct
      const traitMatch = line.match(/impl\s+(\w+)\s+for/);
      if (traitMatch) {
        supertypes.push({ name: traitMatch[1], kind: "trait" });
      }
      break;
    }
    case "csharp": {
      // Match: class Foo : Bar, IInterface
      const inheritMatch = line.match(/(?:class|struct)\s+\w+\s*:\s*([\w,\s<>]+?)(?:\s*where|\s*\{|$)/);
      if (inheritMatch) {
        const parsed = parseTypeList(inheritMatch[1]);
        supertypes.push(
          ...parsed.map((t) => ({
            ...t,
            kind: t.name.startsWith("I") ? ("interface" as TypeKind) : ("class" as TypeKind),
          }))
        );
      }
      break;
    }
    case "swift": {
      // Match: class Foo: Bar, Protocol
      const inheritMatch = line.match(/(?:class|struct)\s+\w+\s*:\s*([\w,\s<>]+?)(?:\s*\{|$)/);
      if (inheritMatch) {
        const parsed = parseTypeList(inheritMatch[1]);
        supertypes.push(...parsed);
      }
      break;
    }
  }

  return supertypes;
}

/**
 * Parse a comma-separated list of types
 */
function parseTypeList(
  typeList: string
): Array<{ name: string; genericParams?: string[] }> {
  const results: Array<{ name: string; genericParams?: string[] }> = [];
  let current = "";
  let depth = 0;

  for (const char of typeList) {
    if (char === "<") depth++;
    else if (char === ">") depth--;
    else if (char === "," && depth === 0) {
      const parsed = parseTypeName(current.trim());
      if (parsed) results.push(parsed);
      current = "";
      continue;
    }
    current += char;
  }

  const parsed = parseTypeName(current.trim());
  if (parsed) results.push(parsed);

  return results;
}

/**
 * Parse a type name with optional generic parameters
 */
function parseTypeName(
  typeName: string
): { name: string; genericParams?: string[] } | null {
  if (!typeName) return null;

  const match = typeName.match(/^(\w+)(?:<(.+)>)?$/);
  if (!match) return { name: typeName };

  const name = match[1];
  const genericStr = match[2];

  if (genericStr) {
    const genericParams = parseTypeList(genericStr).map((t) => t.name);
    return { name, genericParams };
  }

  return { name };
}

/**
 * Find the definition of a type in the project
 */
async function findTypeDefinition(
  projectPath: string,
  typeName: string
): Promise<{ kind: TypeKind; filePath: string; range: { start: Position; end: Position } } | null> {
  try {
    // Search for the type definition using workspace symbols via Tauri
    const symbols = await lspWorkspaceSymbols(projectPath, typeName);

    // Find exact match for type name
    const typeSymbol = symbols.find(
      (s) => s.name === typeName && [5, 10, 11, 23, 26].includes(s.kind)
    );

    if (typeSymbol) {
      return {
        kind: mapSymbolKindToTypeKind(typeSymbol.kind),
        filePath: typeSymbol.location?.uri?.replace("file://", "") || "",
        range: typeSymbol.location?.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      };
    }
  } catch (err) {
    console.debug("Could not find type definition:", err);
  }

  return null;
}

/**
 * Find all subtypes of a given type in the project
 */
async function findSubtypes(
  projectPath: string,
  typeName: string,
  language: string
): Promise<TypeHierarchyItem[]> {
  const subtypes: TypeHierarchyItem[] = [];

  try {
    // Get file tree via Tauri
    const treeData = await fsGetFileTree(projectPath, 10);
    const files = collectCodeFiles(treeData.children || [], "", language);

    // Search each file for types that extend the target
    await Promise.all(
      files.slice(0, 100).map(async (file) => {
        try {
          const fileSubtypes = await findSubtypesInFile(
            projectPath,
            file.path,
            typeName,
            language
          );
          subtypes.push(...fileSubtypes);
        } catch (e) {
          // Skip files that fail to parse
        }
      })
    );
  } catch (err) {
    console.error("Error finding subtypes:", err);
  }

  return subtypes;
}

/**
 * Find subtypes in a single file
 */
async function findSubtypesInFile(
  projectPath: string,
  relativePath: string,
  targetType: string,
  language: string
): Promise<TypeHierarchyItem[]> {
  const subtypes: TypeHierarchyItem[] = [];
  const fullPath = `${projectPath}/${relativePath}`;

  try {
    const content = await fsReadFile(fullPath);
    const lines = content.split("\n");

    // Pattern to find types that extend/implement the target
    const patterns = getInheritancePatterns(language, targetType);

    lines.forEach((line, lineIndex) => {
      for (const pattern of patterns) {
        if (pattern.regex.test(line)) {
          const typeInfo = parseTypeDeclaration(line, language);
          if (typeInfo && typeInfo.name !== targetType) {
            subtypes.push({
              name: typeInfo.name,
              kind: typeInfo.kind,
              filePath: relativePath,
              range: {
                start: { line: lineIndex, character: 0 },
                end: { line: lineIndex, character: line.length },
              },
            });
          }
        }
      }
    });
  } catch (e) {
    // Skip files that fail to read
  }

  return subtypes;
}

/**
 * Get patterns to find types that inherit from a specific type
 */
function getInheritancePatterns(
  language: string,
  targetType: string
): Array<{ regex: RegExp }> {
  const escaped = targetType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  switch (language) {
    case "typescript":
    case "javascript":
      return [
        { regex: new RegExp(`extends\\s+${escaped}(?:<|\\s|\\{|$)`) },
        { regex: new RegExp(`implements\\s+[\\w,\\s]*${escaped}(?:<|\\s|,|\\{|$)`) },
      ];
    case "java":
    case "kotlin":
      return [
        { regex: new RegExp(`extends\\s+${escaped}(?:<|\\s|\\{|$)`) },
        { regex: new RegExp(`implements\\s+[\\w,\\s]*${escaped}(?:<|\\s|,|\\{|$)`) },
      ];
    case "python":
      return [{ regex: new RegExp(`class\\s+\\w+\\s*\\([^)]*${escaped}[^)]*\\)`) }];
    case "rust":
      return [{ regex: new RegExp(`impl\\s+${escaped}\\s+for\\s+(\\w+)`) }];
    case "csharp":
      return [{ regex: new RegExp(`:\\s*[\\w,\\s]*${escaped}(?:<|\\s|,|\\{|$)`) }];
    case "swift":
      return [{ regex: new RegExp(`:\\s*[\\w,\\s]*${escaped}(?:<|\\s|,|\\{|$)`) }];
    default:
      return [{ regex: new RegExp(`extends\\s+${escaped}`) }];
  }
}

/**
 * Collect code files from tree structure
 */
function collectCodeFiles(
  entries: FileTreeNode[] | undefined,
  parentPath: string,
  language: string
): Array<{ name: string; path: string }> {
  const result: Array<{ name: string; path: string }> = [];
  if (!entries) return result;

  const extensionsByLanguage: Record<string, Set<string>> = {
    typescript: new Set(["ts", "tsx"]),
    javascript: new Set(["js", "jsx", "mjs"]),
    java: new Set(["java"]),
    kotlin: new Set(["kt", "kts"]),
    python: new Set(["py"]),
    rust: new Set(["rs"]),
    go: new Set(["go"]),
    csharp: new Set(["cs"]),
    swift: new Set(["swift"]),
  };

  const validExtensions = extensionsByLanguage[language] || new Set(["ts", "tsx", "js", "jsx"]);

  for (const entry of entries) {
    const fullPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

    if (entry.isFile) {
      const ext = entry.name.split(".").pop()?.toLowerCase();
      if (ext && validExtensions.has(ext)) {
        result.push({ name: entry.name, path: fullPath });
      }
    }

    if (entry.isDirectory && entry.children) {
      result.push(
        ...collectCodeFiles(entry.children, fullPath, language)
      );
    }
  }

  return result;
}

/**
 * Type Hierarchy Tree Node component
 */
interface TypeHierarchyNodeProps {
  item: TypeHierarchyItem;
  depth: number;
  expanded: Set<string>;
  selected: string | null;
  direction: "up" | "down";
  onToggleExpand: (id: string) => void;
  onSelect: (item: TypeHierarchyItem) => void;
  onNavigate: (item: TypeHierarchyItem) => void;
  onLoadChildren: (item: TypeHierarchyItem) => Promise<TypeHierarchyItem[]>;
}

function TypeHierarchyNode(props: TypeHierarchyNodeProps) {
  const [loading, setLoading] = createSignal(false);
  const [childrenLoaded, setChildrenLoaded] = createSignal(false);
  const [children, setChildren] = createSignal<TypeHierarchyItem[]>([]);

  const nodeId = () => `${props.item.filePath}:${props.item.name}:${props.item.range.start.line}`;
  const isExpanded = () => props.expanded.has(nodeId());
  const isSelected = () => props.selected === nodeId();

  const handleToggle = async () => {
    const id = nodeId();

    if (!isExpanded() && !childrenLoaded()) {
      setLoading(true);
      try {
        const loadedChildren = await props.onLoadChildren(props.item);
        setChildren(loadedChildren);
        setChildrenLoaded(true);
      } finally {
        setLoading(false);
      }
    }

    props.onToggleExpand(id);
  };

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    props.onSelect(props.item);
  };

  const handleDoubleClick = (e: MouseEvent) => {
    e.stopPropagation();
    props.onNavigate(props.item);
  };

  const displayChildren = () => {
    if (props.item.children && props.item.children.length > 0) {
      return props.item.children;
    }
    return children();
  };

  const hasChildren = () => {
    return (
      (props.item.children && props.item.children.length > 0) ||
      children().length > 0 ||
      !childrenLoaded()
    );
  };

  return (
    <div class="type-hierarchy-node">
      <div
        class="type-hierarchy-item"
        style={{
          "padding-left": `${props.depth * 16 + 8}px`,
          background: isSelected() ? "var(--surface-active)" : "transparent",
          cursor: "pointer",
        }}
        onClick={handleClick}
        onDblClick={handleDoubleClick}
      >
        {/* Expand/collapse chevron */}
        <span
          class="type-hierarchy-chevron"
          style={{
            width: "16px",
            display: "inline-flex",
            "align-items": "center",
            "justify-content": "center",
            cursor: hasChildren() ? "pointer" : "default",
            opacity: hasChildren() ? 1 : 0,
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren()) handleToggle();
          }}
        >
          <Show when={loading()}>
            <span
              class="animate-spin"
              style={{
                width: "10px",
                height: "10px",
                border: "1.5px solid var(--text-weak)",
                "border-top-color": "transparent",
                "border-radius": "var(--cortex-radius-full)",
              }}
            />
          </Show>
          <Show when={!loading() && hasChildren()}>
            {isExpanded() ? (
              <Icon name="chevron-down" class="w-3 h-3" style={{ color: "var(--text-weak)" }} />
            ) : (
              <Icon name="chevron-right" class="w-3 h-3" style={{ color: "var(--text-weak)" }} />
            )}
          </Show>
        </span>

        {/* Direction indicator */}
        <span
          style={{
            width: "16px",
            display: "inline-flex",
            "align-items": "center",
            "justify-content": "center",
          }}
        >
          {props.direction === "up" ? (
            <Icon name="arrow-up" class="w-3 h-3" style={{ color: "var(--accent-primary)" }} />
          ) : (
            <Icon name="arrow-down" class="w-3 h-3" style={{ color: "var(--cortex-success)" }} />
          )}
        </span>

        {/* Type icon */}
        <span style={{ "margin-right": "6px" }}>{getTypeIcon(props.item.kind)}</span>

        {/* Type name */}
        <span
          style={{
            "font-weight": "500",
            color: "var(--text-base)",
            "margin-right": "4px",
          }}
        >
          {props.item.name}
          <span style={{ color: "var(--text-weak)", "font-weight": "normal" }}>
            {formatGenericParams(props.item.genericParameters)}
          </span>
        </span>

        {/* Kind badge */}
        <span
          style={{
            "font-size": "10px",
            padding: "1px 4px",
            "border-radius": "var(--cortex-radius-sm)",
            background: "var(--surface-base)",
            color: "var(--text-weak)",
            "margin-left": "auto",
            "margin-right": "8px",
          }}
        >
          {getTypeKindLabel(props.item.kind)}
        </span>

        {/* File location */}
        <Show when={props.item.filePath && props.item.filePath !== "(external)"}>
          <span
            style={{
              "font-size": "11px",
              color: "var(--text-weak)",
              display: "flex",
              "align-items": "center",
              gap: "4px",
            }}
          >
            <Icon name="file" class="w-3 h-3" />
            {getFileName(props.item.filePath)}:{props.item.range.start.line + 1}
          </span>
        </Show>
        <Show when={props.item.filePath === "(external)"}>
          <span
            style={{
              "font-size": "11px",
              color: "var(--text-weak)",
              "font-style": "italic",
            }}
          >
            (external)
          </span>
        </Show>
      </div>

      {/* Children */}
      <Show when={isExpanded() && displayChildren().length > 0}>
        <div class="type-hierarchy-children">
          <For each={displayChildren()}>
            {(child) => (
              <TypeHierarchyNode
                item={child}
                depth={props.depth + 1}
                expanded={props.expanded}
                selected={props.selected}
                direction={props.direction}
                onToggleExpand={props.onToggleExpand}
                onSelect={props.onSelect}
                onNavigate={props.onNavigate}
                onLoadChildren={props.onLoadChildren}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

/**
 * Main Type Hierarchy View component
 */
export function TypeHierarchyView() {
  const { registerCommand, unregisterCommand } = useCommands();
  const { openFile, state: editorState } = useEditor();
  const lsp = useLSP();

  const [isOpen, setIsOpen] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<ViewMode>("both");
  const [currentType, setCurrentType] = createSignal<TypeHierarchyItem | null>(null);
  const [supertypes, setSupertypes] = createSignal<TypeHierarchyItem[]>([]);
  const [subtypes, setSubtypes] = createSignal<TypeHierarchyItem[]>([]);
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set());
  const [selected, setSelected] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Register commands on mount
  onMount(() => {
    // Main type hierarchy command (shows both supertypes and subtypes)
    registerCommand({
      id: "show-type-hierarchy",
      label: "Show Type Hierarchy",
      shortcut: "Ctrl+Shift+H",
      category: "Navigation",
      action: () => showTypeHierarchy("both"),
    });

    // Show only supertypes command
    registerCommand({
      id: "show-supertypes",
      label: "Show Supertypes",
      shortcut: "Ctrl+Alt+H",
      category: "Navigation",
      action: () => showTypeHierarchy("supertypes"),
    });

    // Show only subtypes command
    registerCommand({
      id: "show-subtypes",
      label: "Show Subtypes",
      shortcut: "Ctrl+Alt+Shift+H",
      category: "Navigation",
      action: () => showTypeHierarchy("subtypes"),
    });

    // Listen for context menu events
    const handleContextMenuCommand = (e: CustomEvent<{ command: string }>) => {
      if (e.detail?.command === "show-type-hierarchy") {
        showTypeHierarchy("both");
      } else if (e.detail?.command === "show-supertypes") {
        showTypeHierarchy("supertypes");
      } else if (e.detail?.command === "show-subtypes") {
        showTypeHierarchy("subtypes");
      }
    };

    window.addEventListener(
      "editor-context-command" as keyof WindowEventMap,
      handleContextMenuCommand as EventListener
    );

    // Listen for keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        showTypeHierarchy("both");
      } else if (e.ctrlKey && e.altKey && !e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        showTypeHierarchy("supertypes");
      } else if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        showTypeHierarchy("subtypes");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      unregisterCommand("show-type-hierarchy");
      unregisterCommand("show-supertypes");
      unregisterCommand("show-subtypes");
      window.removeEventListener(
        "editor-context-command" as keyof WindowEventMap,
        handleContextMenuCommand as EventListener
      );
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  /**
   * Show type hierarchy for current cursor position
   * @param mode - Which view mode to show: "supertypes", "subtypes", or "both"
   */
  const showTypeHierarchy = async (mode: ViewMode = "both") => {
    const activeFileId = editorState.activeFileId;
    if (!activeFileId) {
      setError("No file is currently open");
      setIsOpen(true);
      return;
    }

    const activeFile = editorState.openFiles.find((f) => f.id === activeFileId);
    if (!activeFile) {
      setError("Could not find active file");
      setIsOpen(true);
      return;
    }

    // Set the view mode based on how the command was invoked
    setViewMode(mode);
    setIsOpen(true);
    setLoading(true);
    setError(null);

    batch(() => {
      setSupertypes([]);
      setSubtypes([]);
      setCurrentType(null);
      setExpanded(new Set<string>());
      setSelected(null);
    });

    try {
      const filePath = activeFile.path;
      const position: Position = activeFile.cursorPosition
        ? {
            line: activeFile.cursorPosition.line - 1,
            character: activeFile.cursorPosition.column - 1,
          }
        : { line: 0, character: 0 };

      // Try LSP type hierarchy first
      let usedLsp = false;
      try {
        const prepareResult = await lsp.prepareTypeHierarchy(filePath, position);
        if (prepareResult.items.length > 0) {
          const lspItem = prepareResult.items[0];
          usedLsp = true;

          // Set current type from LSP result
          setCurrentType({
            name: lspItem.name,
            kind: mapLspSymbolKindToTypeKind(lspItem.kind),
            filePath: lspItem.uri.replace("file://", ""),
            range: lspItem.range,
            uri: lspItem.uri,
          });

          // Fetch supertypes and/or subtypes based on mode
          const fetchPromises: Promise<TypeHierarchyItem[]>[] = [];
          if (mode === "supertypes" || mode === "both") {
            fetchPromises.push(
              lsp.getSupertypes(lspItem).then((r) =>
                r.items.map((item) => ({
                  name: item.name,
                  kind: mapLspSymbolKindToTypeKind(item.kind),
                  filePath: item.uri.replace("file://", ""),
                  range: item.range,
                  detail: item.detail,
                  uri: item.uri,
                }))
              )
            );
          } else {
            fetchPromises.push(Promise.resolve([]));
          }

          if (mode === "subtypes" || mode === "both") {
            fetchPromises.push(
              lsp.getSubtypes(lspItem).then((r) =>
                r.items.map((item) => ({
                  name: item.name,
                  kind: mapLspSymbolKindToTypeKind(item.kind),
                  filePath: item.uri.replace("file://", ""),
                  range: item.range,
                  detail: item.detail,
                  uri: item.uri,
                }))
              )
            );
          } else {
            fetchPromises.push(Promise.resolve([]));
          }

          const [supertypesResult, subtypesResult] = await Promise.all(fetchPromises);
          setSupertypes(supertypesResult);
          setSubtypes(subtypesResult);
        }
      } catch (lspErr) {
        console.debug("LSP type hierarchy not available, falling back to parsing:", lspErr);
      }

      // Fallback to file parsing if LSP didn't work
      if (!usedLsp) {
        const content = await fsReadFile(filePath);
        const lines = content.split("\n");
        const language = detectLanguage(filePath);
        const typeInfo = findTypeAtPosition(lines, position, language);

        if (typeInfo) {
          setCurrentType({
            name: typeInfo.name,
            kind: typeInfo.kind,
            filePath: filePath,
            range: {
              start: position,
              end: { line: position.line, character: position.character + typeInfo.name.length },
            },
          });

          // Fetch supertypes and/or subtypes based on mode
          const fetchPromises: Promise<TypeHierarchyItem[]>[] = [];
          if (mode === "supertypes" || mode === "both") {
            fetchPromises.push(fetchTypeHierarchy(filePath, position, "supertypes"));
          } else {
            fetchPromises.push(Promise.resolve([]));
          }
          if (mode === "subtypes" || mode === "both") {
            fetchPromises.push(fetchTypeHierarchy(filePath, position, "subtypes"));
          } else {
            fetchPromises.push(Promise.resolve([]));
          }

          const [supertypesResult, subtypesResult] = await Promise.all(fetchPromises);
          setSupertypes(supertypesResult);
          setSubtypes(subtypesResult);
        } else {
          setError("No type found at cursor position. Place cursor on a class, interface, or type.");
        }
      }
    } catch (err) {
      console.error("Error loading type hierarchy:", err);
      setError(err instanceof Error ? err.message : "Failed to load type hierarchy");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Navigate to a type definition
   */
  const handleNavigate = async (item: TypeHierarchyItem) => {
    if (item.filePath === "(external)") return;

    const projectPath = getProjectPath();

    const fullPath = item.filePath.startsWith("/") || item.filePath.includes(":")
      ? item.filePath
      : `${projectPath}/${item.filePath}`;

    await openFile(fullPath);

    // Navigate to the line
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("editor:goto-line", {
          detail: {
            line: item.range.start.line + 1,
            column: item.range.start.character + 1,
          },
        })
      );
    }, 100);
  };

  /**
   * Toggle node expansion
   */
  const handleToggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /**
   * Select a node
   */
  const handleSelect = (item: TypeHierarchyItem) => {
    const id = `${item.filePath}:${item.name}:${item.range.start.line}`;
    setSelected(id);
  };

  /**
   * Load children for lazy loading
   */
  const handleLoadSupertypeChildren = async (
    item: TypeHierarchyItem
  ): Promise<TypeHierarchyItem[]> => {
    return fetchTypeHierarchy(item.filePath, item.range.start, "supertypes");
  };

  const handleLoadSubtypeChildren = async (
    item: TypeHierarchyItem
  ): Promise<TypeHierarchyItem[]> => {
    return fetchTypeHierarchy(item.filePath, item.range.start, "subtypes");
  };

  /**
   * Expand all nodes
   */
  const expandAll = () => {
    const allIds = new Set<string>();

    const collectIds = (items: TypeHierarchyItem[]) => {
      for (const item of items) {
        allIds.add(`${item.filePath}:${item.name}:${item.range.start.line}`);
        if (item.children) {
          collectIds(item.children);
        }
      }
    };

    collectIds(supertypes());
    collectIds(subtypes());
    setExpanded(allIds);
  };

  /**
   * Collapse all nodes
   */
  const collapseAll = () => {
    setExpanded(new Set<string>());
  };

  /**
   * Close the panel
   */
  const handleClose = () => {
    setIsOpen(false);
    batch(() => {
      setCurrentType(null);
      setSupertypes([]);
      setSubtypes([]);
      setError(null);
    });
  };

  // Handle Escape key to close
  createEffect(() => {
    if (!isOpen()) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <Show when={isOpen()}>
      <div
        class="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh]"
        onClick={handleClose}
      >
        {/* Backdrop */}
        <div class="absolute inset-0 bg-black/50" />

        {/* Panel */}
        <div
          class="relative w-[700px] max-h-[70vh] rounded-lg shadow-2xl overflow-hidden flex flex-col"
          style={{ background: "var(--surface-raised)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            class="flex items-center justify-between px-4 py-3 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <div class="flex items-center gap-3">
              <Icon name="font" class="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
              <span class="font-medium" style={{ color: "var(--text-base)" }}>
                Type Hierarchy
              </span>
              <Show when={currentType()}>
                <span
                  style={{
                    color: "var(--text-weak)",
                    "font-size": "13px",
                  }}
                >
                  — {currentType()!.name}
                </span>
              </Show>
            </div>
            <div class="flex items-center gap-2">
              {/* View mode toggle */}
              <div
                class="flex rounded-md overflow-hidden"
                style={{ background: "var(--surface-base)" }}
              >
                <button
                  class="px-2 py-1 text-xs transition-colors"
                  style={{
                    background:
                      viewMode() === "supertypes" || viewMode() === "both"
                        ? "var(--accent-primary)"
                        : "transparent",
                    color:
                      viewMode() === "supertypes" || viewMode() === "both"
                        ? "white"
                        : "var(--text-weak)",
                  }}
                  onClick={() =>
                    setViewMode((m) =>
                      m === "both" ? "subtypes" : m === "subtypes" ? "both" : "supertypes"
                    )
                  }
                  title="Toggle supertypes"
                >
                  <Icon name="arrow-up" class="w-3 h-3" />
                </button>
                <button
                  class="px-2 py-1 text-xs transition-colors"
                  style={{
                    background:
                      viewMode() === "subtypes" || viewMode() === "both"
                        ? "var(--cortex-success)"
                        : "transparent",
                    color:
                      viewMode() === "subtypes" || viewMode() === "both"
                        ? "white"
                        : "var(--text-weak)",
                  }}
                  onClick={() =>
                    setViewMode((m) =>
                      m === "both" ? "supertypes" : m === "supertypes" ? "both" : "subtypes"
                    )
                  }
                  title="Toggle subtypes"
                >
                  <Icon name="arrow-down" class="w-3 h-3" />
                </button>
              </div>

              {/* Expand/Collapse all */}
              <button
                class="p-1.5 rounded hover:bg-[var(--surface-base)] transition-colors"
                style={{ color: "var(--text-weak)" }}
                onClick={expandAll}
                title="Expand All"
              >
                <Icon name="maximize" class="w-4 h-4" />
              </button>
              <button
                class="p-1.5 rounded hover:bg-[var(--surface-base)] transition-colors"
                style={{ color: "var(--text-weak)" }}
                onClick={collapseAll}
                title="Collapse All"
              >
                <Icon name="minimize" class="w-4 h-4" />
              </button>

              {/* Close button */}
              <button
                class="p-1.5 rounded hover:bg-[var(--surface-base)] transition-colors"
                style={{ color: "var(--text-weak)" }}
                onClick={handleClose}
              >
                <Icon name="xmark" class="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div class="flex-1 overflow-y-auto" style={{ "min-height": "200px" }}>
            {/* Loading state */}
            <Show when={loading()}>
              <div class="flex items-center justify-center py-12">
                <div
                  class="animate-spin"
                  style={{
                    width: "24px",
                    height: "24px",
                    border: "2px solid var(--border-weak)",
                    "border-top-color": "var(--accent-primary)",
                    "border-radius": "var(--cortex-radius-full)",
                  }}
                />
                <span
                  class="ml-3"
                  style={{ color: "var(--text-weak)", "font-size": "14px" }}
                >
                  Loading type hierarchy...
                </span>
              </div>
            </Show>

            {/* Error state */}
            <Show when={error() && !loading()}>
              <div class="flex flex-col items-center justify-center py-12 px-4">
                <p
                  style={{
                    color: "var(--text-weak)",
                    "font-size": "14px",
                    "text-align": "center",
                  }}
                >
                  {error()}
                </p>
              </div>
            </Show>

            {/* Hierarchy content */}
            <Show when={!loading() && !error() && currentType()}>
              {/* Supertypes section */}
              <Show when={viewMode() === "supertypes" || viewMode() === "both"}>
                <div
                  class="px-3 py-2 border-b"
                  style={{
                    "border-color": "var(--border-weak)",
                    background: "var(--surface-base)",
                  }}
                >
                  <span
                    class="text-xs font-medium uppercase tracking-wide"
                    style={{ color: "var(--accent-primary)" }}
                  >
                  <Icon
                      name="arrow-up"
                      class="w-3 h-3 inline-block mr-1"
                      style={{ "vertical-align": "middle" }}
                    />
                    Supertypes ({supertypes().length})
                  </span>
                </div>
                <div class="py-1">
                  <Show
                    when={supertypes().length > 0}
                    fallback={
                      <div
                        class="px-4 py-3 text-center"
                        style={{ color: "var(--text-weak)", "font-size": "13px" }}
                      >
                        No supertypes found
                      </div>
                    }
                  >
                    <For each={supertypes()}>
                      {(item) => (
                        <TypeHierarchyNode
                          item={item}
                          depth={0}
                          expanded={expanded()}
                          selected={selected()}
                          direction="up"
                          onToggleExpand={handleToggleExpand}
                          onSelect={handleSelect}
                          onNavigate={handleNavigate}
                          onLoadChildren={handleLoadSupertypeChildren}
                        />
                      )}
                    </For>
                  </Show>
                </div>
              </Show>

              {/* Current type indicator (when showing both) */}
              <Show when={viewMode() === "both"}>
                <div
                  class="px-4 py-2 flex items-center gap-2"
                  style={{
                    background: "var(--accent-primary-muted, rgba(59, 130, 246, 0.1))",
                    "border-top": "1px solid var(--border-weak)",
                    "border-bottom": "1px solid var(--border-weak)",
                  }}
                >
                  {getTypeIcon(currentType()!.kind)}
                  <span style={{ "font-weight": "600", color: "var(--text-base)" }}>
                    {currentType()!.name}
                  </span>
                  <span
                    style={{
                      "font-size": "11px",
                      color: "var(--text-weak)",
                      "margin-left": "auto",
                    }}
                  >
                    Current Type
                  </span>
                </div>
              </Show>

              {/* Subtypes section */}
              <Show when={viewMode() === "subtypes" || viewMode() === "both"}>
                <div
                  class="px-3 py-2 border-b"
                  style={{
                    "border-color": "var(--border-weak)",
                    background: "var(--surface-base)",
                  }}
                >
                  <span
                    class="text-xs font-medium uppercase tracking-wide"
                    style={{ color: "var(--cortex-success)" }}
                  >
                  <Icon
                      name="arrow-down"
                      class="w-3 h-3 inline-block mr-1"
                      style={{ "vertical-align": "middle" }}
                    />
                    Subtypes ({subtypes().length})
                  </span>
                </div>
                <div class="py-1">
                  <Show
                    when={subtypes().length > 0}
                    fallback={
                      <div
                        class="px-4 py-3 text-center"
                        style={{ color: "var(--text-weak)", "font-size": "13px" }}
                      >
                        No subtypes found
                      </div>
                    }
                  >
                    <For each={subtypes()}>
                      {(item) => (
                        <TypeHierarchyNode
                          item={item}
                          depth={0}
                          expanded={expanded()}
                          selected={selected()}
                          direction="down"
                          onToggleExpand={handleToggleExpand}
                          onSelect={handleSelect}
                          onNavigate={handleNavigate}
                          onLoadChildren={handleLoadSubtypeChildren}
                        />
                      )}
                    </For>
                  </Show>
                </div>
              </Show>
            </Show>

            {/* Empty state when no type found */}
            <Show when={!loading() && !error() && !currentType()}>
              <div class="flex flex-col items-center justify-center py-12 px-4">
                <Icon name="font" class="w-12 h-12 mb-4" style={{ color: "var(--text-weak)" }} />
                <p
                  style={{
                    color: "var(--text-weak)",
                    "font-size": "14px",
                    "text-align": "center",
                  }}
                >
                  Position cursor on a type and run this command to see its hierarchy.
                </p>
              </div>
            </Show>
          </div>

          {/* Footer with keyboard hints */}
          <div
            class="px-4 py-2 border-t flex items-center justify-between"
            style={{
              "border-color": "var(--border-weak)",
              background: "var(--surface-base)",
            }}
          >
            <div class="flex items-center gap-4 text-xs" style={{ color: "var(--text-weak)" }}>
              <span>
                <kbd
                  style={{
                    background: "var(--background-base)",
                    padding: "1px 4px",
                    "border-radius": "var(--cortex-radius-sm)",
                    "margin-right": "4px",
                  }}
                >
                  Enter
                </kbd>
                Navigate
              </span>
              <span>
                <kbd
                  style={{
                    background: "var(--background-base)",
                    padding: "1px 4px",
                    "border-radius": "var(--cortex-radius-sm)",
                    "margin-right": "4px",
                  }}
                >
                  Esc
                </kbd>
                Close
              </span>
            </div>
            <span class="text-xs" style={{ color: "var(--text-weak)" }}>
              <kbd
                style={{
                  background: "var(--background-base)",
                  padding: "1px 4px",
                  "border-radius": "var(--cortex-radius-sm)",
                }}
              >
                Ctrl+Shift+H
              </kbd>
            </span>
          </div>
        </div>
      </div>

      {/* Inline styles for animations */}
      <style>{`
        .type-hierarchy-item {
          display: flex;
          align-items: center;
          padding: 4px 8px;
          font-size: 13px;
          transition: background 0.1s ease;
        }
        .type-hierarchy-item:hover {
          background: var(--surface-base) !important;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 0.8s linear infinite;
        }
      `}</style>
    </Show>
  );
}

export default TypeHierarchyView;

