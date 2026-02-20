import { For, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { useEditor } from "@/context/EditorContext";

interface LSEntry {
  name: string;
  size: number;
  type: "file" | "directory";
}

interface LSOutput {
  entries: LSEntry[];
  path: string;
}

export function LSTable(props: { content: string }) {
  const { openFile } = useEditor();

  const data = () => {
    try {
      return JSON.parse(props.content) as LSOutput;
    } catch {
      return null;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const entries = createMemo(() => {
    const d = data();
    if (!d || !d.entries) return [];
    return [...d.entries].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  });

  const handleClick = (entry: LSEntry) => {
    const d = data();
    if (!d) return;
    
    // Construct full path
    const separator = d.path.includes("\\") ? "\\" : "/";
    const fullPath = d.path.endsWith(separator) 
      ? `${d.path}${entry.name}` 
      : `${d.path}${separator}${entry.name}`;

    if (entry.type === "file") {
      openFile(fullPath);
    } else {
      // Focus the folder in the existing explorer
      window.dispatchEvent(new CustomEvent("explorer:reveal", { 
        detail: { path: fullPath } 
      }));
      window.dispatchEvent(new CustomEvent("view:focus", { 
        detail: { view: "files", type: "sidebar" } 
      }));
    }
  };

  return (
    <div class="font-mono text-[11px] my-2 border border-[#222] rounded overflow-hidden">
      <div class="bg-[var(--ui-panel-bg)] px-3 py-1.5 border-b border-[#222] flex justify-between items-center">
        <span class="text-[var(--cortex-text-inactive)] truncate max-w-[80%]">{data()?.path || "Directory Listing"}</span>
        <span class="text-[#444] uppercase tracking-widest text-[9px]">{entries().length} items</span>
      </div>
      <table class="w-full text-left border-collapse">
        <thead class="bg-[var(--cortex-bg-secondary)] text-[#444] uppercase tracking-wider text-[9px]">
          <tr>
            <th class="px-3 py-1 font-bold w-6"></th>
            <th class="px-1 py-1 font-bold">Name</th>
            <th class="px-3 py-1 font-bold text-right">Size</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#222]">
          <For each={entries()}>
            {(entry) => (
              <tr 
                class="hover:bg-white/5 transition-colors group cursor-pointer"
                onClick={() => handleClick(entry)}
              >
<td class="px-3 py-1 text-[var(--cortex-text-inactive)]">
                  {entry.type === 'directory' ? <Icon name="folder" class="w-3 h-3" /> : <Icon name="file" class="w-3 h-3" />}
                </td>
                <td class="px-1 py-1 text-[var(--cortex-text-secondary)] group-hover:text-white truncate max-w-[300px]">
                  {entry.name}
                </td>
                <td class="px-3 py-1 text-[var(--cortex-text-inactive)] text-right">
                  {formatSize(entry.size)}
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}


