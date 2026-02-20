const loaded = new Set<string>();

type StyleLoader = () => Promise<unknown>;

const styleLoaders: Record<string, StyleLoader> = {
  "terminal": () => import("@/styles/terminal.css"),
  "debug": () => import("@/styles/debug.css"),
  "extensions": () => import("@/styles/extensions.css"),
  "editor": () => import("@/styles/editor.css"),
  "editor-features": () => import("@/styles/editor-features.css"),
  "settings": () => import("@/styles/settings.css"),
  "agent-panel": () => import("@/styles/agent-panel.css"),
  "tree": () => import("@/styles/tree.css"),
  "command-center": () => import("@/styles/command-center.css"),
  "testing": () => import("@/styles/testing.css"),
  "activity-bar": () => import("@/styles/activity-bar.css"),
};

export function loadStylesheet(name: string): void {
  if (loaded.has(name)) return;
  loaded.add(name);
  const loader = styleLoaders[name];
  if (loader) loader();
}
