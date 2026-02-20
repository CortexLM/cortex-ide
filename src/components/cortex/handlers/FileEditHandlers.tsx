import { onMount, onCleanup } from "solid-js";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

import { useNavigate } from "@solidjs/router";

import { useEditor } from "@/context/editor/EditorProvider";
import { useSDK } from "@/context/SDKContext";
import { fsWriteFile } from "@/utils/tauri-api";
import { MonacoManager } from "@/utils/monacoManager";
import { createLogger } from "@/utils/logger";
import { getWindowLabel } from "@/utils/windowStorage";

const logger = createLogger("FileEditHandlers");

function getActiveMonacoEditor() {
  const monaco = MonacoManager.getInstance().getMonacoOrNull();
  if (!monaco) return null;
  const editors = monaco.editor.getEditors();
  for (const ed of editors) {
    if (ed.hasTextFocus()) return ed;
  }
  return editors[0] ?? null;
}

export function FileEditHandlers() {
  const editor = useEditor();
  const sdk = useSDK();
  const navigate = useNavigate();

  onMount(() => {
    const handlers: Record<string, EventListener> = {
      "file:new": (() => {
        editor.openVirtualFile("Untitled", "", "plaintext");
      }) as EventListener,

      "file:open": (() => {
        if ((window as any).__fileOpenPending) return;
        (window as any).__fileOpenPending = true;
        openDialog({
          directory: false,
          multiple: false,
          title: "Open File",
        }).then((selected) => {
          if (selected) editor.openFile(selected as string);
        }).catch((e) => {
          logger.error("Failed to open file:", e);
        }).finally(() => {
          (window as any).__fileOpenPending = false;
        });
      }) as EventListener,

      "file:save": (() => {
        const id = editor.state.activeFileId;
        if (id) editor.saveFile(id);
      }) as EventListener,

      "file:save-as": (async () => {
        try {
          const file = editor.state.openFiles.find(
            (f) => f.id === editor.state.activeFileId,
          );
          if (!file) return;

          const selected = await saveDialog({
            title: "Save As",
            defaultPath: file.name,
          });
          if (!selected) return;

          await fsWriteFile(selected, file.content);
          editor.openFile(selected);
        } catch (e) {
          logger.error("Failed to save file as:", e);
        }
      }) as EventListener,

      "file:save-all": (() => {
        editor.state.openFiles.forEach((f) => {
          if (f.modified) editor.saveFile(f.id);
        });
      }) as EventListener,

      "file:close": (() => {
        const id = editor.state.activeFileId;
        if (id) editor.closeFile(id);
      }) as EventListener,

      "folder:open": (() => {
        if ((window as any).__folderOpenPending) return;
        (window as any).__folderOpenPending = true;
        openDialog({
          directory: true,
          multiple: false,
          title: "Open Folder",
        }).then((selected) => {
          if (selected) {
            const path = selected as string;
            sdk.updateConfig({ cwd: path });

            const label = getWindowLabel();
            localStorage.setItem("cortex_current_project_" + label, path);
            if (label === "main") localStorage.setItem("cortex_current_project", path);

            localStorage.setItem("figma_layout_mode", "ide");

            window.dispatchEvent(new CustomEvent("workspace:open-folder", { detail: { path } }));
            window.dispatchEvent(new CustomEvent("folder:did-open"));

            navigate("/session");
          }
        }).catch((e) => {
          logger.error("Failed to open folder:", e);
        }).finally(() => {
          (window as any).__folderOpenPending = false;
        });
      }) as EventListener,

      "folder:close": (() => {
        sdk.updateConfig({ cwd: "." });
      }) as EventListener,

      "window:new": (async () => {
        try {
          await invoke("create_new_window", {});
        } catch (e) {
          logger.error("Failed to create new window:", e);
        }
      }) as EventListener,

      "edit:undo": (() => {
        const ed = getActiveMonacoEditor();
        if (ed) {
          ed.trigger("menu", "undo", null);
        } else {
          document.execCommand("undo");
        }
      }) as EventListener,

      "edit:redo": (() => {
        const ed = getActiveMonacoEditor();
        if (ed) {
          ed.trigger("menu", "redo", null);
        } else {
          document.execCommand("redo");
        }
      }) as EventListener,

      "edit:cut": (() => {
        const ed = getActiveMonacoEditor();
        if (ed) {
          ed.trigger("menu", "editor.action.clipboardCutAction", null);
        } else {
          document.execCommand("cut");
        }
      }) as EventListener,

      "edit:copy": (() => {
        const ed = getActiveMonacoEditor();
        if (ed) {
          ed.trigger("menu", "editor.action.clipboardCopyAction", null);
        } else {
          document.execCommand("copy");
        }
      }) as EventListener,

      "edit:paste": (() => {
        document.execCommand("paste");
      }) as EventListener,

      "edit:find": (() => {
        const ed = getActiveMonacoEditor();
        if (ed) ed.trigger("menu", "actions.find", null);
      }) as EventListener,

      "edit:replace": (() => {
        const ed = getActiveMonacoEditor();
        if (ed)
          ed.trigger("menu", "editor.action.startFindReplaceAction", null);
      }) as EventListener,
    };

    for (const [ev, fn] of Object.entries(handlers)) {
      window.addEventListener(ev, fn);
    }

    onCleanup(() => {
      for (const [ev, fn] of Object.entries(handlers)) {
        window.removeEventListener(ev, fn);
      }
    });
  });

  return null;
}

export default FileEditHandlers;
