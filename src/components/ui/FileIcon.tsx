import { createMemo } from "solid-js";
import { getFileIcon, getFolderIconExpanded } from "@/utils/fileIcons";

interface FileIconProps {
  filename: string;
  isDir?: boolean;
  isExpanded?: boolean;
  size?: number;
  class?: string;
}

/**
 * File/Folder icon component using vscode-symbols theme
 */
export function FileIcon(props: FileIconProps) {
  const size = () => props.size ?? 16;
  
  const iconPath = createMemo(() => {
    if (props.isDir) {
      return props.isExpanded 
        ? getFolderIconExpanded(props.filename)
        : getFileIcon(props.filename, true);
    }
    return getFileIcon(props.filename, false);
  });

  return (
    <img
      src={iconPath()}
      alt=""
      width={size()}
      height={size()}
      class={props.class}
      style={{
        width: `${size()}px`,
        height: `${size()}px`,
        "flex-shrink": "0",
        "object-fit": "contain",
      }}
      loading="lazy"
      draggable={false}
    />
  );
}

export default FileIcon;
