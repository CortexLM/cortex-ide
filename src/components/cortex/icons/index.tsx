import { Component, JSX, splitProps, createSignal, createEffect, onCleanup } from "solid-js";

export const CORTEX_ICON_CATEGORIES = [
  "activity-bar",
  "navigation",
  "actions",
  "status-bar",
  "sidebar",
  "chat",
  "file-types",
] as const;

export type CortexIconCategory = (typeof CORTEX_ICON_CATEGORIES)[number];

const REGISTRY_ENTRIES = {
  "activity-bar/home": "/icons/cortex/activity-bar/home.svg",
  "activity-bar/folder": "/icons/cortex/activity-bar/folder.svg",
  "activity-bar/git": "/icons/cortex/activity-bar/git.svg",
  "activity-bar/play": "/icons/cortex/activity-bar/play.svg",
  "activity-bar/plugins": "/icons/cortex/activity-bar/plugins.svg",
  "activity-bar/users": "/icons/cortex/activity-bar/users.svg",
  "activity-bar/grid": "/icons/cortex/activity-bar/grid.svg",
  "activity-bar/book": "/icons/cortex/activity-bar/book.svg",
  "activity-bar/map": "/icons/cortex/activity-bar/map.svg",
  "activity-bar/brush": "/icons/cortex/activity-bar/brush.svg",
  "activity-bar/account": "/icons/cortex/activity-bar/account.svg",
  "activity-bar/account2": "/icons/cortex/activity-bar/account2.svg",

  "navigation/chevron-down": "/icons/cortex/navigation/chevron-down.svg",
  "navigation/chevron-left": "/icons/cortex/navigation/chevron-left.svg",
  "navigation/chevron-right": "/icons/cortex/navigation/chevron-right.svg",
  "navigation/chevron-up": "/icons/cortex/navigation/chevron-up.svg",
  "navigation/back": "/icons/cortex/navigation/back.svg",
  "navigation/arrow-narrow-down": "/icons/cortex/navigation/arrow-narrow-down.svg",
  "navigation/arrow-narrow-up": "/icons/cortex/navigation/arrow-narrow-up.svg",
  "navigation/arrow-narrow-down-left": "/icons/cortex/navigation/arrow-narrow-down-left.svg",
  "navigation/move-up": "/icons/cortex/navigation/move-up.svg",
  "navigation/move-down": "/icons/cortex/navigation/move-down.svg",
  "navigation/expand": "/icons/cortex/navigation/expand.svg",
  "navigation/collapse": "/icons/cortex/navigation/collapse.svg",
  "navigation/menu-left-off": "/icons/cortex/navigation/menu-left-off.svg",
  "navigation/menu-left-on": "/icons/cortex/navigation/menu-left-on.svg",
  "navigation/hide-panel": "/icons/cortex/navigation/hide-panel.svg",

  "actions/plus": "/icons/cortex/actions/plus.svg",
  "actions/minus": "/icons/cortex/actions/minus.svg",
  "actions/x-close": "/icons/cortex/actions/x-close.svg",
  "actions/search-sm": "/icons/cortex/actions/search-sm.svg",
  "actions/refresh-cw-05": "/icons/cortex/actions/refresh-cw-05.svg",
  "actions/trash-03": "/icons/cortex/actions/trash-03.svg",
  "actions/switch-horizontal-01": "/icons/cortex/actions/switch-horizontal-01.svg",
  "actions/attach": "/icons/cortex/actions/attach.svg",
  "actions/edit-02": "/icons/cortex/actions/edit-02.svg",
  "actions/upload-01": "/icons/cortex/actions/upload-01.svg",
  "actions/save-01": "/icons/cortex/actions/save-01.svg",
  "actions/flip-backward": "/icons/cortex/actions/flip-backward.svg",
  "actions/flip-forward": "/icons/cortex/actions/flip-forward.svg",
  "actions/filter-lines": "/icons/cortex/actions/filter-lines.svg",
  "actions/reverse-left": "/icons/cortex/actions/reverse-left.svg",
  "actions/file-plus-01": "/icons/cortex/actions/file-plus-01.svg",

  "status-bar/info-circle": "/icons/cortex/status-bar/info-circle.svg",
  "status-bar/git-branch-02": "/icons/cortex/status-bar/git-branch-02.svg",
  "status-bar/terminal-square": "/icons/cortex/status-bar/terminal-square.svg",
  "status-bar/terminal": "/icons/cortex/status-bar/terminal.svg",
  "status-bar/command": "/icons/cortex/status-bar/command.svg",
  "status-bar/bell-02": "/icons/cortex/status-bar/bell-02.svg",
  "status-bar/message-square-01": "/icons/cortex/status-bar/message-square-01.svg",
  "status-bar/message-text-square-01": "/icons/cortex/status-bar/message-text-square-01.svg",
  "status-bar/green-tick": "/icons/cortex/status-bar/green-tick.svg",
  "status-bar/layout-alt-04": "/icons/cortex/status-bar/layout-alt-04.svg",

  "sidebar/file": "/icons/cortex/sidebar/file.svg",
  "sidebar/folder": "/icons/cortex/sidebar/folder.svg",
  "sidebar/list": "/icons/cortex/sidebar/list.svg",
  "sidebar/git-logo": "/icons/cortex/sidebar/git-logo.svg",
  "sidebar/lock-01": "/icons/cortex/sidebar/lock-01.svg",
  "sidebar/check": "/icons/cortex/sidebar/check.svg",
  "sidebar/check-on": "/icons/cortex/sidebar/check-on.svg",
  "sidebar/check-off": "/icons/cortex/sidebar/check-off.svg",
  "sidebar/tag-02": "/icons/cortex/sidebar/tag-02.svg",
  "sidebar/flag-05": "/icons/cortex/sidebar/flag-05.svg",
  "sidebar/eye": "/icons/cortex/sidebar/eye.svg",
  "sidebar/clock": "/icons/cortex/sidebar/clock.svg",
  "sidebar/star-01": "/icons/cortex/sidebar/star-01.svg",
  "sidebar/target-02": "/icons/cortex/sidebar/target-02.svg",
  "sidebar/lightbulb-03": "/icons/cortex/sidebar/lightbulb-03.svg",
  "sidebar/filler": "/icons/cortex/sidebar/filler.svg",
  "sidebar/settings-02": "/icons/cortex/sidebar/settings-02.svg",
  "sidebar/user-01": "/icons/cortex/sidebar/user-01.svg",
  "sidebar/tag-01": "/icons/cortex/sidebar/tag-01.svg",
  "sidebar/pie-chart-01": "/icons/cortex/sidebar/pie-chart-01.svg",
  "sidebar/data": "/icons/cortex/sidebar/data.svg",
  "sidebar/shield-02": "/icons/cortex/sidebar/shield-02.svg",

  "chat/code": "/icons/cortex/chat/code.svg",
  "chat/palette": "/icons/cortex/chat/palette.svg",
  "chat/brackets-square": "/icons/cortex/chat/brackets-square.svg",
  "chat/debug": "/icons/cortex/chat/debug.svg",
  "chat/more": "/icons/cortex/chat/more.svg",

  "file-types/react-ts": "/icons/cortex/file-types/react-ts.svg",
  "file-types/rust": "/icons/cortex/file-types/rust.svg",
  "file-types/toml": "/icons/cortex/file-types/toml.svg",
} as const;

export type CortexIconName = keyof typeof REGISTRY_ENTRIES;

export const CORTEX_ICON_REGISTRY: Record<CortexIconName, string> = REGISTRY_ENTRIES;

export function getCortexIconPath(name: CortexIconName): string {
  return CORTEX_ICON_REGISTRY[name];
}

export function getCortexIconsByCategory(category: CortexIconCategory): CortexIconName[] {
  const prefix = `${category}/`;
  return (Object.keys(CORTEX_ICON_REGISTRY) as CortexIconName[]).filter(
    (key) => key.startsWith(prefix),
  );
}

const svgCache = new Map<string, string>();
const failedPaths = new Set<string>();
const pendingFetches = new Map<string, Promise<string | null>>();

async function loadSvg(path: string): Promise<string | null> {
  if (failedPaths.has(path)) return null;
  if (svgCache.has(path)) return svgCache.get(path)!;
  if (pendingFetches.has(path)) return pendingFetches.get(path)!;

  const promise = fetch(path)
    .then((res) => {
      if (!res.ok) {
        failedPaths.add(path);
        return null;
      }
      return res.text();
    })
    .then((text) => {
      if (text) svgCache.set(path, text);
      return text;
    })
    .catch(() => {
      failedPaths.add(path);
      return null;
    })
    .finally(() => {
      pendingFetches.delete(path);
    });

  pendingFetches.set(path, promise);
  return promise;
}

function parseSvg(svgText: string): { viewBox: string; content: string } {
  const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/);
  const pathMatch = svgText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  return {
    viewBox: viewBoxMatch?.[1] ?? "0 0 16 16",
    content: pathMatch?.[1] ?? "",
  };
}

export interface CortexSvgIconProps {
  name: CortexIconName;
  size?: number;
  color?: string;
  class?: string;
  style?: JSX.CSSProperties;
  onClick?: (e: MouseEvent) => void;
}

export const CortexSvgIcon: Component<CortexSvgIconProps> = (props) => {
  const [local] = splitProps(props, ["name", "size", "color", "class", "style", "onClick"]);
  const [svgContent, setSvgContent] = createSignal<string>("");
  const [viewBox, setViewBox] = createSignal("0 0 16 16");

  let mounted = true;
  onCleanup(() => { mounted = false; });

  createEffect(() => {
    const path = CORTEX_ICON_REGISTRY[local.name];
    if (!path) return;

    const cached = svgCache.get(path);
    if (cached) {
      const parsed = parseSvg(cached);
      setSvgContent(parsed.content);
      setViewBox(parsed.viewBox);
      return;
    }

    loadSvg(path).then((text) => {
      if (!mounted || !text) return;
      const parsed = parseSvg(text);
      setSvgContent(parsed.content);
      setViewBox(parsed.viewBox);
    });
  });

  const size = () => local.size ?? 16;

  return (
    <svg
      class={local.class}
      viewBox={viewBox()}
      width={`${size()}px`}
      height={`${size()}px`}
      fill={local.color ?? "currentColor"}
      style={{
        display: "inline-block",
        "vertical-align": "middle",
        "flex-shrink": "0",
        transition: "color 150ms ease",
        ...local.style,
      }}
      onClick={local.onClick}
      innerHTML={svgContent()}
    />
  );
};

export { FIGMA_ICON_MAP, FIGMA_FILE_KEY, FIGMA_SECTIONS } from "./figma-icon-map";
export type { FigmaIconEntry } from "./figma-icon-map";
