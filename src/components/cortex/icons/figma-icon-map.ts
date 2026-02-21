export interface FigmaIconEntry {
  figmaNodeId: string;
  name: string;
  category: string;
  path: string;
}

export const FIGMA_ICON_MAP: FigmaIconEntry[] = [
  // Activity Bar Icons (20x20, from Components section 20:2638)
  { figmaNodeId: "37:767", name: "home", category: "activity-bar", path: "/icons/cortex/activity-bar/home.svg" },
  { figmaNodeId: "37:765", name: "folder", category: "activity-bar", path: "/icons/cortex/activity-bar/folder.svg" },
  { figmaNodeId: "37:766", name: "git", category: "activity-bar", path: "/icons/cortex/activity-bar/git.svg" },
  { figmaNodeId: "37:768", name: "play", category: "activity-bar", path: "/icons/cortex/activity-bar/play.svg" },
  { figmaNodeId: "257:4777", name: "plugins", category: "activity-bar", path: "/icons/cortex/activity-bar/plugins.svg" },
  { figmaNodeId: "37:770", name: "users", category: "activity-bar", path: "/icons/cortex/activity-bar/users.svg" },
  { figmaNodeId: "37:771", name: "grid", category: "activity-bar", path: "/icons/cortex/activity-bar/grid.svg" },
  { figmaNodeId: "37:772", name: "book", category: "activity-bar", path: "/icons/cortex/activity-bar/book.svg" },
  { figmaNodeId: "37:773", name: "map", category: "activity-bar", path: "/icons/cortex/activity-bar/map.svg" },
  { figmaNodeId: "37:774", name: "brush", category: "activity-bar", path: "/icons/cortex/activity-bar/brush.svg" },
  { figmaNodeId: "600:11365", name: "account", category: "activity-bar", path: "/icons/cortex/activity-bar/account.svg" },
  { figmaNodeId: "600:11423", name: "account2", category: "activity-bar", path: "/icons/cortex/activity-bar/account2.svg" },

  // Navigation Icons (16x16)
  { figmaNodeId: "39:803", name: "chevron-down", category: "navigation", path: "/icons/cortex/navigation/chevron-down.svg" },
  { figmaNodeId: "39:804", name: "chevron-left", category: "navigation", path: "/icons/cortex/navigation/chevron-left.svg" },
  { figmaNodeId: "39:805", name: "chevron-right", category: "navigation", path: "/icons/cortex/navigation/chevron-right.svg" },
  { figmaNodeId: "39:806", name: "chevron-up", category: "navigation", path: "/icons/cortex/navigation/chevron-up.svg" },
  { figmaNodeId: "84:2493", name: "back", category: "navigation", path: "/icons/cortex/navigation/back.svg" },
  { figmaNodeId: "166:5314", name: "arrow-narrow-down", category: "navigation", path: "/icons/cortex/navigation/arrow-narrow-down.svg" },
  { figmaNodeId: "166:5313", name: "arrow-narrow-up", category: "navigation", path: "/icons/cortex/navigation/arrow-narrow-up.svg" },
  { figmaNodeId: "61:3551", name: "arrow-narrow-down-left", category: "navigation", path: "/icons/cortex/navigation/arrow-narrow-down-left.svg" },
  { figmaNodeId: "226:5273", name: "move-up", category: "navigation", path: "/icons/cortex/navigation/move-up.svg" },
  { figmaNodeId: "226:5272", name: "move-down", category: "navigation", path: "/icons/cortex/navigation/move-down.svg" },
  { figmaNodeId: "63:3596", name: "expand", category: "navigation", path: "/icons/cortex/navigation/expand.svg" },
  { figmaNodeId: "63:3595", name: "collapse", category: "navigation", path: "/icons/cortex/navigation/collapse.svg" },
  { figmaNodeId: "43:908", name: "menu-left-off", category: "navigation", path: "/icons/cortex/navigation/menu-left-off.svg" },
  { figmaNodeId: "43:1317", name: "menu-left-on", category: "navigation", path: "/icons/cortex/navigation/menu-left-on.svg" },
  { figmaNodeId: "43:1216", name: "hide-panel", category: "navigation", path: "/icons/cortex/navigation/hide-panel.svg" },

  // Action Icons (16x16)
  { figmaNodeId: "57:926", name: "plus", category: "actions", path: "/icons/cortex/actions/plus.svg" },
  { figmaNodeId: "57:927", name: "minus", category: "actions", path: "/icons/cortex/actions/minus.svg" },
  { figmaNodeId: "43:1301", name: "x-close", category: "actions", path: "/icons/cortex/actions/x-close.svg" },
  { figmaNodeId: "63:3584", name: "search-sm", category: "actions", path: "/icons/cortex/actions/search-sm.svg" },
  { figmaNodeId: "68:1101", name: "refresh-cw-05", category: "actions", path: "/icons/cortex/actions/refresh-cw-05.svg" },
  { figmaNodeId: "63:3560", name: "trash-03", category: "actions", path: "/icons/cortex/actions/trash-03.svg" },
  { figmaNodeId: "63:3572", name: "switch-horizontal-01", category: "actions", path: "/icons/cortex/actions/switch-horizontal-01.svg" },
  { figmaNodeId: "43:997", name: "attach", category: "actions", path: "/icons/cortex/actions/attach.svg" },
  { figmaNodeId: "166:5324", name: "edit-02", category: "actions", path: "/icons/cortex/actions/edit-02.svg" },
  { figmaNodeId: "218:5134", name: "upload-01", category: "actions", path: "/icons/cortex/actions/upload-01.svg" },
  { figmaNodeId: "218:5208", name: "save-01", category: "actions", path: "/icons/cortex/actions/save-01.svg" },
  { figmaNodeId: "218:5246", name: "flip-backward", category: "actions", path: "/icons/cortex/actions/flip-backward.svg" },
  { figmaNodeId: "218:5245", name: "flip-forward", category: "actions", path: "/icons/cortex/actions/flip-forward.svg" },
  { figmaNodeId: "210:7117", name: "filter-lines", category: "actions", path: "/icons/cortex/actions/filter-lines.svg" },
  { figmaNodeId: "68:1623", name: "reverse-left", category: "actions", path: "/icons/cortex/actions/reverse-left.svg" },
  { figmaNodeId: "166:3147", name: "file-plus-01", category: "actions", path: "/icons/cortex/actions/file-plus-01.svg" },

  // Status Bar Icons (16x16)
  { figmaNodeId: "43:905", name: "info-circle", category: "status-bar", path: "/icons/cortex/status-bar/info-circle.svg" },
  { figmaNodeId: "43:906", name: "git-branch-02", category: "status-bar", path: "/icons/cortex/status-bar/git-branch-02.svg" },
  { figmaNodeId: "43:907", name: "terminal-square", category: "status-bar", path: "/icons/cortex/status-bar/terminal-square.svg" },
  { figmaNodeId: "43:1253", name: "terminal", category: "status-bar", path: "/icons/cortex/status-bar/terminal.svg" },
  { figmaNodeId: "43:1254", name: "command", category: "status-bar", path: "/icons/cortex/status-bar/command.svg" },
  { figmaNodeId: "43:1256", name: "bell-02", category: "status-bar", path: "/icons/cortex/status-bar/bell-02.svg" },
  { figmaNodeId: "43:1257", name: "message-square-01", category: "status-bar", path: "/icons/cortex/status-bar/message-square-01.svg" },
  { figmaNodeId: "277:6554", name: "message-text-square-01", category: "status-bar", path: "/icons/cortex/status-bar/message-text-square-01.svg" },
  { figmaNodeId: "68:1311", name: "green-tick", category: "status-bar", path: "/icons/cortex/status-bar/green-tick.svg" },
  { figmaNodeId: "75:3318", name: "layout-alt-04", category: "status-bar", path: "/icons/cortex/status-bar/layout-alt-04.svg" },

  // Sidebar Icons (16x16)
  { figmaNodeId: "68:1853", name: "file", category: "sidebar", path: "/icons/cortex/sidebar/file.svg" },
  { figmaNodeId: "68:1661", name: "folder", category: "sidebar", path: "/icons/cortex/sidebar/folder.svg" },
  { figmaNodeId: "166:5161", name: "list", category: "sidebar", path: "/icons/cortex/sidebar/list.svg" },
  { figmaNodeId: "166:5183", name: "git-logo", category: "sidebar", path: "/icons/cortex/sidebar/git-logo.svg" },
  { figmaNodeId: "166:13784", name: "lock-01", category: "sidebar", path: "/icons/cortex/sidebar/lock-01.svg" },
  { figmaNodeId: "166:14851", name: "check", category: "sidebar", path: "/icons/cortex/sidebar/check.svg" },
  { figmaNodeId: "166:16922", name: "check-on", category: "sidebar", path: "/icons/cortex/sidebar/check-on.svg" },
  { figmaNodeId: "166:16923", name: "check-off", category: "sidebar", path: "/icons/cortex/sidebar/check-off.svg" },
  { figmaNodeId: "65:1116", name: "tag-02", category: "sidebar", path: "/icons/cortex/sidebar/tag-02.svg" },
  { figmaNodeId: "65:1141", name: "flag-05", category: "sidebar", path: "/icons/cortex/sidebar/flag-05.svg" },
  { figmaNodeId: "68:1084", name: "eye", category: "sidebar", path: "/icons/cortex/sidebar/eye.svg" },
  { figmaNodeId: "68:1633", name: "clock", category: "sidebar", path: "/icons/cortex/sidebar/clock.svg" },
  { figmaNodeId: "63:3624", name: "star-01", category: "sidebar", path: "/icons/cortex/sidebar/star-01.svg" },
  { figmaNodeId: "63:3597", name: "target-02", category: "sidebar", path: "/icons/cortex/sidebar/target-02.svg" },
  { figmaNodeId: "75:3309", name: "lightbulb-03", category: "sidebar", path: "/icons/cortex/sidebar/lightbulb-03.svg" },
  { figmaNodeId: "75:3611", name: "filler", category: "sidebar", path: "/icons/cortex/sidebar/filler.svg" },
  { figmaNodeId: "64:1021", name: "settings-02", category: "sidebar", path: "/icons/cortex/sidebar/settings-02.svg" },
  { figmaNodeId: "603:12382", name: "user-01", category: "sidebar", path: "/icons/cortex/sidebar/user-01.svg" },
  { figmaNodeId: "603:12380", name: "tag-01", category: "sidebar", path: "/icons/cortex/sidebar/tag-01.svg" },
  { figmaNodeId: "603:12381", name: "pie-chart-01", category: "sidebar", path: "/icons/cortex/sidebar/pie-chart-01.svg" },
  { figmaNodeId: "603:12383", name: "data", category: "sidebar", path: "/icons/cortex/sidebar/data.svg" },
  { figmaNodeId: "603:12384", name: "shield-02", category: "sidebar", path: "/icons/cortex/sidebar/shield-02.svg" },
  { figmaNodeId: "0:588", name: "magic-wand", category: "sidebar", path: "/icons/cortex/sidebar/magic-wand.svg" },

  // Chat Icons (16x16)
  { figmaNodeId: "43:919", name: "code", category: "chat", path: "/icons/cortex/chat/code.svg" },
  { figmaNodeId: "43:923", name: "palette", category: "chat", path: "/icons/cortex/chat/palette.svg" },
  { figmaNodeId: "43:927", name: "brackets-square", category: "chat", path: "/icons/cortex/chat/brackets-square.svg" },
  { figmaNodeId: "43:1517", name: "debug", category: "chat", path: "/icons/cortex/chat/debug.svg" },
  { figmaNodeId: "43:1516", name: "more", category: "chat", path: "/icons/cortex/chat/more.svg" },

  // File Type Icons (16x16, from Components section)
  { figmaNodeId: "84:2786", name: "react-ts", category: "file-types", path: "/icons/cortex/file-types/react-ts.svg" },
  { figmaNodeId: "84:2787", name: "rust", category: "file-types", path: "/icons/cortex/file-types/rust.svg" },
  { figmaNodeId: "84:2788", name: "toml", category: "file-types", path: "/icons/cortex/file-types/toml.svg" },
];

export const FIGMA_FILE_KEY = "liJL2JeEwYuOJNw7pGhrRM";

export const FIGMA_SECTIONS = {
  components: "20:2638",
  mainScreen: "166:2183",
  sourceControl: "262:5945",
  debug: "262:6855",
  extensions: "262:7065",
  agents: "262:7348",
  vibe: "406:5190",
  account: "600:11484",
  plugins: "262:6258",
  colours: "415:8050",
  aiModifications: "520:10617",
} as const;
