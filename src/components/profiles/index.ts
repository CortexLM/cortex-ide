/**
 * Profile Components
 * 
 * VS Code-style profile management for Orion Desktop.
 * 
 * Components:
 * - ProfileSwitcher: Quick profile switching UI (Ctrl+Alt+P)
 * - ProfileStatusBarItem: Status bar indicator
 * - ProfileManager: Full profile management dialog
 * - ProfileEditor: Edit profile settings, keybindings, extensions, UI state
 * - ProfileCommands: Command palette integration
 */

export { ProfileSwitcher, ProfileStatusBarItem, getProfileIcon } from "./ProfileSwitcher";
export { ProfileManager } from "./ProfileManager";
export { ProfileEditor } from "./ProfileEditor";
export { ProfileCommands } from "./ProfileCommands";
